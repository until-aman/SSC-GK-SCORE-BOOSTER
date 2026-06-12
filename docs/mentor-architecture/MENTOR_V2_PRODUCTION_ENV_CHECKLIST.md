# Mentor V2 — Production Env Checklist & Rollout/Rollback Guardrails

Operator reference for the Mentor Repository V2 rollout. All flags are **server-only**
(read from `process.env`), fail-closed when unset. Set them in **Vercel → Project
(`ssc-gk-score-booster-v2`) → Settings → Environment Variables → Production**.

> ⚠️ **Deploy process (read this first):** Production deploys from **`main`**. Vercel bakes
> env vars in **at build time**, so after changing any var you MUST trigger a **Redeploy**.
> And **Mentor V2 code must be merged into `main`** before its flags can do anything —
> flags on a Preview/feature branch have **no effect on production**. (This was the root
> cause fixed in Phase 9H2: the flags were set but the V2 code was only on a Preview branch.)

---

## 1. Intended production flag state (current)

```text
# Read path (shadow + canonical day) — safe, no writes
MENTOR_SHEETS_SCHEMA_V2=true
MENTOR_CANONICAL_DAY_READ=true
MENTOR_REPO_V2_SHADOW=true
MENTOR_TASK_STATE_MACHINE_V2=true

# Mutation path — enable the three flags, then choose the scope (allowlist vs allow-all)
MENTOR_MUTATION_IDEMPOTENCY_V2=true
MENTOR_SHEETS_MUTATIONS_V2=true
MENTOR_TASK_MUTATIONS_V2=true

# Mutation scope (pick ONE mode — see "Mutation scope modes" below)
MENTOR_V2_MUTATION_ALLOW_ALL=false                                           # true = ALL authenticated users
MENTOR_V2_MUTATION_ALLOWED_USER_HASHES=<comma-separated approved u_ hashes>   # used only when allow-all is false; currently: u_1d929728f3beaa74

# MUST stay OFF (unset or false) until a dedicated controlled phase
MENTOR_DAILY_ROLLOVER_V2=false
MENTOR_PENDING_LIFECYCLE_V2=false
```

User scope hashes are `u_<sha256(lowercased email).slice(0,16)>`. Full emails are never
required or logged. The mutation routes (`/api/mentor/task-action` for snooze/resume,
`/api/mentor/quiz-return` for quiz_sync complete) all consult the same user gate; manual
`complete` is **never** V2 regardless of these flags.

### Mutation scope modes (`isMentorV2MutationUserAllowed`)

| Mode | Config | Who routes to V2 |
|---|---|---|
| **Allow-all** | `MENTOR_V2_MUTATION_ALLOW_ALL=true` (exact string) | **every authenticated user** (allowlist ignored) |
| **Allowlist** | allow-all unset/false + `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` non-empty | only the listed `u_` hashes |
| **Fail-closed** | allow-all unset/false + empty allowlist | nobody → legacy write path |

`MENTOR_V2_MUTATION_ALLOW_ALL` is true **only** when the value is exactly `true`; any other
value (unset / blank / `TRUE` / `1` / `false`) means false (fail-closed default).

## 2. `MENTOR_REPO_V2` (global read overlay) — choose deliberately

```text
MENTOR_REPO_V2=false
  Safer initial rollout. Legacy reads for ALL users. V2 mutations still work for the
  allowlist (mutation routing does NOT depend on this flag). The "Previously Pending"
  section still surfaces via the client's status filter.

MENTOR_REPO_V2=true
  Enables the global V2 read overlay: canonical-day display + server-side pending
  surfacing for EVERY user. Validated in Phase 8C. Use only when ready for an
  all-user read-UX change. Flip back to false at any time to revert reads to legacy.
```

## 3. Action scope (what is / isn't on V2)

| Action | Route | V2? |
|---|---|---|
| Maybe Later (`snooze`→POSTPONE) | `/api/mentor/task-action` | ✅ allowlist only |
| Resume (`resume`→RESUME) | `/api/mentor/task-action` | ✅ allowlist only |
| Quiz completion (`quiz_sync`→COMPLETE) | `/api/mentor/quiz-return` | ✅ allowlist only (requires `LinkedQuizSessionId`) |
| Manual "Mark Completed" (`complete`) | `/api/mentor/task-action` | ❌ legacy by design |
| Daily rollover / pending lifecycle (auto pending) | — | ❌ flags OFF |

## 4. Disable / rollback paths (fastest first)

1. **Stop all V2 mutations instantly** — set `MENTOR_V2_MUTATION_ALLOW_ALL=false` **and**
   clear `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` (⇒ fail-closed, nobody routes to V2),
   **or** simply set `MENTOR_TASK_MUTATIONS_V2=false`. Then **Redeploy**. Reads unaffected.
   - To revert from **allow-all back to the allowlist** without disabling V2: set
     `MENTOR_V2_MUTATION_ALLOW_ALL=false` (the allowlist takes over), Redeploy.
2. **Revert reads to legacy for all users** — set `MENTOR_REPO_V2=false`, Redeploy.
3. **Full revert** — set all `MENTOR_*_V2` to false (or use Vercel **Instant Rollback**
   to the previous Production deployment). Behaviour returns to 100% legacy.
4. **Data rollback** — Google Sheets is not transactional; restore the founder's `.xlsx`
   backup, or narrowly revert the specific task rows + the `MentorMutationRequests` /
   `MentorTaskLogs` rows for the affected task(s). V2 mutations are idempotent and
   RowVersion-locked, so re-running a request is safe.

## 5. Monitor & alert thresholds (read-only)

Run: `DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mentor-v2-mutation-monitor.js`
(add `--json` for machine output). The monitor performs **only reads** and **exits 2 on
CRITICAL** (so it can gate a cron/CI alert).

| Signal | Threshold | Severity |
|---|---|---|
| `MENTOR_V2_MUTATION_ALLOW_ALL` | `true` | **WARNING** — V2 mutations enabled for all authenticated users (deliberate, visible) |
| `unexpectedMutationsOutsideAllowlist` | `> 0` **and** allow-all is `false` | **CRITICAL** — a non-allowlisted scope mutated (suppressed when allow-all is on, since that's expected) |
| `duplicateIdempotencyKeys` | `> 0` | **CRITICAL** — possible double-write |
| `failedMutationRequests` | `1–2` / `≥3` | **WARNING / CRITICAL** |
| `affectedRealPlanStatus` (`MP_1780920810055`) | growth = informational · `completed < 5` = **CRITICAL** (data loss) · `snoozed < 10` = **WARNING** | After global rollout this is **informational** — real users legitimately grow their plans (new generations / active tasks). Only a **drop below the historical floor** `{completed:5, snoozed:10}` alerts. (The old exact-count drift CRITICAL was a rollout canary, retired once real-user Mentor activity began.) |
| `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` | `true` | **CRITICAL** — write flag enabled before its phase |

Healthy baseline (allowlist mode) = `ALERT STATUS: OK`, all guardrails 0, real plan unchanged.
In allow-all mode the healthy baseline is `ALERT STATUS: WARNING` with only `ALLOW_ALL_ENABLED`.
The monitor prints `Mutation scope: allowAll=<bool> allowlistSize=<n>` and reports `mutationAllowAll`.

## 5a. Scheduled monitor / alerting (Vercel Cron — Phase 9M2)

**Scheduled monitoring runs via Vercel Cron**, which executes inside the Vercel runtime and reuses the **existing** production env vars (`GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SHEET_ID`, all `MENTOR_*` flags). No GitHub secrets, no Sheets-credential duplication.

> **Why not GitHub Actions?** GitHub Actions has its own secret store and **cannot read Vercel env vars**. This repo has **no** Actions secrets configured, so a scheduled GitHub run would always fail. The GitHub workflow `.github/workflows/mentor-v2-monitor.yml` is therefore **manual-only** (`workflow_dispatch`) — usable later only if the three repo secrets are ever added.

- **Cron config:** `vercel.json` → `crons: [{ path: "/api/internal/mentor-v2-monitor", schedule: "0 6 * * *" }]` (daily ~06:00 UTC).
  - *Plan limit (important):* the **Hobby** plan allows cron jobs **once per day only** — a more-frequent expression (e.g. `0 */6 * * *`) **fails the deployment** with "Hobby accounts are limited to daily cron jobs." Hobby timing precision is hourly (±59 min), so the run fires sometime in the 06:00–06:59 UTC window. For sub-daily cadence or precise timing, upgrade to Pro and change the schedule.
- **Route:** `pages/api/internal/mentor-v2-monitor.js` — **read-only** (`auditV2Mutations` → `cronMonitorResult`); never mutates the Sheet.
- **Auth (`CRON_SECRET`):** the route is fail-closed — it requires `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this header automatically **when `CRON_SECRET` is set on the project**. There is no pre-existing cron/internal secret in this repo, so **one new Vercel env var `CRON_SECRET` must be added** (Production; any strong random string). It is **not** a Google/Sheets secret. Without it the route returns `401` and the cron is effectively disabled (safe).
- **HTTP semantics:** `CRITICAL → 500` (Vercel marks the cron run failed → surfaces in the Vercel dashboard / logs), `WARNING/OK → 200`.
- **Expected healthy result (allow-all on):** `200` with `alertStatus: "WARNING"`, alert `ALLOW_ALL_ENABLED`, `mutationAllowAll: true`, `duplicateIdempotencyKeys: 0`, `failedMutationRequests: 0`, `unexpectedMutationsOutsideAllowlist: 0`, `affectedRealPlanStatus: {completed:5, snoozed:10}`, `flags.MENTOR_DAILY_ROLLOVER_V2/PENDING_LIFECYCLE_V2: false`.
- **What returns 500 (CRITICAL):** `unexpectedMutationsOutsideAllowlist > 0` while allow-all off · `duplicateIdempotencyKeys > 0` · `failedMutationRequests ≥ 3` · `MENTOR_DAILY_ROLLOVER_V2` or `MENTOR_PENDING_LIFECYCLE_V2` = `true` · affected real plan `completed` **drops below 5** (data loss). Affected-real-plan **growth** is informational (not a CRITICAL); a `snoozed` drop below 10 is a WARNING (likely a legitimate resume/complete).

**Required Vercel env for the cron** (all but `CRON_SECRET` already exist): `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SHEET_ID`, the `MENTOR_*` mutation/scope flags, **plus `CRON_SECRET` (new, one-time)**.

**Manual check (local, anytime):** `DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mentor-v2-mutation-monitor.js` (exits 2 on CRITICAL). The GitHub workflow can also be run manually from the Actions tab **if** the three repo secrets are added.

**If a cron run returns 500 (CRITICAL):** check the Vercel function logs for the alert code, then apply the matching rollback from §4 (e.g. `duplicateIdempotencyKeys`/`failedMutationRequests` → investigate the mutation flow; a rollover/pending flag unexpectedly `true` → set it `false` and `MENTOR_TASK_MUTATIONS_V2=false`, investigate, restore the `.xlsx` backup if data changed).

## 6. Cohort expansion procedure

1. Confirm monitor `ALERT STATUS: OK` and the latest report is clean.
2. Take a fresh `.xlsx` backup.
3. Append the new user's `u_` hash to `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES`
   (comma-separated). **Redeploy.**
4. Validate that user's snooze→pending / resume→active / quiz-complete on the live route
   (same as Phase 9H2), watching the monitor (`unexpectedMutationsOutsideAllowlist` must
   remain 0).
5. Expand in small increments; never enable `MENTOR_DAILY_ROLLOVER_V2` /
   `MENTOR_PENDING_LIFECYCLE_V2` as part of expansion.
