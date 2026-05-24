/**
 * fetchAI.js — All Gemini API calls go through here.
 * Every call has a hard 5-second AbortController timeout.
 * On timeout / error → returns { text: fallback, source: 'fallback' }
 * On success         → returns { text: aiText,   source: 'ai'       }
 */

const AI_TIMEOUT_MS = 3000; // change once to update everywhere

async function callAIWithTimeout(url, body, fallback) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return { text: fallback, source: 'fallback' };
    const data = await res.json();
    return { data, source: 'ai' };
  } catch {
    clearTimeout(tid);
    return { text: fallback, source: 'fallback' };
  }
}

/**
 * Explain a wrong answer.
 * Fallback → question.explanation from Google Sheet.
 */
export async function fetchAIExplain({ question, optionA, optionB, optionC, optionD, correctOption, userOption, sheetExplanation, subject, topic }) {
  const fallback = sheetExplanation || 'Review this concept in your study material.';
  const result = await callAIWithTimeout(
    '/api/ai/explain',
    { question, optionA, optionB, optionC, optionD, correctOption, userOption, explanation: sheetExplanation, subject, topic },
    fallback
  );
  if (result.source === 'fallback') return result;
  return {
    text: result.data?.aiExplanation || result.data?.fallback || fallback,
    source: 'ai',
  };
}

/**
 * Tip for a skipped question.
 * Fallback → question.explanation from Google Sheet.
 */
export async function fetchAITip({ question, correctOption, correctOptionText, sheetExplanation, subject, topic }) {
  const fallback = sheetExplanation || 'Review this concept in your study material.';
  const result = await callAIWithTimeout(
    '/api/ai/tip',
    { question, correctOption, correctOptionText, explanation: sheetExplanation, subject, topic },
    fallback
  );
  if (result.source === 'fallback') return result;
  return {
    text: result.data?.aiTip || result.data?.fallback || fallback,
    source: 'ai',
  };
}

/**
 * End-of-quiz performance summary.
 * Fallback → generic string built entirely from score data (no second network call).
 */
export async function fetchAISummary({ correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic }) {
  const accuracy = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;
  const fallback = `You scored ${rawScore} marks with ${accuracy}% accuracy (${correctAnswers} correct, ${incorrectAnswers} incorrect, ${skipped} skipped). Keep practicing to improve!`;

  const result = await callAIWithTimeout(
    '/api/ai/summary',
    { subject, topic, totalQuestions, correctAnswers, incorrectAnswers, skipped, rawScore, accuracy },
    fallback
  );
  if (result.source === 'fallback') return result;
  return {
    text: result.data?.aiSummary || fallback,
    source: 'ai',
  };
}
