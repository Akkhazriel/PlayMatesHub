export function isPremiumActive(row) {
  if (!row?.expires_at) return false;
  return new Date(row.expires_at) > new Date();
}
