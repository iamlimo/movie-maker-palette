import { supabase } from '@/integrations/supabase/client';

type WatchContentType = 'movie' | 'episode' | 'season';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildWatchPath(contentType: WatchContentType, contentId: string) {
  return `/watch/${contentType}/${contentId}`;
}

export async function resolveWatchPath(
  contentType: WatchContentType | string | null | undefined,
  contentId: string | null | undefined,
  userId?: string | null,
) {
  if (
    !contentId ||
    !UUID_RE.test(contentId) ||
    (contentType !== 'movie' && contentType !== 'episode' && contentType !== 'season')
  ) {
    return '/';
  }

  if (contentType !== 'season') {
    return buildWatchPath(contentType, contentId);
  }

  const { data: episodesData, error: episodesError } = await supabase
    .from('episodes')
    .select('id, episode_number')
    .eq('season_id', contentId)
    .eq('status', 'approved')
    .order('episode_number', { ascending: true });

  if (episodesError || !episodesData?.length) {
    return buildWatchPath('season', contentId);
  }

  if (!userId) {
    return buildWatchPath('episode', episodesData[0].id);
  }

  const episodeIds = episodesData.map((episode) => episode.id);
  const { data: historyData } = await supabase
    .from('watch_history')
    .select('content_id, completed, progress')
    .eq('user_id', userId)
    .in('content_id', episodeIds);

  const watchMap = (historyData || []).reduce<Record<string, { completed: boolean; progress: number }>>(
    (map, entry) => {
      map[entry.content_id] = { completed: entry.completed, progress: entry.progress || 0 };
      return map;
    },
    {},
  );

  const nextEpisode =
    episodesData.find((episode) => {
      const history = watchMap[episode.id];
      return !history || (!history.completed && history.progress < 90);
    }) || episodesData[0];

  return buildWatchPath('episode', nextEpisode.id);
}
