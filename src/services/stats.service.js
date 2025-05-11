import {
  findUserWithProfile,
  countUserMatches,
  countUserLikes,
  countUserComplaints,
  countUserEvents,
  getGlobalStats as fetchGlobalStats,
  getPremiumStatus
} from '../repositories/stats.repository.js';

export async function getUserStats(identifier) {
  const user = await findUserWithProfile(identifier);
  if (!user.profile_id) return { telegram_id: user.telegram_id, username: user.username, profile_id: null };

  const { profile_id, telegram_id, username } = user;

  const [matches, likes, complaints, events, premium] = await Promise.all([
    countUserMatches(profile_id),
    countUserLikes(profile_id),
    countUserComplaints(profile_id),
    countUserEvents(profile_id),
    getPremiumStatus(profile_id)
  ]);

  return {
    profile_id,
    telegram_id,
    username,
    premium_expires_at: premium?.expires_at || null,
    matches,
    likes,
    complaints,
    events
  };
}

export async function getGlobalStats() {
  return fetchGlobalStats();
}
