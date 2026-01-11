import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { dbCache } from '@/utils/indexedDBCache';

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
                seasons!inner(
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
                genre: episodeData.seasons.tv_shows.genres?.name
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

  const removeFromHistory = async (historyId: string) => {
    if (!user) return false;

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

    try {
      const { error } = await supabase
        .from('watch_history')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchWatchHistory();
      toast({
        title: "Success",
        description: "Watch history cleared"
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
    clearHistory,
    refetch: fetchWatchHistory
  };
};