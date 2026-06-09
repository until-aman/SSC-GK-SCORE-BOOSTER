export const CACHE_VERSION = 'ssc_gk_v1';

export const CACHE_TTL = {
  ONE_DAY:          24 * 60 * 60 * 1000,
  THIRTY_MINUTES:   30 * 60 * 1000,
  TEN_MINUTES:      10 * 60 * 1000,
  ONE_MINUTE:       60 * 1000,
};

export const CACHE_KEYS = {
  DASHBOARD_BOOTSTRAP:   'dashboard_bootstrap',
  USER_PROFILE:          'user_profile',
  WEEKLY_LEADERBOARD:    'leaderboard:weekly',
  DAILY_CHALLENGE:       (date) => `daily_challenge:${date}`,
  TOPICS:                (collection, subject) => `topics:${collection || 'default'}:${subject || 'all'}`,
  QUESTION_BANK:         (collection, subject) => `question_bank:${collection || 'general'}:${subject || 'all'}`,
  QUESTIONS:             (collection, subject, topic) =>
                           `questions:${collection || 'default'}:${subject || 'all'}:${topic || 'all'}`,
  GUEST_SAVED_QUESTIONS: 'guest:saved_questions',
  GUEST_PROFILE:         'guest:profile',
  HISTORY:               'history',
  // ── Step 9: account-scoped History caches (scope appended by buildUserScopedKey) ──
  HISTORY_LANDING:       'history_landing',
  HISTORY_SUMMARY:       'history_summary',
  HISTORY_QUIZZES:       (query) => `history_quizzes:${query || 'default'}`,
  HISTORY_QUESTIONS:     (query) => `history_questions:${query || 'default'}`,
  HISTORY_SUBJECTS:      'history_subjects',
  HISTORY_TOPICS:        (subject) => `history_topics:${subject || 'all'}`,
  HISTORY_SESSION:       (sessionId) => `history_session:${sessionId || 'none'}`,
  SCORE_HISTORY:         'score_history',
  // ── Step 10: account-scoped Analysis caches ──
  ANALYSIS_ACTIVITY:     'analysis_activity',
  ANALYSIS_INTEREST:     'analysis_interest',
  // ── Step 12: shared account-scoped profile + dream post ──
  // (USER_PROFILE base key already declared above; now the canonical shared key.)
  DREAM_POST:            'dream_post',
};
