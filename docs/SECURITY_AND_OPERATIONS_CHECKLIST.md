# Security & Operations Checklist (Step 17)

Legend: ✅ verified (code/repo) · ⏳ deferred to staging/deploy owner · ⚠️ note.

| # | Item | Status | Evidence / Note |
|---|---|---|---|
| 1 | GitHub repo exposure | ⏳ | Repo visibility is an account setting — confirm private or that no secrets are present (see #2). |
| 2 | No committed secrets | ✅ | No `BEGIN PRIVATE KEY` / `AIza…` / `"private_key"` in tracked source (only the detector regex in a test). `.env.local` gitignored + untracked; `.env.example` is a template. |
| 3 | Service-account permissions limited | ⏳ | Grant the staging SA access to the **test Sheet only**; production SA to production Sheet only. |
| 4 | Staging/production Sheet separation | ⏳ | Hard gate enforced in tooling (write tests refuse without confirmed test Sheet). |
| 5 | API routes derive identity from session | ✅ | All authed routes use `getServerSession`; mutations use session email, never a client-supplied email (score/saved/notify-interest/dream-post verified). |
| 6 | Write payload validation | ✅ | e.g. saved (questionId+question+correctOption A–D+options), dream-post (2–40 chars), notify-interest (collection required), complete (answer validation). |
| 7 | Idempotency for critical writes | ✅ (harness) / ⏳ (live) | `quizSessionExists` + `hasDuplicateScore`; saved email+questionId check + in-flight guard; notify-interest email+collection check. Confirm on staging via write-idempotency.js. |
| 8 | Production diagnostics silent | ✅ | All `[apidiag]`/deprecation logs gated by `IS_DEV`/`NODE_ENV !== 'production'`. |
| 9 | Backup exists | ⏳ | Take a staging Sheet backup before write tests; production backup before launch. |
| 10 | Rollback commit/tag | ⏳ | Tag the current `5d402bb` as the known-good rollback point. |
| 11 | Vercel env vars configured | ⏳ | `GOOGLE_SHEET_ID`, SA creds, `GEMINI_API_KEY`, `NEXTAUTH_*`, optional `KV_*` — set per environment. |
| 12 | Custom domain / HTTPS | ⏳ | Vercel provides HTTPS; confirm domain. |
| 13 | Error monitoring / log access | ⏳ | Enable Vercel logs / an error monitor for launch. |
| 14 | Google Sheet quota awareness | ⚠️ | Sheets read/write quotas are the MVP bottleneck (see capacity estimate). Monitor 429s. |
| 15 | Privacy copy / terms | ⏳ | App collects email + activity → ensure a basic privacy note/terms before public launch. |
| 16 | Feedback/report not trivially spammable | ⚠️ | `/api/feedback`, `/api/report-question` are session-gated; add rate-limiting/monitoring before broad launch. |
| 17 | `/api/score` compatibility monitored | ✅/⏳ | Retained, idempotent, dev deprecation log; monitor hit count, remove after zero hits. |
| 18 | `/api/config` safe | ✅ | Returns only allowlisted `getPublicConfig` (no Sheet IDs/keys/secrets). |
| 19 | Public repo contains no `.env.local` | ✅ | Untracked + gitignored. |
| 20 | Sheet not publicly editable | ⏳ | Confirm Sheet sharing is restricted to the service account(s). |

**Code-level security: PASS.** Deployment/operational items (⏳) are the launch owner's responsibility and must be completed on staging/production. No credentials were rotated or modified.
