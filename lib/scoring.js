export const CORRECT_MARKS = 2;
export const WRONG_MARKS = -0.5;

export function calculateRawScore({ correct = 0, incorrect = 0 } = {}) {
  return (Number(correct) || 0) * CORRECT_MARKS + (Number(incorrect) || 0) * WRONG_MARKS;
}

export function calculateAccuracy({ correct = 0, totalQuestions = 0 } = {}) {
  const total = Number(totalQuestions) || 0;
  return total > 0 ? ((Number(correct) || 0) / total) * 100 : 0;
}

export function calculateMaxScore(totalQuestions = 0) {
  return (Number(totalQuestions) || 0) * CORRECT_MARKS;
}

export function formatScore(value = 0) {
  const score = Number(value) || 0;
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
