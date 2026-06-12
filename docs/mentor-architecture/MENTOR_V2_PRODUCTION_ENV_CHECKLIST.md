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
| `affectedRealPlanStatus` (`MP_1780920810055`) | `≠ {completed:5, snoozed:10}` | **CRITICAL** — a real-user plan changed |
| `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` | `true` | **CRITICAL** — write flag enabled before its phase |

Healthy baseline (allowlist mode) = `ALERT STATUS: OK`, all guardrails 0, real plan unchanged.
In allow-all mode the healthy baseline is `ALERT STATUS: WARNING` with only `ALLOW_ALL_ENABLED`.
The monitor prints `Mutation scope: allowAll=<bool> allowlistSize=<n>` and reports `mutationAllowAll`.

## 5a. Scheduled monitor / alerting (GitHub Actions)

- **Workflow:** `.github/workflows/mentor-v2-monitor.yml`
- **Schedule:** every 6 hours (`cron: "0 */6 * * *"`) + manual **`workflow_dispatch`** (Actions tab → "Mentor V2 Production Monitor" → Run workflow).
- **What it runs:** `npm run mentor:v2-monitor` — read-only, no writes/mutations/deploy. `permissions: contents: read`.
- **Pass/fail:** the job fails **only** when the monitor exits non-zero, i.e. **CRITICAL**. The expected `ALLOW_ALL_ENABLED` **WARNING is exit 0** and does **not** fail the job.
- **Expected healthy result (allow-all on):** `ALERT STATUS: WARNING`, alert `ALLOW_ALL_ENABLED`, no CRITICAL, `mutationAllowAll=true`, guardrails 0/0/0, real plan `{completed:5, snoozed:10}`.
- **What FAILS the job (CRITICAL → red run):**
  - `unexpectedMutationsOutsideAllowlist > 0` **while allow-all is off**,
  - `duplicateIdempotencyKeys > 0`,
  - `failedMutationRequests ≥ 3`,
  - affected real plan drift from `{completed:5, snoozed:10}`,
  - `MENTOR_DAILY_ROLLOVER_V2` or `MENTOR_PENDING_LIFECYCLE_V2` = `true`.

**Required GitHub repo Secrets** (Settings → Secrets and variables → Actions). Names match the app's actual env (`lib/sheets.js`):

| Secret | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | the service-account JSON (same as Vercel) |
| `GOOGLE_SHEET_ID` | the production Sheet id |
| `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` | current allowlist value (or blank — ignored while allow-all is on) |

The workflow hard-codes the mutation/scope flags (`MENTOR_*_V2=true`, allow-all `true`, rollover/pending `false`) to mirror production, so only the two Google secrets + the allowlist need to be set. **Add no write-capable secrets.**

**If the scheduled job goes CRITICAL (red):** open the run log to see the alert code, then apply the matching rollback from §4 (e.g. `unexpectedMutationsOutsideAllowlist>0` with allow-all off → check the allowlist; a real-plan drift or a rollover/pending flag true → disable mutations via `MENTOR_TASK_MUTATIONS_V2=false` and investigate; restore the `.xlsx` backup if data changed). Re-run via `workflow_dispatch` to confirm green.

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
