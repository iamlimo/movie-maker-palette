export type PushTargetScreen = "home" | "movie" | "tvshow";

export type PushNavigatePayload = {
  target_screen?: string | null;
  entity_id?: string | null;
};

export function mapPushDataToRoute(data: PushNavigatePayload): string | null {
  const target = data.target_screen ?? undefined;
  const entityId = data.entity_id ?? undefined;

  if (!target) return null;

  if (target === "home") return "/";

  // Admin UI suggests "movie" / "tvshow" targets. entity_id is expected
  // to be the id from your DB (movies.id / tv_shows.id).
  // Your current routes use :slug params, so until the backend/payload sends slug,
  // we'll fall back to a best-effort route shape:
  // - /movie/:slug  where slug could be the id as well.
  if (target === "movie") {
    if (!entityId) return null;
    return `/movie/${entityId}`;
  }

  if (target === "tvshow") {
    if (!entityId) return null;
    return `/tvshow/${entityId}`;
  }

  return null;
}
