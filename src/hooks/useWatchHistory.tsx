import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { dbCache } from '@/utils/indexedDBCache';
import { useRentals } from '@/hooks/useRentals';
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';

export interface WatchHistoryItem {
  id: string;
  user_id: string;
  content_type: 'movie' | 'episode';
  content_id: string;
  progress: number;
  completed: boolean;
  last_watched_at: string;
  created_at: string;
  updated_at: string;
  // Playback position tracking (in seconds)
  playback_position?: number;
  video_duration?: number;
  season_id?: string;
  // Joined data from content tables
  title?: string;
  thumbnail_url?: string;
  duration?: number;
  price?: number;
  genre?: string;
}

export const useWatchHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { checkAccess: checkMovieAccess } = useRentals();
  const { checkAccess: checkEpisodeAccess, checkSeasonAccess } = useOptimizedRentals();
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [completedItems, setCompletedItems] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchHistory = async () => {
    if (!user) {
      setWatchHistory([]);
      setContinueWatching([]);
      setCompletedItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('watch_history')
        .select('*')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false });

      if (error) throw error;

      // Enrich with content details
      const enrichedHistory = await Promise.all(
        (data || []).map(async (item) => {
          let contentDetails = {};
          
          if (item.content_type === 'movie') {
            const { data: movieData } = await supabase
              .from('movies')
              .select('title, thumbnail_url, duration, price, genre_id, genres(name)')
              .eq('id', item.content_id)
              .single();
            
            if (movieData) {
              contentDetails = {
                title: movieData.title,
                thumbnail_url: movieData.thumbnail_url,
                duration: movieData.duration,
                price: movieData.price,
                genre: movieData.genres?.name
              };
            }
          } else if (item.content_type === 'episode') {
            const { data: episodeData } = await supabase
              .from('episodes')
              .select(`
                title,
                duration,
                price,
                season_id,
                seasons!inner(
                  id,
                  tv_shows!inner(
                    title,
                    thumbnail_url,
                    genre_id,
                    genres(name)
                  )
                )
              `)
              .eq('id', item.content_id)
              .single();
            
            if (episodeData) {
              contentDetails = {
                title: `${episodeData.seasons.tv_shows.title} - ${episodeData.title}`,
                thumbnail_url: episodeData.seasons.tv_shows.thumbnail_url,
                duration: episodeData.duration,
                price: episodeData.price,
                genre: episodeData.seasons.tv_shows.genres?.name,
                season_id: episodeData.season_id || episodeData.seasons.id
              };
            }
          }

          return { ...item, ...contentDetails };
        })
      );

      const typedHistory = enrichedHistory as WatchHistoryItem[];
      setWatchHistory(typedHistory);
      
      // Separate into continue watching and completed
      const continuing = typedHistory.filter(item => !item.completed && item.progress > 0);
      const completed = typedHistory.filter(item => item.completed);
      
      setContinueWatching(continuing);
      setCompletedItems(completed);

      // Cache watched content for offline access
      try {
        for (const item of typedHistory) {
          await dbCache.set(`content_${item.content_id}`, {
            id: item.content_id,
            contentType: item.content_type,
            title: item.title || 'Unknown',
            thumbnail_url: item.thumbnail_url,
            duration: item.duration,
            progress: item.progress,
            cachedAt: Date.now(),
            metadata: item
          });
        }
      } catch (error) {
        console.error('Failed to cache content to IndexedDB:', error);
      }
    } catch (error) {
      console.error('Error fetching watch history:', error);
      toast({
        title: "Error",
        description: "Failed to load watch history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateWatchProgress = async (
    contentType: 'movie' | 'episode',
    contentId: string,
    progress: number,
    completed: boolean = false
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('watch_history')
        .upsert({
          user_id: user.id,
          content_type: contentType,
          content_id: contentId,
          progress: Math.min(100, Math.max(0, progress)),
          completed: completed || progress >= 90,
          last_watched_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,content_type,content_id'
        });

      if (error) throw error;

      // Refresh the watch history
      await fetchWatchHistory();
      return true;
    } catch (error) {
      console.error('Error updating watch progress:', error);
      toast({
        title: "Error",
        description: "Failed to save watch progress",
        variant: "destructive"
      });
      return false;
    }
  };

  const markAsCompleted = async (contentType: 'movie' | 'episode', contentId: string) => {
    return await updateWatchProgress(contentType, contentId, 100, true);
  };

  const canRemoveFromHistory = useCallback((historyItem: WatchHistoryItem) => {
    if (historyItem.content_type === 'movie') {
      return !checkMovieAccess(historyItem.content_id, 'movie');
    }

    if (historyItem.content_type === 'episode') {
      const hasEpisodeAccess = checkEpisodeAccess(historyItem.content_id, 'episode');
      const hasSeasonAccess = historyItem.season_id ? checkSeasonAccess(historyItem.season_id) : false;
      return !(hasEpisodeAccess || hasSeasonAccess);
    }

    return true;
  }, [checkMovieAccess, checkEpisodeAccess, checkSeasonAccess]);

  const removeFromHistory = async (historyId: string) => {
    if (!user) return false;

    const historyItem = watchHistory.find((item) => item.id === historyId);
    if (historyItem && !canRemoveFromHistory(historyItem)) {
      toast({
        title: "Rental Active",
        description: "You can only remove expired rentals from watch history.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('watch_history')
        .delete()
        .eq('id', historyId)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchWatchHistory();
      toast({
        title: "Success",
        description: "Item removed from watch history"
      });
      return true;
    } catch (error) {
      console.error('Error removing from history:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from history",
        variant: "destructive"
      });
      return false;
    }
  };

  const clearHistory = async () => {
    if (!user) return false;

    const removableItems = watchHistory.filter((item) => canRemoveFromHistory(item));
    const blockedCount = watchHistory.length - removableItems.length;

    if (removableItems.length === 0) {
      toast({
        title: "Rental Active",
        description: "Only expired rentals can be removed from watch history.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const removableIds = removableItems.map((item) => item.id);

      const { error } = await supabase
        .from('watch_history')
        .delete()
        .eq('user_id', user.id)
        .in('id', removableIds);

      if (error) throw error;

      await fetchWatchHistory();
      toast({
        title: blockedCount > 0 ? "Partial Success" : "Success",
        description: blockedCount > 0
          ? `Removed ${removableItems.length} expired item${removableItems.length === 1 ? '' : 's'} from watch history. Active rentals were kept.`
          : "Watch history cleared"
      });
      return true;
    } catch (error) {
      console.error('Error clearing history:', error);
      toast({
        title: "Error",
        description: "Failed to clear watch history",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchWatchHistory();
  }, [user]);

  // Set up real-time subscription for watch history updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('watch_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watch_history',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchWatchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    watchHistory,
    continueWatching,
    completedItems,
    loading,
    updateWatchProgress,
    markAsCompleted,
    removeFromHistory,
    canRemoveFromHistory,
    clearHistory,
    refetch: fetchWatchHistory
  };
};
