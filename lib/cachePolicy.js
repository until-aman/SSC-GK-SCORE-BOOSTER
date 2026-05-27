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
};
