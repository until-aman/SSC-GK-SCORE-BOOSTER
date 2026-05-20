function getISTDateString(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getISTYesterday(date = new Date()) {
  return getISTDateString(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

function computeStreak({ streakCount, lastAttemptDate, today, yesterday }) {
  if (!lastAttemptDate || lastAttemptDate === '') {
    return { streakCount: 1, streakShieldUsed: false };
  }
  if (lastAttemptDate === today) {
    return { streakCount: Number(streakCount), streakShieldUsed: false };
  }
  if (lastAttemptDate === yesterday) {
    return { streakCount: Number(streakCount) + 1, streakShieldUsed: false };
  }
  return { streakCount: 1, streakShieldUsed: false };
}

module.exports = { getISTDateString, getISTYesterday, computeStreak };
