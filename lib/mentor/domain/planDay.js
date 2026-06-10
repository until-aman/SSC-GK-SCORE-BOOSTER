// lib/mentor/domain/planDay.js - canonical Mentor plan-day utilities (Phase 3). CommonJS.
//
// Pure date/day helpers. Server time is authoritative; timezone controls local
// calendar interpretation. Do not use elapsed milliseconds as the final day
// calculation.
'use strict';

const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY } = require('./enums');
const { diagnostic } = require('./types');

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_TOTAL_PLAN_DAYS = 45;
const MAX_TOTAL_PLAN_DAYS = 730;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeIanaTimezone(value, diagnostics = []) {
  const tz = String(value || '').trim();
  if (!tz) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TIMEZONE_DEFAULTED, DIAGNOSTIC_SEVERITY.INFO, { fallback: DEFAULT_TIMEZONE }));
    return DEFAULT_TIMEZONE;
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date('2026-01-01T00:00:00Z'));
    return tz;
  } catch {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TIMEZONE_INVALID, DIAGNOSTIC_SEVERITY.WARN, { fallback: DEFAULT_TIMEZONE }));
    return DEFAULT_TIMEZONE;
  }
}

function toLocalDateKey(value, timezone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isValidLocalDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [y, m, d] = String(value).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function localDateKeyToUtcDay(value) {
  const [y, m, d] = String(value).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

function differenceInLocalCalendarDays(startLocalDate, currentLocalDate) {
  if (!isValidLocalDateKey(startLocalDate) || !isValidLocalDateKey(currentLocalDate)) return 0;
  return localDateKeyToUtcDay(currentLocalDate) - localDateKeyToUtcDay(startLocalDate);
}

function clamp(min, value, max) {
  return Math.min(max, Math.max(min, value));
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0 || n > MAX_TOTAL_PLAN_DAYS) return null;
  return n;
}

function parseTotalPlanDays(daysLeftRange, customDaysLeft, diagnostics = []) {
  const custom = parsePositiveInteger(customDaysLeft);
  const raw = String(daysLeftRange || '').trim();
  const lower = raw.toLowerCase();

  if (custom && (lower.includes('custom') || lower === 'custom' || !raw)) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TOTAL_PLAN_DAYS_FROM_CUSTOM, DIAGNOSTIC_SEVERITY.INFO, { source: 'customDaysLeft' }));
    return custom;
  }

  const exact = parsePositiveInteger(raw);
  if (exact) return exact;

  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const startRaw = Number(range[1]);
    const start = parsePositiveInteger(range[1]);
    const end = parsePositiveInteger(range[2]);
    if (end && startRaw <= end) {
      const value = start || end;
      diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TOTAL_PLAN_DAYS_DERIVED_FROM_RANGE, DIAGNOSTIC_SEVERITY.INFO, { value, rule: start ? 'range_start' : 'range_end_for_zero_start' }));
      return value;
    }
  }

  const plus = raw.match(/^(\d+)\s*\+$/);
  if (plus) {
    const n = parsePositiveInteger(plus[1]);
    if (n) {
      diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TOTAL_PLAN_DAYS_DERIVED_FROM_RANGE, DIAGNOSTIC_SEVERITY.INFO, { value: n, rule: 'plus_start' }));
      return n;
    }
  }

  if (custom) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TOTAL_PLAN_DAYS_FROM_CUSTOM, DIAGNOSTIC_SEVERITY.INFO, { source: 'customDaysLeft_fallback' }));
    return custom;
  }

  diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TOTAL_PLAN_DAYS_INVALID, DIAGNOSTIC_SEVERITY.WARN, { fallback: DEFAULT_TOTAL_PLAN_DAYS }));
  return DEFAULT_TOTAL_PLAN_DAYS;
}

function derivePlanStartLocalDate({ canonicalPlanStartLocalDate, onboardingCompletedAt, activePlanCreatedAt, earliestPlanCreatedAt, timezone }, diagnostics = []) {
  if (isValidLocalDateKey(canonicalPlanStartLocalDate)) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_START_FROM_CANONICAL, DIAGNOSTIC_SEVERITY.INFO, {}));
    return { planStartLocalDate: canonicalPlanStartLocalDate, planStartSource: 'canonical_plan_start' };
  }
  if (onboardingCompletedAt && toLocalDateKey(onboardingCompletedAt, timezone)) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_START_FROM_ONBOARDING, DIAGNOSTIC_SEVERITY.INFO, {}));
    return { planStartLocalDate: toLocalDateKey(onboardingCompletedAt, timezone), planStartSource: 'onboarding_completed_at' };
  }
  if (activePlanCreatedAt && toLocalDateKey(activePlanCreatedAt, timezone)) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_START_FROM_CREATED_AT, DIAGNOSTIC_SEVERITY.WARN, { source: 'active_plan_created_at' }));
    return { planStartLocalDate: toLocalDateKey(activePlanCreatedAt, timezone), planStartSource: 'active_plan_created_at' };
  }
  if (earliestPlanCreatedAt && toLocalDateKey(earliestPlanCreatedAt, timezone)) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_START_FROM_CREATED_AT, DIAGNOSTIC_SEVERITY.WARN, { source: 'earliest_plan_created_at' }));
    return { planStartLocalDate: toLocalDateKey(earliestPlanCreatedAt, timezone), planStartSource: 'earliest_plan_created_at' };
  }
  diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_START_FALLBACK_DAY_ONE, DIAGNOSTIC_SEVERITY.WARN, {}));
  return { planStartLocalDate: '', planStartSource: 'fallback_day_one' };
}

function calculateCalendarDay({ planStartLocalDate, currentLocalDate, totalPlanDays }, diagnostics = []) {
  if (!isValidLocalDateKey(planStartLocalDate) || !isValidLocalDateKey(currentLocalDate)) return 1;
  const raw = differenceInLocalCalendarDays(planStartLocalDate, currentLocalDate) + 1;
  const clamped = clamp(1, raw, totalPlanDays);
  if (clamped !== raw) diagnostics.push(diagnostic(DIAGNOSTIC_CODE.CALENDAR_DAY_CLAMPED, DIAGNOSTIC_SEVERITY.WARN, { raw, clamped }));
  return clamped;
}

function deriveUnlockedDay(rawValue, totalPlanDays, diagnostics = []) {
  const n = parsePositiveInteger(rawValue);
  if (!n) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.UNLOCKED_DAY_INVALID, DIAGNOSTIC_SEVERITY.INFO, { fallback: 1 }));
    return 1;
  }
  if (n > totalPlanDays) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.UNLOCKED_DAY_INVALID, DIAGNOSTIC_SEVERITY.WARN, { raw: n, clamped: totalPlanDays }));
    return totalPlanDays;
  }
  diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_ACTIVE_DAY_IGNORED, DIAGNOSTIC_SEVERITY.INFO, { legacyActiveDayNumber: n, usedAs: 'unlockedDay' }));
  return n;
}

function calculateActivePlanDay({ calendarDay, unlockedDay, totalPlanDays }) {
  return Math.min(totalPlanDays, Math.max(calendarDay, unlockedDay || 1));
}

function calculatePlanEndState({ activePlanDay, totalPlanDays }, diagnostics = []) {
  const daysRemaining = Math.max(0, totalPlanDays - activePlanDay);
  const isPlanComplete = activePlanDay >= totalPlanDays;
  if (isPlanComplete) diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_END_REACHED, DIAGNOSTIC_SEVERITY.INFO, { totalPlanDays }));
  return { isPlanComplete, daysRemaining };
}

function calculatePlanDayState(input = {}) {
  const diagnostics = [];
  const serverNow = input.serverNow ? new Date(input.serverNow) : new Date();
  const serverGeneratedAt = Number.isFinite(serverNow.getTime()) ? serverNow.toISOString() : new Date().toISOString();
  const timezone = normalizeIanaTimezone(input.timezone, diagnostics);
  const explicitTotal = parsePositiveInteger(input.totalPlanDays);
  const totalPlanDays = explicitTotal || parseTotalPlanDays(input.daysLeftRange, input.customDaysLeft, diagnostics);
  const currentLocalDate = toLocalDateKey(serverGeneratedAt, timezone);
  const start = derivePlanStartLocalDate({
    canonicalPlanStartLocalDate: input.planStartLocalDate,
    onboardingCompletedAt: input.onboardingCompletedAt,
    activePlanCreatedAt: input.activePlanCreatedAt,
    earliestPlanCreatedAt: input.earliestPlanCreatedAt,
    timezone,
  }, diagnostics);
  const calendarDay = calculateCalendarDay({ planStartLocalDate: start.planStartLocalDate, currentLocalDate, totalPlanDays }, diagnostics);
  const unlockedDay = deriveUnlockedDay(input.legacyActiveDayNumber, totalPlanDays, diagnostics);
  const activePlanDay = calculateActivePlanDay({ calendarDay, unlockedDay, totalPlanDays });
  return {
    ...start,
    timezone,
    totalPlanDays,
    currentLocalDate,
    calendarDay,
    unlockedDay,
    activePlanDay,
    ...calculatePlanEndState({ activePlanDay, totalPlanDays }, diagnostics),
    serverGeneratedAt,
    diagnostics,
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  DEFAULT_TOTAL_PLAN_DAYS,
  normalizeIanaTimezone,
  toLocalDateKey,
  differenceInLocalCalendarDays,
  calculateCalendarDay,
  calculateActivePlanDay,
  calculatePlanEndState,
  derivePlanStartLocalDate,
  parseTotalPlanDays,
  deriveUnlockedDay,
  calculatePlanDayState,
  isValidLocalDateKey,
};
