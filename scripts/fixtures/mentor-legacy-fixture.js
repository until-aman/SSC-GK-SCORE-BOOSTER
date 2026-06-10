// scripts/fixtures/mentor-legacy-fixture.js — anonymised legacy workbook shape (Phase 2 Step 16). CommonJS.
//
// Mirrors the Phase 1B.1 VERIFIED structure WITHOUT any personal data or real
// task content: one reused PlanId, 5 plan rows / 5 generations, 3 tasks each,
// SequenceNumber restarting 1/2/3, 5 completed + 10 snoozed, generation 5 active,
// constant Version 'v1', no QuestionCount column, trailing-newline profile headers.
'use strict';

const EMAIL = 'student@example.test';
const PLAN_ID = 'MP_TEST_REUSED';

const GEN_CREATED_AT = [
  '2026-06-08T12:13:30.089Z', // g1
  '2026-06-08T12:19:16.660Z', // g2
  '2026-06-08T14:01:19.707Z', // g3
  '2026-06-08T14:01:20.314Z', // g4
  '2026-06-08T14:01:22.132Z', // g5 (active)
];

// Trailing-newline headers reproduce the confirmed Phase 1B.1 quality issue.
const PROFILE_HEADERS = [
  'Email', 'ExamTarget', 'DaysLeftRange', 'CustomDaysLeft', 'DailyGKTime', 'Pace', 'Goals',
  'SubjectStatusJSON', 'TopicsCompletedJSON', 'OnboardingCompletedAt', 'LastUpdatedAt',
  'OnboardingVersion', 'TopicStrengthJSON',
  'MentorPlanId\n', 'ActiveDayNumber', 'ProgressPercent\n', 'LastPlanRefreshAt\n',
  'PlanNeedsRebuild', 'MentorLastSyncAt', 'MentorCacheVersion',
];

function profileRow() {
  return [
    EMAIL, 'SSC CGL', '90-120', '', '30', 'standard', '{}',
    '{}', '{}', '2026-06-08T12:10:00.000Z', '2026-06-08T14:01:22.132Z',
    'v1', '{}',
    PLAN_ID, '1', '33', '2026-06-08T14:01:22.132Z',
    'FALSE', '2026-06-08T14:01:22.132Z', 'v1',
  ];
}

const PLAN_HEADERS = ['Email', 'PlanId', 'Status', 'Version', 'CreatedAt', 'UpdatedAt', 'ActiveDayNumber', 'ExamSnapshot', 'DaysLeftSnapshot', 'PaceSnapshot'];
function planRows() {
  return GEN_CREATED_AT.map((createdAt, i) => [
    EMAIL, PLAN_ID,
    i === GEN_CREATED_AT.length - 1 ? 'active' : 'invalid', // only g5 active
    'v1', createdAt, createdAt, '1', 'SSC CGL', '90-120', 'standard',
  ]);
}

// No QuestionCount column (confirmed absent in the workbook).
const TASK_HEADERS = ['Email', 'PlanId', 'TaskId', 'SequenceNumber', 'DayNumber', 'Type', 'Status', 'Subject', 'Topic', 'Title', 'CreatedAt', 'CompletedAt'];
const TYPES = ['revision_task', 'practice_task', 'mistake_recovery_task'];
const TOPICS = [
  ['Polity', 'Topic A'], ['Polity', 'Topic B'], ['History', 'Topic C'],
];
function taskRows() {
  const rows = [];
  GEN_CREATED_AT.forEach((createdAt, gi) => {
    for (let s = 0; s < 3; s++) {
      const seq = s + 1;                       // SequenceNumber restarts 1,2,3 each generation
      const completed = s === 0;               // one completed per generation -> 5 completed total
      const taskNo = gi * 3 + s + 1;           // 1..15 unique TaskIds
      rows.push([
        EMAIL, PLAN_ID, `TASK_${taskNo}`, String(seq), '1',
        TYPES[s], completed ? 'completed' : 'snoozed',
        TOPICS[s][0], TOPICS[s][1], `Task ${seq} (gen ${gi + 1})`,
        createdAt, completed ? createdAt : '',
      ]);
    }
  });
  return rows; // 15 rows: 5 completed, 10 snoozed
}

const TOPIC_HEADERS = ['Email', 'Subject', 'Topic', 'TheoryStatus', 'PracticeStatus', 'ConfidenceLevel', 'UpdatedAt'];
function topicStateRows() {
  return [
    [EMAIL, 'Polity', 'Topic A', 'done', 'in_progress', 'medium', '2026-06-08T13:00:00.000Z'],
    [EMAIL, 'Polity', 'Topic B', 'in_progress', 'not_started', 'low', '2026-06-08T13:05:00.000Z'],
    [EMAIL, 'History', 'Topic C', 'done', 'done', 'high', '2026-06-08T13:10:00.000Z'],
    [EMAIL, 'Geography', 'Topic D', 'not_started', 'not_started', 'low', '2026-06-08T13:15:00.000Z'],
  ];
}

function buildLegacyRawData() {
  return {
    profile: { headers: PROFILE_HEADERS, rows: [profileRow()] },
    plans: { headers: PLAN_HEADERS, rows: planRows() },
    tasks: { headers: TASK_HEADERS, rows: taskRows() },
    topicState: { headers: TOPIC_HEADERS, rows: topicStateRows() },
  };
}

module.exports = { EMAIL, PLAN_ID, GEN_CREATED_AT, buildLegacyRawData, PROFILE_HEADERS, PLAN_HEADERS, TASK_HEADERS, TOPIC_HEADERS };
