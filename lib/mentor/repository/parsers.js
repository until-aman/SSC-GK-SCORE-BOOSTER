// lib/mentor/repository/parsers.js — pure read-time parsers (Phase 2 Steps 4,5,9,10). CommonJS.
//
// All functions are pure: they take raw {headers, rows} tab data and produce
// canonical objects + diagnostics. They NEVER write. Header access is by
// normalized name (no positional reads) except the explicit, logged fallback.
'use strict';

const { buildNormalizedHeaderMap, cell } = require('./headerNormalizer');
const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY, TASK_TYPE, TASK_STATUS, LEGACY_TASK_STATUS } = require('../domain/enums');
const { diagnostic } = require('../domain/types');

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const str = (v) => (v === undefined || v === null ? '' : String(v));

// ── Step 5: legacy plan-version parser ───────────────────────────────────────
function parseLegacyPlanVersion(raw) {
  const diagnostics = [];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_VERSION_PARSED, DIAGNOSTIC_SEVERITY.INFO, { raw: '', resolved: 1, reason: 'blank_default' }));
    return { version: 1, rawLegacyVersion: '', diagnostics };
  }
  const s = String(raw).trim();
  let m = s.match(/^v?(\d+)$/i); // "v1", "1", "v12"
  if (m) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_VERSION_PARSED, DIAGNOSTIC_SEVERITY.INFO, { raw: s, resolved: Number(m[1]) }));
    return { version: Number(m[1]), rawLegacyVersion: s, diagnostics };
  }
  // Invalid text → safe default 1 + WARN diagnostic (do not throw; non-critical).
  diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_VERSION_PARSED, DIAGNOSTIC_SEVERITY.WARN, { raw: s, resolved: 1, reason: 'unparseable' }));
  return { version: 1, rawLegacyVersion: s, diagnostics };
}

// ── Step 9: question-count derivation (read-time only; never writes) ─────────
const QUESTION_COUNT_BY_TYPE = {
  [TASK_TYPE.PRACTICE_TASK]: 25,
  [TASK_TYPE.REVISION_TASK]: 25,
  [TASK_TYPE.MISTAKE_RECOVERY_TASK]: 25,
};
function deriveQuestionCount(taskType, physicalValue, hasColumn) {
  if (hasColumn && physicalValue !== undefined && String(physicalValue).trim() !== '') {
    const n = Number(physicalValue);
    if (Number.isFinite(n)) return { questionCount: n, derived: false };
  }
  if (Object.prototype.hasOwnProperty.call(QUESTION_COUNT_BY_TYPE, taskType)) {
    return { questionCount: QUESTION_COUNT_BY_TYPE[taskType], derived: true };
  }
  return { questionCount: null, derived: true }; // never fabricate
}

// Map legacy raw status → canonical (Phase 1A §8: snoozed → pending).
function normalizeTaskStatus(rawStatus) {
  const s = str(rawStatus).trim().toLowerCase();
  if (s === LEGACY_TASK_STATUS.SNOOZED) return TASK_STATUS.PENDING;
  if (Object.values(TASK_STATUS).includes(s)) return s;
  if (Object.values(LEGACY_TASK_STATUS).includes(s)) return s; // active/completed/pending/blocked/expired pass through
  return s || TASK_STATUS.PENDING;
}

// ── Step 4: MentorProfile parser (header-based + logged positional fallback) ─
const PROFILE_REQUIRED = ['Email', 'OnboardingCompletedAt', 'MentorPlanId'];
const PROFILE_POSITIONAL = [ // legacy A2:M order (Phase 0 sheets.js:774-778) — fallback ONLY
  'Email', 'ExamTarget', 'DaysLeftRange', 'CustomDaysLeft', 'DailyGKTime', 'Pace', 'Goals',
  'SubjectStatusJSON', 'TopicsCompletedJSON', 'OnboardingCompletedAt', 'LastUpdatedAt',
  'OnboardingVersion', 'TopicStrengthJSON',
];

function parseProfile(rawSheet, email, opts = {}) {
  const diagnostics = [];
  const headers = (rawSheet && rawSheet.headers) || [];
  const rows = (rawSheet && rawSheet.rows) || [];
  const allowPositionalFallback = opts.allowPositionalFallback !== false;

  const map = buildNormalizedHeaderMap(headers, { required: PROFILE_REQUIRED });
  diagnostics.push(...map.diagnostics);

  // Header-based path (preferred). Usable when Email resolves and headers exist.
  const headerBasedUsable = headers.length > 0 && 'Email' in map.index;
  let row;
  let usedFallback = false;

  if (headerBasedUsable) {
    row = rows.find(r => str(cell(r, map, 'Email')) === email) || null;
  } else if (allowPositionalFallback) {
    // Fallback: positional A2:M (logged, behind compatibility). Last resort only.
    usedFallback = true;
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.POSITIONAL_FALLBACK_USED, DIAGNOSTIC_SEVERITY.WARN, { tab: 'MentorProfile' }));
    row = rows.find(r => str(r[0]) === email) || null;
  }

  if (!row) return { profile: null, diagnostics };

  const get = usedFallback
    ? (name) => row[PROFILE_POSITIONAL.indexOf(name)]
    : (name) => cell(row, map, name);

  const profile = {
    email: str(get('Email')),
    onboardingCompletedAt: str(get('OnboardingCompletedAt')),
    mentorPlanId: str(get('MentorPlanId')),
    examTarget: str(get('ExamTarget')),
    daysLeftRange: str(get('DaysLeftRange')),
    dailyGKTime: str(get('DailyGKTime')),
    pace: str(get('Pace')),
    activeDayNumber: num(get('ActiveDayNumber'), 1),
    planNeedsRebuild: String(get('PlanNeedsRebuild') || '').toUpperCase() === 'TRUE',
    rawLegacyCacheVersion: str(get('MentorCacheVersion')),
  };
  return { profile, diagnostics };
}

// ── MentorPlans parser ───────────────────────────────────────────────────────
const PLAN_REQUIRED = ['PlanId', 'Status', 'CreatedAt'];
function parsePlans(rawSheet, email) {
  const diagnostics = [];
  const headers = (rawSheet && rawSheet.headers) || [];
  const rows = (rawSheet && rawSheet.rows) || [];
  const map = buildNormalizedHeaderMap(headers, { required: PLAN_REQUIRED });
  diagnostics.push(...map.diagnostics);
  const plans = [];
  rows.forEach(r => {
    const planEmail = str(cell(r, map, 'Email'));
    if (email && planEmail && planEmail !== email) return;
    const planId = str(cell(r, map, 'PlanId'));
    if (!planId) { diagnostics.push(diagnostic(DIAGNOSTIC_CODE.MALFORMED_ROW_SKIPPED, DIAGNOSTIC_SEVERITY.WARN, { tab: 'MentorPlans', reason: 'missing PlanId' })); return; }
    const v = parseLegacyPlanVersion(cell(r, map, 'Version'));
    diagnostics.push(...v.diagnostics);
    plans.push({
      planId,
      status: str(cell(r, map, 'Status')).toLowerCase(),
      planVersion: v.version,
      rawLegacyVersion: v.rawLegacyVersion,
      createdAt: str(cell(r, map, 'CreatedAt')),
      updatedAt: str(cell(r, map, 'UpdatedAt')),
      activeDayNumber: num(cell(r, map, 'ActiveDayNumber'), 1),
      examSnapshot: str(cell(r, map, 'ExamSnapshot')),
      daysLeftSnapshot: str(cell(r, map, 'DaysLeftSnapshot')),
      paceSnapshot: str(cell(r, map, 'PaceSnapshot')),
    });
  });
  return { plans, diagnostics };
}

// ── MentorTasks parser ───────────────────────────────────────────────────────
const TASK_REQUIRED = ['TaskId', 'PlanId', 'Status', 'CreatedAt'];
function parseTasks(rawSheet, email, planId) {
  const diagnostics = [];
  const headers = (rawSheet && rawSheet.headers) || [];
  const rows = (rawSheet && rawSheet.rows) || [];
  const map = buildNormalizedHeaderMap(headers, { required: TASK_REQUIRED });
  diagnostics.push(...map.diagnostics);
  const hasQuestionCountColumn = 'QuestionCount' in map.index;
  const tasks = [];
  rows.forEach(r => {
    const taskEmail = str(cell(r, map, 'Email'));
    if (email && taskEmail && taskEmail !== email) return;
    const rowPlanId = str(cell(r, map, 'PlanId'));
    if (planId && rowPlanId !== planId) return;
    const taskId = str(cell(r, map, 'TaskId'));
    if (!taskId) { diagnostics.push(diagnostic(DIAGNOSTIC_CODE.MALFORMED_ROW_SKIPPED, DIAGNOSTIC_SEVERITY.WARN, { tab: 'MentorTasks', reason: 'missing TaskId' })); return; }
    const type = str(cell(r, map, 'Type')) || (str(cell(r, map, 'Reason')) === 'recent_mistakes' ? TASK_TYPE.PRACTICE_TASK : '');
    const qc = deriveQuestionCount(type, cell(r, map, 'QuestionCount'), hasQuestionCountColumn);
    if (qc.derived) diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_QUESTION_COUNT_DERIVED, DIAGNOSTIC_SEVERITY.INFO, { type, value: qc.questionCount }));
    tasks.push({
      taskId,
      planId: rowPlanId,
      sequenceNumber: num(cell(r, map, 'SequenceNumber'), 0),
      dayNumber: num(cell(r, map, 'DayNumber'), 1),
      type,
      rawLegacyStatus: str(cell(r, map, 'Status')).toLowerCase(),
      status: normalizeTaskStatus(cell(r, map, 'Status')),
      subject: str(cell(r, map, 'Subject')),
      topic: str(cell(r, map, 'Topic')),
      title: str(cell(r, map, 'Title')),
      questionCount: qc.questionCount,
      questionCountDerived: qc.derived,
      createdAt: str(cell(r, map, 'CreatedAt')),
      completedAt: str(cell(r, map, 'CompletedAt')),
    });
  });
  return { tasks, hasQuestionCountColumn, diagnostics };
}

// ── Step 10: StudentTopicState parser (dedupe newest by UpdatedAt) ───────────
const TOPIC_REQUIRED = ['Email', 'Subject', 'Topic'];
const VALID_THEORY = new Set(['done', 'in_progress', 'not_started', 'unknown']);
function parseTopicState(rawSheet, email) {
  const diagnostics = [];
  const headers = (rawSheet && rawSheet.headers) || [];
  const rows = (rawSheet && rawSheet.rows) || [];
  const map = buildNormalizedHeaderMap(headers, { required: TOPIC_REQUIRED });
  diagnostics.push(...map.diagnostics);
  const byKey = new Map();
  const raw = [];
  rows.forEach(r => {
    const rowEmail = str(cell(r, map, 'Email'));
    if (email && rowEmail && rowEmail !== email) return;
    const subject = str(cell(r, map, 'Subject'));
    const topic = str(cell(r, map, 'Topic'));
    raw.push(r);
    if (!subject || !topic) { diagnostics.push(diagnostic(DIAGNOSTIC_CODE.MALFORMED_ROW_SKIPPED, DIAGNOSTIC_SEVERITY.WARN, { tab: 'StudentTopicState', reason: 'blank subject/topic' })); return; }
    const theoryRaw = str(cell(r, map, 'TheoryStatus')).toLowerCase();
    const item = {
      subject, topic,
      theoryStatus: VALID_THEORY.has(theoryRaw) ? theoryRaw : 'unknown',
      practiceStatus: str(cell(r, map, 'PracticeStatus')).toLowerCase() || 'unknown',
      confidenceLevel: str(cell(r, map, 'ConfidenceLevel')).toLowerCase() || 'unknown',
      updatedAt: str(cell(r, map, 'UpdatedAt')),
    };
    const key = `${subject}|||${topic}`;
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, item); return; }
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.DUPLICATE_TOPIC_STATE, DIAGNOSTIC_SEVERITY.WARN, { subject, topic }));
    if (new Date(item.updatedAt || 0) >= new Date(existing.updatedAt || 0)) byKey.set(key, item); // keep newest
  });
  return { topicState: [...byKey.values()], rawRowCount: raw.length, diagnostics };
}

module.exports = {
  parseLegacyPlanVersion,
  deriveQuestionCount,
  normalizeTaskStatus,
  parseProfile,
  parsePlans,
  parseTasks,
  parseTopicState,
};
