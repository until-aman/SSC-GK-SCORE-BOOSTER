function computeLevel(totalXP) {
  const xp = Number(totalXP) || 0;
  if (xp >= 3000) return 'Legend';
  if (xp >= 1500) return 'Champion';
  if (xp >= 600)  return 'Expert';
  if (xp >= 200)  return 'Scholar';
  return 'Aspirant';
}

// Bonus XP awarded the moment a streak milestone is reached
const STREAK_MILESTONES = {
  3:  { bonus: 15,  label: '3-day streak!' },
  7:  { bonus: 30,  label: '7-day streak!' },
  14: { bonus: 50,  label: '14-day streak!' },
  30: { bonus: 100, label: '30-day streak!' },
};

/**
 * Returns the streak milestone bonus XP if the user just crossed a milestone,
 * or 0 if no milestone was crossed this quiz.
 * @param {number} oldStreak  — streak count before this quiz
 * @param {number} newStreak  — streak count after this quiz
 */
function computeStreakMilestoneBonus(oldStreak, newStreak) {
  const milestone = STREAK_MILESTONES[newStreak];
  if (milestone && oldStreak < newStreak) return milestone.bonus;
  return 0;
}

function computeXPEarned({ correctAnswers, totalQuestions, isFirstQuizOfDay, oldStreak = 0, newStreak = 0 }) {
  const base         = totalQuestions >= 5 ? 10 : 0;
  const correctXP    = Number(correctAnswers) * 2;
  const firstBonus   = isFirstQuizOfDay ? 10 : 0;
  const streakBonus  = computeStreakMilestoneBonus(oldStreak, newStreak);
  return base + correctXP + firstBonus + streakBonus;
}

module.exports = { computeLevel, computeXPEarned, computeStreakMilestoneBonus, STREAK_MILESTONES };
