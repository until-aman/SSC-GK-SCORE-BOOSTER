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

# Mutation path — scoped to the allowlist
MENTOR_MUTATION_IDEMPOTENCY_V2=true
MENTOR_SHEETS_MUTATIONS_V2=true
MENTOR_TASK_MUTATIONS_V2=true
MENTOR_V2_MUTATION_ALLOWED_USER_HASHES=<comma-separated approved u_ hashes>   # currently: u_1d929728f3beaa74

# MUST stay OFF (unset or false) until a dedicated controlled phase
MENTOR_DAILY_ROLLOVER_V2=false
MENTOR_PENDING_LIFECYCLE_V2=false
```

User scope hashes are `u_<sha256(lowercased email).slice(0,16)>`. Only listed hashes route
mutations through V2; everyone else stays on the legacy write path.

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

1. **Stop all V2 mutations instantly** — clear `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES`
   (empty ⇒ fail-closed, nobody routes to V2) **or** set `MENTOR_TASK_MUTATIONS_V2=false`.
   Then **Redeploy**. Reads are unaffected.
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
| `unexpectedMutationsOutsideAllowlist` | `> 0` | **CRITICAL** — a non-allowlisted scope mutated |
| `duplicateIdempotencyKeys` | `> 0` | **CRITICAL** — possible double-write |
| `failedMutationRequests` | `1–2` / `≥3` | **WARNING / CRITICAL** |
| `affectedRealPlanStatus` (`MP_1780920810055`) | `≠ {completed:5, snoozed:10}` | **CRITICAL** — a real-user plan changed |
| `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` | `true` | **CRITICAL** — write flag enabled before its phase |

Healthy baseline = `ALERT STATUS: OK`, all guardrails 0, real plan unchanged.

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
