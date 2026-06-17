export type WebUnlockContentType = 'movie' | 'episode' | 'season';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildWebUnlockPath(
  contentType: WebUnlockContentType,
  contentId: string,
) {
  // Web unlock routes (reader/unlocker web app)
  // If your router uses different paths, update them here only.
  if (!contentId || !UUID_RE.test(contentId)) return '/';

  return `/unlock/${contentType}/${contentId}`;
}

export function buildWebUnlockUrl(
  contentType: WebUnlockContentType,
  contentId: string,
) {
  const path = buildWebUnlockPath(contentType, contentId);
  // For native browsers/webviews, keep it relative.
  return path;
}
