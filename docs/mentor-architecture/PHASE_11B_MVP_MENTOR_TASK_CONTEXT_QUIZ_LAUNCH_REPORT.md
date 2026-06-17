# Phase 11B-MVP Mentor Task Context Quiz Launch Report

## 1. Current behavior found

Mentor task primary clicks were handled in `pages/mentor.js`.

| Task type | Previous CTA behavior | API called | Route opened | Context risk |
| --- | --- | --- | --- | --- |
| `practice_task` | Opened count modal, then launched `/quiz` | `/api/mentor/task-action` with `launch_practice` | `/quiz?subject=...&topic=...&collection=PYQ` | Subject/topic were assembled inline with no shared validation or zero-question preflight. |
| `mistake_recovery_task` | Recorded launch, then routed to History mistakes | `/api/mentor/task-action` with `launch_practice` | `/history/mistakes` | Could become a generic mistakes page instead of task-context quiz. |
| `revision_task` | Opened manual completion modal | `/api/mentor/task-action` with `complete` after confirmation | No quiz route | Could complete without quiz-return. |
| `theory_task` | Manual completion fallback | `/api/mentor/task-action` with `complete` | No quiz route | Non-quiz. |
| `coverage_check` | Coverage modal | `/api/mentor/task-action` response/complete flow | No quiz route | Non-quiz. |
| `confidence_check` | Confidence modal | `/api/mentor/task-action` response/complete flow | No quiz route | Non-quiz. |
| `feedback_task` | Feedback modal | `/api/mentor/task-action` response flow | No quiz route | Non-quiz. |
| `pace_unlock_task` | Manual completion fallback | `/api/mentor/task-action` complete flow | No quiz route | Non-quiz. |

## 2. Task types changed

Quiz-launchable task types are now:

- `practice_task`
- `mistake_recovery_task`
- `revision_task`

Non-quiz tasks remain blocked from quiz launch:

- `coverage_check`
- `confidence_check`
- `feedback_task`
- `pace_unlock_task`

## 3. New resolver behavior

Added `lib/mentorQuizLaunchContext.cjs` with:

- `resolveMentorQuizLaunchContext(task, options)`
- `isMentorQuizLaunchableTask(task)`

The resolver returns:

```json
{
  "source": "mentor",
  "taskId": "task id",
  "planId": "plan id",
  "subject": "resolved subject",
  "topic": "resolved topic",
  "mode": "normal_practice | repeated_mistakes | revision",
  "questionSource": "questions | repeated_mistakes",
  "questionCount": 25,
  "locked": true
}
```

Missing subject blocks launch for normal/revision practice. Missing topic resolves to `All`, because the current `/api/questions` route supports subject-level quizzes with `topic=All`.

## 4. Mapping from task type to quiz mode

| Task | Mode | Question source |
| --- | --- | --- |
| `practice_task` | `normal_practice` | `/api/questions` |
| `practice_task` with `reason=recent_mistakes` | `repeated_mistakes` | `/api/history/reattempt-filtered` |
| `mistake_recovery_task` | `repeated_mistakes` | `/api/history/reattempt-filtered` |
| `revision_task` | `revision` | `/api/questions` |

`revision` uses the existing normal question source. No new backend mode or launchpad was added.

## 5. APIs reused

- `/api/questions` for normal practice and revision preflight.
- `/api/history/reattempt-filtered` for repeated/wrong mistake practice.
- `/api/mentor/task-action` with `launch_practice` to record launch only.
- `/api/mentor/quiz-return` remains the only Mentor quiz completion sync path.

## 6. Route behavior

The MVP uses direct quiz launch.

Normal/revision tasks route to:

```text
/quiz?subject=...&topic=...&count=...&collection=...&mode=...&sourcePage=mentor&sourceScreen=mentor_plan&sourceTaskId=...&planId=...&returnUrl=/mentor
```

Mistake tasks route through existing History quiz mode:

```text
/quiz?mode=history&count=...&sourcePage=mentor&sourceScreen=mentor_plan&sourceTaskId=...&planId=...&returnUrl=/mentor
```

and store resolved questions in `sessionStorage.ssc_history_quiz_questions`.

## 7. Mentor return context preservation

Before routing, `sessionStorage.ssc_mentor_return_context` is written with:

- `sourcePage=mentor`
- `sourceScreen=mentor_plan`
- `sourceTaskId`
- `planId`
- `returnUrl=/mentor`
- `subject`
- `topic`
- `mode`
- `questionSource`
- `questionCount`

`pages/quiz.js` now also preserves Mentor context inside restored History quiz sessions so refresh recovery keeps `taskId` and `planId`.

## 8. Zero-state behavior

Before quiz route:

- Normal/revision tasks preflight `/api/questions`.
- Mistake tasks preflight `/api/history/reattempt-filtered`.

If no normal questions are found:

```text
No questions found for this topic.
```

If no mistake questions are found:

```text
No mistake questions found for this topic. Try normal practice instead.
```

The user is not silently routed to a generic quiz.

## 9. Tests/build result

Added `scripts/test-mentor-quiz-launch.js` and `npm run test:mentor-quiz-launch`.

Coverage:

- `practice_task` context.
- `mistake_recovery_task` context.
- repeated-mistake placeholder context.
- `revision_task` context.
- non-quiz task blocking.
- missing subject safe block.
- subject-level `All` topic support.
- `taskId`/`planId` preservation.
- no completion on launch.
- `quiz-return` completion path.
- zero-question messages.

Final command results are recorded in the final response.

## 10. No new Sheet tabs/columns confirmation

No Google Sheet tabs were created.

No Google Sheet columns were added.

No Sheets mutation or rollover logic was changed.

## 11. Remaining gap for full central launchpad

This phase does not build a central Quiz Launchpad. It only normalizes Mentor task quiz launch context and routes through the existing quiz/history APIs. A future launchpad can reuse the resolver output as the Mentor launch contract.
