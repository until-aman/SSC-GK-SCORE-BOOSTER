// lib/mentor/domain/types.js — canonical Mentor domain shapes (Phase 2). CommonJS.
//
// JSDoc typedefs + small factory helpers. These are the canonical shapes the
// repository produces; existing API code is NOT forced to consume them yet.
'use strict';

/**
 * @typedef {Object} RepositoryDiagnostic
 * @property {string} code   one of DIAGNOSTIC_CODE
 * @property {string} severity  'info' | 'warn' | 'error'
 * @property {Object} [detail]  non-PII context (counts, header names, codes)
 */

/**
 * @typedef {Object} RepositoryResult
 * @property {boolean} ok
 * @property {*} [data]
 * @property {RepositoryDiagnostic[]} diagnostics
 * @property {string} repositoryVersion
 */

/**
 * @typedef {Object} MentorProfile
 * @property {string} email
 * @property {string} onboardingCompletedAt
 * @property {string} mentorPlanId          active-plan pointer
 * @property {string} examTarget
 * @property {string} daysLeftRange
 * @property {string} dailyGKTime
 * @property {string} pace
 * @property {number} activeDayNumber        legacy frozen day (audit only)
 * @property {boolean} planNeedsRebuild
 * @property {string} rawLegacyCacheVersion
 */

/**
 * @typedef {Object} MentorPlan
 * @property {string} planId
 * @property {string} status                 PLAN_STATUS
 * @property {number} planVersion            parsed canonical integer
 * @property {string} rawLegacyVersion       e.g. "v1"
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} activeDayNumber        legacy stored (audit)
 * @property {string} examSnapshot
 * @property {string} daysLeftSnapshot
 * @property {string} paceSnapshot
 */

/**
 * @typedef {Object} MentorTask
 * @property {string} taskId
 * @property {string} planId
 * @property {string} generationBatchId      derived (read-time)
 * @property {number} generationOrdinal      derived (1..N)
 * @property {number} legacyTaskNumber       derived plan-wide stable number
 * @property {number} legacyCurrentGenerationDisplayOrder  derived 1..k for current gen
 * @property {number} sequenceNumber         raw legacy (untouched)
 * @property {number} dayNumber
 * @property {string} type
 * @property {string} status                 normalized canonical
 * @property {string} rawLegacyStatus
 * @property {string} subject
 * @property {string} topic
 * @property {string} title
 * @property {(number|null)} questionCount   derived; null when unknown
 * @property {boolean} questionCountDerived
 * @property {string} createdAt
 * @property {string} completedAt
 * @property {boolean} isCurrentGeneration
 * @property {boolean} isLegacyHidden        hidden from canonical pending
 */

/**
 * @typedef {Object} StudentTopicStateRow
 * @property {string} subject
 * @property {string} topic
 * @property {string} theoryStatus
 * @property {string} practiceStatus
 * @property {string} confidenceLevel
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} MentorRepositorySnapshot   (repository-level; NOT the final API snapshot)
 * @property {MentorProfile|null} profile
 * @property {MentorPlan|null} activePlan
 * @property {Object|null} activeGeneration
 * @property {MentorTask[]} currentTasks
 * @property {MentorTask[]} historicalTasks
 * @property {MentorTask[]} hiddenLegacyTasks
 * @property {MentorTask[]} completedEvidence
 * @property {MentorTask[]} canonicalPendingTasks
 * @property {MentorTask[]} pendingTasks
 * @property {number} pendingCount
 * @property {(MentorTask|null)} featuredPendingTask
 * @property {number} featuredPendingForCalendarDay
 * @property {string} pendingNudgeTier
 * @property {number} lastProcessedCalendarDay
 * @property {boolean} rolloverRequired
 * @property {string} rolloverProcessedAt
 * @property {StudentTopicStateRow[]} studentTopicState
 * @property {RepositoryDiagnostic[]} diagnostics
 * @property {string} repositoryVersion
 */

const REPOSITORY_VERSION = 'mentor-repo-v2.0.0-phase2';

function diagnostic(code, severity, detail) {
  return { code, severity, detail: detail || {} };
}

function emptySnapshot() {
  return {
    profile: null,
    activePlan: null,
    activeGeneration: null,
    currentTasks: [],
    historicalTasks: [],
    hiddenLegacyTasks: [],
    completedEvidence: [],
    canonicalPendingTasks: [],
    pendingTasks: [],
    pendingCount: 0,
    featuredPendingTask: null,
    featuredPendingForCalendarDay: 1,
    pendingNudgeTier: 'hidden',
    lastProcessedCalendarDay: 1,
    rolloverRequired: false,
    rolloverProcessedAt: '',
    studentTopicState: [],
    planStartLocalDate: '',
    planStartSource: '',
    timezone: '',
    totalPlanDays: 0,
    calendarDay: 1,
    unlockedDay: 1,
    activePlanDay: 1,
    isPlanComplete: false,
    daysRemaining: 0,
    serverGeneratedAt: '',
    diagnostics: [],
    repositoryVersion: REPOSITORY_VERSION,
  };
}

module.exports = { REPOSITORY_VERSION, diagnostic, emptySnapshot };
