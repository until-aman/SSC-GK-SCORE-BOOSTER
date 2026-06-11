// lib/server/userProfileService.js — shared normalized profile shape (Step 12).
//
// Single source of truth for the profile object that BOTH /api/user-profile and
// /api/dashboard-bootstrap return from a parsed Users row. Keeps the field set
// identical so the client's shared profile cache is interchangeable between the
// two routes. Does NOT change Users Sheet columns or any calculation — it only
// selects already-parsed fields from parseUserRow's output.

export function buildProfileResponse(user, isNewUser) {
  return {
    email:           user.email,
    name:            user.name,
    totalCoins:      user.totalCoins,
    level:           user.level,
    streakCount:     user.streakCount,
    lastAttemptDate: user.lastAttemptDate,
    createdAt:       user.createdAt,
    image:           user.image,
    isNewUser:       Boolean(isNewUser),
  };
}
