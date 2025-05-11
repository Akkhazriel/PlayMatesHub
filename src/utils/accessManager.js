const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(id => id.length > 0);

const adminSet = new Set(ADMIN_IDS);

export function isAdmin(ctx) {
  return ctx.from && adminSet.has(ctx.from.id.toString());
}

export function getAdminIds() {
  return Array.from(adminSet);
}

export function addAdmin(id) {
  adminSet.add(id.toString());
}

export function removeAdmin(id) {
  adminSet.delete(id.toString());
}
