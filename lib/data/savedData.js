import { fetchWithClientCache } from '@/lib/clientCache';
import { CACHE_TTL } from '@/lib/cachePolicy';

const SAVED_IDS_CACHE_KEY = 'saved_question_ids';
const SAVED_QUESTIONS_CACHE_KEY = 'saved_questions';

export function getGuestSavedQuestions() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem('ssc_saved_questions') || localStorage.getItem('savedQuestions');
    if (!raw) return [];
    const questions = JSON.parse(raw);
    return Array.isArray(questions) ? questions : [];
  } catch {
    return [];
  }
}

export async function getSavedQuestionIds({ forceRefresh = false, isLoggedIn = false } = {}) {
  if (!isLoggedIn) {
    return getGuestSavedQuestions()
      .map(q => q.questionId || q.id)
      .filter(Boolean);
  }

  return fetchWithClientCache({
    key: SAVED_IDS_CACHE_KEY,
    url: '/api/saved-questions/ids',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export async function getSavedQuestions({ forceRefresh = false, isLoggedIn = false } = {}) {
  if (!isLoggedIn) return getGuestSavedQuestions();

  return fetchWithClientCache({
    key: SAVED_QUESTIONS_CACHE_KEY,
    url: '/api/saved-questions',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}
