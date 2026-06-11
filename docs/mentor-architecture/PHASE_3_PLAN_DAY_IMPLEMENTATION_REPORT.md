# Phase 3 - Canonical Mentor Plan-Day Calculation Implementation Report

**Project:** SSC Mentor / SSC GK Score Booster  
**Active app folder:** `festive-engelbart-5368c8`  
**Scope:** Canonical local-date day calculation, repository snapshot extension, read-only shadow validation, tests.  
**Source precedence:** Phase 1A > Phase 1 > Phase 1C > Phase 1B.1 > Phase 2 report > Phase 1B > Phase 0.  
**Date:** 2026-06-10

---

## 1. Files Created

1. `lib/mentor/domain/planDay.js`
   - Pure canonical date/day utilities.
   - Uses authoritative server time and IANA timezone local-date conversion.
   - No Google Sheet writes.

2. `scripts/test-mentor-plan-day.js`
   - Phase 3 test harness.
   - Covers calendar edge cases, total-day parsing, fallback sources, invariant failures, shadow redaction, and feature flags.

3. `docs/mentor-architecture/PHASE_3_PLAN_DAY_IMPLEMENTATION_REPORT.md`
   - This implementation report.

## 2. Files Modified

1. `lib/mentor/domain/enums.js`
   - Added Phase 3 diagnostic codes.

2. `lib/mentor/domain/types.js`
   - Extended repository snapshot shape with canonical day fields.

3. `lib/mentor/domain/invariants.js`
   - Added day-state snapshot invariants.

4. `lib/mentor/repository/parsers.js`
   - Reads optional legacy/future fields such as `CustomDaysLeft`, `Timezone`, `PlanStartLocalDate`, `TotalPlanDays`, and `UnlockedDay` by normalized header name.

5. `lib/mentor/repository/mentorRepository.js`
   - Derives canonical day state inside the read-only repository snapshot.

6. `lib/mentor/repository/featureFlags.js`
   - Added `MENTOR_CANONICAL_DAY_READ`, default false.

7. `lib/mentor/repository/shadowCompare.js`
   - Added non-sensitive canonical day aggregates to shadow output.

8. `pages/api/mentor/plan.js`
   - Added default-off `MENTOR_CANONICAL_DAY_READ` response integration.
   - Existing user-facing response remains unchanged when the flag is false.

9. `package.json`
   - Added `test:mentor-plan-day`.

## 3. Day Formula

Implemented canonical formula:

```text
calendarDay =
  clamp(
    1,
    localCalendarDateDifference(planStartLocalDate, currentLocalDate) + 1,
    totalPlanDays
  )

activePlanDay =
  min(
    totalPlanDays,
    max(calendarDay, unlockedDay)
  )
```

The calculation compares local calendar date keys, not raw elapsed milliseconds.

## 4. Timezone Handling

- Authoritative timezone is the plan/profile timezone when present.
- Legacy/default timezone is `Asia/Kolkata`.
- Invalid or missing timezones fall back to `Asia/Kolkata`.
- IANA conversion is performed with `Intl.DateTimeFormat`.
- DST zones are handled through local-date conversion before date difference.
- Browser/device time is not used by the repository day calculation.

## 5. Legacy Start-Date Fallback

Implemented fallback order:

1. `canonical_plan_start`
2. `onboarding_completed_at`
3. `active_plan_created_at`
4. `earliest_plan_created_at`
5. `fallback_day_one`

The derived start date is read-time only and is not written back to the Sheet.

## 6. Total-Day Parsing

Implemented deterministic total-plan-day parsing:

- exact integer
- numeric string
- ranges: `0-15`, `16-30`, `31-45`, `46-60`
- plus range: `60+`
- custom days via `CustomDaysLeft`
- malformed/missing values fall back to `45` with a diagnostic
- zero/negative/excessively large values are rejected

Compatibility rule:
- Range starts are used where positive (`46-60 -> 46`).
- `0-15` uses the upper bound because zero is not a valid total plan length.

## 7. Unlocked-Day Handling

- Frozen legacy `ActiveDayNumber` is no longer used as `calendarDay`.
- It is interpreted only as a legacy unlocked-day signal.
- Missing/invalid values default to `1`.
- Values above total plan days are clamped.
- Diagnostic `LEGACY_ACTIVE_DAY_IGNORED` is emitted when the legacy field is observed.
- No legacy field is overwritten.

## 8. Repository Snapshot Fields

Repository snapshots now include:

```javascript
{
  planStartLocalDate,
  planStartSource,
  timezone,
  totalPlanDays,
  calendarDay,
  unlockedDay,
  activePlanDay,
  isPlanComplete,
  daysRemaining,
  serverGeneratedAt
}
```

These fields are derived read-time fields.

## 9. Diagnostics

Added structured diagnostics:

- `LEGACY_ACTIVE_DAY_IGNORED`
- `PLAN_START_FROM_CANONICAL`
- `PLAN_START_FROM_ONBOARDING`
- `PLAN_START_FROM_CREATED_AT`
- `PLAN_START_FALLBACK_DAY_ONE`
- `TIMEZONE_DEFAULTED`
- `TIMEZONE_INVALID`
- `TOTAL_PLAN_DAYS_DERIVED_FROM_RANGE`
- `TOTAL_PLAN_DAYS_FROM_CUSTOM`
- `TOTAL_PLAN_DAYS_INVALID`
- `CALENDAR_DAY_CLAMPED`
- `UNLOCKED_DAY_INVALID`
- `PLAN_END_REACHED`

Diagnostics contain only non-sensitive details.

## 10. Feature Flags

Existing flags:

- `MENTOR_REPO_V2`
- `MENTOR_REPO_V2_SHADOW`

New flag:

- `MENTOR_CANONICAL_DAY_READ`

Defaults:

- all false

Interaction:

- `MENTOR_REPO_V2=false`: repository does not serve production reads.
- `MENTOR_REPO_V2_SHADOW=true`: repository reads run as read-only shadow validation.
- `MENTOR_CANONICAL_DAY_READ=true`: `/api/mentor/plan` may include canonical day fields from the repository response.
- With all flags false, existing UI/API behavior is unchanged.

## 11. Test Results

Commands run:

```text
npm run test:mentor-plan-day
npm run test:mentor-repo
node scripts/test-mentor-api-optimization.js
npm run lint
npm run build
```

Results:

- New Phase 3 tests: 25 passed, 0 failed.
- Existing repository tests: 22 passed, 0 failed.
- Existing Mentor optimization tests: 42 passed, 0 failed.
- Lint: passed with pre-existing warnings in `pages/onboarding-slides.js` and `pages/quiz-setup.js`.
- Production build: passed.

## 12. Build Result

`npm run build` completed successfully.

## 13. Shadow-Read Result

Live Google Sheet shadow validation was not performed in this run.

Reason:

- This phase added the read-only shadow fields and tests.
- No authenticated live request was made from this environment.
- No Sheet write or cache mutation occurred.

Expected affected-user result from the verified workbook shape:

```text
legacyStoredActiveDay = 1
planStartLocalDate = 2026-06-08
server date in Asia/Kolkata = 2026-06-10
canonicalCalendarDay = 3
canonicalActivePlanDay = 3
```

## 14. No-Write Confirmation

- No Google Sheet cell was written.
- No Sheet tab was created.
- No Sheet column was added.
- No Sheet row was updated, deleted, reordered, or renamed.
- No task status was changed.
- No plan was generated.
- No cache was overwritten by shadow validation.

## 15. Known Limitations

- The canonical day fields are computed in the repository snapshot, but production visible Mentor day remains unchanged while `MENTOR_CANONICAL_DAY_READ=false`.
- Daily rollover mutations are intentionally not implemented.
- Pending lifecycle and task state-machine writes are intentionally not implemented.
- Legacy `ActiveDayNumber` is still present physically for audit.
- Live Sheet shadow validation requires an authenticated runtime request with `MENTOR_REPO_V2_SHADOW=true`.

## 16. Rollback Method

Leave all flags false:

```text
MENTOR_REPO_V2=false
MENTOR_REPO_V2_SHADOW=false
MENTOR_CANONICAL_DAY_READ=false
```

With flags off, production user-facing behavior remains unchanged. Since no data migration ran, there is no data rollback.

## 17. Phase 4 Readiness

Ready.

Phase 4 can build on this by implementing daily rollover/pending lifecycle/task state-machine writes behind separate guarded mutations. Phase 3 intentionally stops at canonical day computation, validation, tests, and report.

