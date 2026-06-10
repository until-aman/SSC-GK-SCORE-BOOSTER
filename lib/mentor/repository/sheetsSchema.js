// lib/mentor/repository/sheetsSchema.js - Mentor Sheets v2 transitional schema.
// CommonJS. Pure definitions + validation helpers only; no live Sheet access.
'use strict';

const crypto = require('crypto');
const { buildNormalizedHeaderMap, normalizeHeader } = require('./headerNormalizer');

const SCHEMA_VERSION = 'mentor-sheets-v2';

const TABS = Object.freeze({
  PROFILE: 'MentorProfile',
  PLANS: 'MentorPlans',
  TASKS: 'MentorTasks',
  LOGS: 'MentorTaskLogs',
  TOPIC_STATE: 'StudentTopicState',
  MUTATION_REQUESTS: 'MentorMutationRequests',
  SCHEMA: 'MentorSchema',
});

const FIELD_CLASS = Object.freeze({
  REQUIRED: 'required_before_mutation_activation',
  OPTIONAL: 'optional_compatibility_field',
  DEFERRED: 'deferred_until_supabase',
});

const currentColumns = Object.freeze({
  [TABS.PROFILE]: [
    'Email', 'ExamTarget', 'DaysLeftRange', 'CustomDaysLeft', 'DailyGKTime', 'Pace', 'Goals',
    'SubjectStatusJSON', 'TopicsCompletedJSON', 'OnboardingCompletedAt', 'LastUpdatedAt',
    'OnboardingVersion', 'TopicStrengthJSON', 'MentorPlanId', 'ActiveDayNumber',
    'ProgressPercent', 'LastPlanRefreshAt', 'PlanNeedsRebuild', 'MentorLastSyncAt',
    'MentorCacheVersion',
  ],
  [TABS.PLANS]: [
    'PlanId', 'Email', 'UserId', 'Version', 'Status', 'ExamSnapshot', 'DaysLeftSnapshot',
    'PaceSnapshot', 'ActiveDayNumber', 'ProgressPercent', 'LastGeneratedFromStateVersion',
    'LastRefreshAt', 'CreatedAt', 'UpdatedAt',
  ],
  [TABS.TASKS]: [
    'TaskId', 'PlanId', 'Email', 'UserId', 'DayNumber', 'SequenceNumber', 'Type', 'Subject',
    'Topic', 'Title', 'MentorMessage', 'Reason', 'WhyThisText', 'PrimaryAction',
    'SecondaryAction', 'Status', 'IsRequiredForUnlock', 'DependsOnTaskIds', 'Source',
    'SourceReference', 'SnoozeCount', 'SnoozedUntil', 'CreatedAt', 'ActivatedAt',
    'CompletedAt', 'UpdatedAt',
  ],
  [TABS.LOGS]: [
    'LogId', 'TaskId', 'PlanId', 'Email', 'UserId', 'ActionType', 'ActionValue',
    'CreatedAt', 'SourcePage', 'QuizSessionId', 'Notes',
  ],
  [TABS.TOPIC_STATE]: [
    'Email', 'UserId', 'Subject', 'Topic', 'TheoryStatus', 'PracticeStatus',
    'ConfidenceLevel', 'QuestionsPracticedSelfReported', 'LastTheoryUpdatedAt',
    'LastPracticeUpdatedAt', 'LastConfidenceUpdatedAt', 'LastQuizAttemptAt',
    'RecentAccuracy', 'RevisionGapDays', 'MentorPriorityScore', 'StateVersion', 'UpdatedAt',
  ],
});

const additiveColumns = Object.freeze({
  [TABS.PROFILE]: [
    { name: 'ActivePlanVersion', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'profile_pointer' },
    { name: 'Timezone', class: FIELD_CLASS.REQUIRED, defaultValue: 'Asia/Kolkata', owner: 'profile_default' },
    { name: 'SnapshotRevision', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'cache_consistency' },
    { name: 'PlanStartLocalDate', class: FIELD_CLASS.OPTIONAL, defaultValue: '', owner: 'legacy_compatibility' },
    { name: 'LastProcessedCalendarDay', class: FIELD_CLASS.OPTIONAL, defaultValue: '', owner: 'plan_mirror' },
    { name: 'UnlockedDay', class: FIELD_CLASS.OPTIONAL, defaultValue: '', owner: 'plan_mirror' },
  ],
  [TABS.PLANS]: [
    { name: 'PlanVersion', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'plan_identity' },
    { name: 'GenerationId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'generation_isolation' },
    { name: 'TaskSetRevision', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'snapshot_revision' },
    { name: 'NextTaskNumber', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'task_number_reservation' },
    { name: 'Timezone', class: FIELD_CLASS.REQUIRED, defaultValue: 'Asia/Kolkata', owner: 'calendar' },
    { name: 'PlanStartLocalDate', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'calendar' },
    { name: 'TotalPlanDays', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'calendar' },
    { name: 'UnlockedDay', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'calendar' },
    { name: 'LastProcessedCalendarDay', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'rollover' },
    { name: 'LastDailyRolloverAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'rollover' },
    { name: 'FeaturedPendingTaskId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'FeaturedPendingForCalendarDay', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'GenerationStatus', class: FIELD_CLASS.REQUIRED, defaultValue: 'succeeded', owner: 'generation' },
    { name: 'RowVersion', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'optimistic_locking' },
    { name: 'SupersededByPlanId', class: FIELD_CLASS.OPTIONAL, defaultValue: '', owner: 'replacement' },
    { name: 'SupersededAt', class: FIELD_CLASS.OPTIONAL, defaultValue: '', owner: 'replacement' },
  ],
  [TABS.TASKS]: [
    { name: 'PlanVersion', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'plan_identity' },
    { name: 'GenerationId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'generation_isolation' },
    { name: 'TaskNumber', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'stable_numbering' },
    { name: 'QuestionCount', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'quiz_launch' },
    { name: 'OriginalScheduledDay', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'ScheduledLocalDate', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'calendar' },
    { name: 'PendingReason', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'MovedToPendingAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'NextEligibleAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'quick_check_deferral' },
    { name: 'NextEligibleResurfaceAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'ResurfacedCount', class: FIELD_CLASS.REQUIRED, defaultValue: '0', owner: 'pending' },
    { name: 'LastResurfacedAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'pending' },
    { name: 'CompletionSource', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'completion' },
    { name: 'LinkedQuizSessionId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'quiz_reconciliation' },
    { name: 'ParentTaskId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'task_relationship' },
    { name: 'RelatedTaskId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'task_relationship' },
    { name: 'TriggerReason', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'task_relationship' },
    { name: 'CancellationReason', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'cancellation' },
    { name: 'RowVersion', class: FIELD_CLASS.REQUIRED, defaultValue: '1', owner: 'optimistic_locking' },
  ],
  [TABS.LOGS]: [
    { name: 'EventId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'event_identity' },
    { name: 'FromStatus', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'event_audit' },
    { name: 'ToStatus', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'event_audit' },
    { name: 'CanonicalAction', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'event_audit' },
    { name: 'IdempotencyKey', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'RequestId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'trace' },
    { name: 'EventPayloadJSON', class: FIELD_CLASS.REQUIRED, defaultValue: '{}', owner: 'event_payload' },
  ],
  [TABS.MUTATION_REQUESTS]: [
    { name: 'IdempotencyKey', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'UserScopeHash', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'PlanId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'TaskId', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'Action', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'PayloadHash', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'Status', class: FIELD_CLASS.REQUIRED, defaultValue: 'started', owner: 'idempotency' },
    { name: 'ResultJSON', class: FIELD_CLASS.REQUIRED, defaultValue: '{}', owner: 'idempotency' },
    { name: 'CreatedAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'CompletedAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
    { name: 'ExpiresAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'idempotency' },
  ],
  [TABS.SCHEMA]: [
    { name: 'SchemaName', class: FIELD_CLASS.REQUIRED, defaultValue: 'mentor', owner: 'schema_marker' },
    { name: 'SchemaVersion', class: FIELD_CLASS.REQUIRED, defaultValue: '2', owner: 'schema_marker' },
    { name: 'AppliedAt', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'schema_marker' },
    { name: 'ManifestHash', class: FIELD_CLASS.REQUIRED, defaultValue: '', owner: 'schema_marker' },
  ],
});

const requiredColumns = Object.freeze(Object.fromEntries(
  Object.entries(additiveColumns).map(([tab, cols]) => [tab, cols.filter(c => c.class === FIELD_CLASS.REQUIRED).map(c => c.name)])
));

function allColumnsForTab(tabName) {
  return [...(currentColumns[tabName] || []), ...(additiveColumns[tabName] || []).map(c => c.name)];
}

function additiveForTab(tabName, kind) {
  const cols = additiveColumns[tabName] || [];
  if (!kind) return cols.map(c => c.name);
  return cols.filter(c => c.class === kind).map(c => c.name);
}

function fingerprintHeaders(headers = []) {
  return crypto.createHash('sha256').update(JSON.stringify(headers || [])).digest('hex');
}

function manifestHash(manifest) {
  const copy = { ...(manifest || {}) };
  delete copy.manifestHash;
  return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

function inspectTabHeaders(tabName, headers = []) {
  const known = allColumnsForTab(tabName);
  const headerMap = buildNormalizedHeaderMap(headers, { required: (currentColumns[tabName] || []).filter(Boolean) });
  const existingNormalized = new Set(headerMap.normalizedNames.filter(Boolean));
  const missingAdditiveColumns = (additiveColumns[tabName] || [])
    .filter(col => !existingNormalized.has(col.name))
    .map(col => ({ ...col }));
  const duplicateCanonicalHeaders = headerMap.ambiguousHeaders || [];
  return {
    tabName,
    physicalHeaders: [...(headers || [])],
    normalizedHeaders: [...headerMap.normalizedNames],
    headerFingerprint: fingerprintHeaders(headers),
    missingAdditiveColumns,
    duplicateCanonicalHeaders,
    hasBlockingHeaderError: headerMap.hasAmbiguous || duplicateCanonicalHeaders.length > 0,
    unknownExistingColumns: headerMap.normalizedNames.filter(h => h && !known.includes(h)),
    diagnostics: headerMap.diagnostics,
  };
}

function validateRequiredColumns(headers = [], tabName) {
  const headerMap = buildNormalizedHeaderMap(headers, { required: requiredColumns[tabName] || [] });
  return {
    ok: !headerMap.hasAmbiguous && headerMap.missingRequired.length === 0,
    missingRequired: headerMap.missingRequired,
    ambiguousHeaders: headerMap.ambiguousHeaders,
    headerMap,
  };
}

module.exports = {
  SCHEMA_VERSION,
  TABS,
  FIELD_CLASS,
  currentColumns,
  additiveColumns,
  requiredColumns,
  allColumnsForTab,
  additiveForTab,
  normalizeHeader,
  inspectTabHeaders,
  validateRequiredColumns,
  fingerprintHeaders,
  manifestHash,
};
