export const AVATAR_COLORS = ['#0c85f0', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export function buildInitialsAvatar(username, color = AVATAR_COLORS[0]) {
  const safeColor = AVATAR_COLORS.includes(color) ? color : AVATAR_COLORS[0];
  const initials = String(username || '??')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 2)
    .toUpperCase() || '??';
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${safeColor}"/><text x="50" y="50" font-family="Inter,Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`
  )}`;
}

export function isGeneratedAvatar(avatar) {
  return typeof avatar === 'string' && avatar.startsWith('data:image/svg+xml');
}

export function extractAvatarColor(avatar) {
  if (!avatar || typeof avatar !== 'string') return AVATAR_COLORS[0];
  const match = decodeURIComponent(avatar).match(/fill="(#[0-9a-fA-F]{6})"/);
  return AVATAR_COLORS.includes(match?.[1]) ? match[1] : AVATAR_COLORS[0];
}

const ALLOWED_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;
const MAX_AVATAR_CHARS = 280000;

export function validateAvatarDataUrl(avatar) {
  if (!avatar || typeof avatar !== 'string') return 'Avatar is required';
  if (isGeneratedAvatar(avatar)) return null;
  if (!ALLOWED_IMAGE.test(avatar)) return 'Avatar must be a PNG, JPEG, GIF, or WebP image';
  if (avatar.length > MAX_AVATAR_CHARS) return 'Avatar is too large (max ~200 KB)';
  return null;
}
