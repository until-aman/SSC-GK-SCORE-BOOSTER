# Phase 9K — Global V2 Mutation Flag (`MENTOR_V2_MUTATION_ALLOW_ALL`)

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Add a deliberate global flag to enable V2 Mentor mutations for **all authenticated users**, preserving fail-closed allowlist behaviour when the flag is off. **Implementation + tests only — no live mutation, no env change, no deploy.**
**Date:** 2026-06-12
**Result:** ✅ `MENTOR_V2_MUTATION_ALLOW_ALL` added; single-source user gate updated; monitor reports `mutationAllowAll` + WARNING when on; docs + 10 tests. Rollover/pending writes remain OFF. 414 tests + build green.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/repository/featureFlags.js` | Added `isMentorV2MutationAllowAllEnabled()` (true **only** for exact `"true"`); `isMentorV2MutationUserAllowed()` now returns true for any authenticated scope when allow-all is on, else falls back to the allowlist (fail-closed when both empty). Exported the new helper. |
| `scripts/mentor-v2-mutation-monitor.js` | Surfaces `mutationAllowAll` in the JSON + summary (`Mutation scope: allowAll=… allowlistSize=…`); passes the flag to the alert evaluator. |
| `lib/mentor/read/v2MutationMonitor.js` | `evaluateMonitorAlerts` emits a **WARNING** `ALLOW_ALL_ENABLED` when allow-all is on, and **suppresses** the `UNEXPECTED_OUTSIDE_ALLOWLIST` CRITICAL in that mode (outside-allowlist mutations are expected). All other CRITICALs unchanged. |
| `docs/mentor-architecture/MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md` | Documented the flag, the three mutation-scope modes, the allow-all WARNING threshold, and the rollback paths. |
| `scripts/test-mentor-allow-all.js` | **New** — 10 gate/monitor tests. |
| `package.json` | Added `test:mentor-allow-all`. |

No routing-file change was needed: `taskActionRouting.js` already routes through `isMentorV2MutationUserAllowed`, so both `shouldRouteActionThroughV2ForUser` (snooze/resume) and `shouldRouteQuizCompletionThroughV2` (quiz-return) inherit allow-all from the single gate.

## 2. Allow-all flag behaviour
`MENTOR_V2_MUTATION_ALLOW_ALL` is `true` **only** when the value is exactly the string `true`. Any other value — unset, blank, `TRUE`, `True`, `1`, `yes`, `false` — evaluates to false (fail-closed default). Verified by test.

## 3. Routing behaviour (single user gate)
```text
isMentorV2MutationUserAllowed(scopeHash):
  if MENTOR_V2_MUTATION_ALLOW_ALL == "true":  return scopeHash is non-empty   # any authenticated user
  if allowlist non-empty:                     return allowlist.includes(scopeHash)
  else:                                        return false                    # fail closed
```
| Mode | Config | Who routes to V2 |
|---|---|---|
| Allow-all | `MENTOR_V2_MUTATION_ALLOW_ALL=true` | every authenticated user (allowlist ignored) |
| Allowlist | allow-all off + `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` non-empty | only listed `u_` hashes |
| Fail-closed | allow-all off + empty allowlist | nobody → legacy |

Applies to `snooze→POSTPONE`, `resume→RESUME`, and `quiz-return→quiz_sync COMPLETE`. **Manual `complete` stays legacy** in every mode (not in `V2_CUTOVER_ACTIONS`; verified). Full emails are never required or logged — the gate keys on the `u_<sha256>` scope hash only.

## 4. Monitor changes
- New field `mutationAllowAll` (top-level + in the `flags` block) and a summary line `Mutation scope: allowAll=<bool> allowlistSize=<n>`.
- `ALLOW_ALL_ENABLED` → **WARNING** when on (visible, not a failure).
- `UNEXPECTED_OUTSIDE_ALLOWLIST` CRITICAL is **only** raised when allow-all is off.
- Unchanged CRITICALs: duplicate idempotency keys, failed mutations (≥3), affected-real-plan drift, rollover/pending write flags true. The monitor still performs only reads and exits 2 on CRITICAL.

## 5. Documentation changes
`MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md` now lists `MENTOR_V2_MUTATION_ALLOW_ALL=false` in the intended state, a "Mutation scope modes" table (allow-all / allowlist / fail-closed), the allow-all WARNING row in the threshold table, and the rollback note (set `MENTOR_V2_MUTATION_ALLOW_ALL=false` to revert to the allowlist, or `MENTOR_TASK_MUTATIONS_V2=false` to stop all V2 mutations — then Redeploy).

## 6. Tests / build result
`test:mentor-allow-all` 10/10 (new): allow-all-off+empty→legacy; off+allowlisted→V2; off+non-allowlisted→legacy; on+any user→V2; on+manual-complete→legacy; on+quiz-return→V2; only exact `"true"` enables; on still requires an authenticated scope; monitor WARNING + outside-allowlist suppression; rollover/pending stay CRITICAL under allow-all. Full suite **414 passed, 0 failed** (allow-all 10, monitor-alerts 8, route-readiness 12, v2-complete 21, v2-complete-design 13, pending-ui 9, pending-surfacing 11, v2-resume 18, v2-cohort 8, v2-postpone 20, read-overlay 13, mutation-service 11, state-machine 45, rollover 67, repo 22, sheets 36, sheets-writer 23, plan-day 25, optimization 42). `npx next build` → **✓ Compiled successfully**.

Live read-only monitor (current prod data, allow-all not yet enabled):
```text
ALERT STATUS: OK   (no alerts)
Mutation scope: allowAll=false  allowlistSize=1
unexpectedOutsideAllowlist=0  duplicateIdempotencyKeys=0  failed=0
Affected real plan (MP_1780920810055): {completed:5, snoozed:10}
rollover/pending write flags: false/false
```

## 7. Production env instructions (to enable when approved)
1. Take a fresh `.xlsx` backup.
2. Merge this Phase 9K commit into `main` (production deploys from `main`; code must be on `main` to take effect).
3. In **Vercel → Production env**, add `MENTOR_V2_MUTATION_ALLOW_ALL=true`. Keep the three mutation flags true; `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` may stay as-is (ignored while allow-all is on). **Redeploy** (env applies at build time).
4. After deploy, run the monitor — expect `ALERT STATUS: WARNING` with only `ALLOW_ALL_ENABLED`, `mutationAllowAll=true`, all other guardrails clean.
5. **Do NOT** enable `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2`.

## 8. Rollback path
- **Revert to allowlist:** set `MENTOR_V2_MUTATION_ALLOW_ALL=false`, Redeploy — only the allowlisted hashes route V2 again.
- **Stop all V2 mutations:** set `MENTOR_TASK_MUTATIONS_V2=false` (or allow-all=false + empty allowlist), Redeploy.
- **Full revert / reads:** Vercel Instant Rollback to the prior Production deployment, or set all `MENTOR_*_V2` false. Reads unaffected by the mutation flags.

## 9. Blocking items
- **Blocking:** None. The change is flag-gated and defaults to the existing allowlist behaviour (no behaviour change until `MENTOR_V2_MUTATION_ALLOW_ALL=true` is set in production).
- **Operational (when enabling):** founder backup; merge to `main`; set the Vercel flag + Redeploy; watch the monitor (`ALERT STATUS: WARNING / ALLOW_ALL_ENABLED` is the expected healthy state in allow-all mode). Keep rollover/pending write flags off.
- **Not done (per strict rules):** no live mutation, no env change, no deploy, no commit/push.

---

*Phase 9K complete — global allow-all V2 mutation flag implemented, fail-closed allowlist preserved, manual complete still legacy, monitor surfaces the mode. No live mutation, no env change, no deploy; rollover/pending writes remain off.*
