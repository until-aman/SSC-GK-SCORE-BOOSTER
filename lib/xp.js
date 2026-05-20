function computeLevel(totalXP) {
  const xp = Number(totalXP) || 0;
  if (xp >= 3000) return 'Legend';
  if (xp >= 1500) return 'Champion';
  if (xp >= 600)  return 'Expert';
  if (xp >= 200)  return 'Scholar';
  return 'Aspirant';
}

function computeXPEarned({ correctAnswers, totalQuestions, isFirstQuizOfDay }) {
  const base = totalQuestions >= 5 ? 10 : 0;
  const correctXP = Number(correctAnswers) * 2;
  const firstBonus = isFirstQuizOfDay ? 10 : 0;
  return base + correctXP + firstBonus;
}

module.exports = { computeLevel, computeXPEarned };
