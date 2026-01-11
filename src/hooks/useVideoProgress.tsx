import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface VideoProgressData {
  contentId: string;
  contentType: 'movie' | 'episode';
  playbackPosition: number;
  videoDuration: number;
  progress: number;
}

const SAVE_INTERVAL_MS = 30000; // 30 seconds
const LOCAL_STORAGE_PREFIX = 'watch_progress_';

export const useVideoProgress = (contentId: string, contentType: 'movie' | 'episode') => {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedPosition = useRef<number>(0);

  // Save progress to database
  const saveProgress = useCallback(async (position: number, duration: number) => {
    if (!user || !position || !duration || position < 1) return;

    const progress = Math.round((position / duration) * 100);
    const completed = progress >= 90;

    const data: VideoProgressData = {
      contentId,
      contentType,
      playbackPosition: Math.floor(position),
      videoDuration: Math.floor(duration),
      progress
    };

    // Save locally first for offline support
    saveProgressLocally(data);

    try {
      const { error } = await supabase
        .from('watch_history')
        .upsert({
          user_id: user.id,
          content_type: contentType,
          content_id: contentId,
          progress,
          playback_position: Math.floor(position),
          video_duration: Math.floor(duration),
          completed,
          last_watched_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,content_type,content_id'
        });

      if (error) {
        console.error('Error saving watch progress:', error);
      } else {
        lastSavedPosition.current = position;
        // Clear local storage on successful save
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${contentId}`);
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }, [user, contentId, contentType]);

  // Save to localStorage for offline support
  const saveProgressLocally = (data: VideoProgressData) => {
    const key = `${LOCAL_STORAGE_PREFIX}${data.contentId}`;
    localStorage.setItem(key, JSON.stringify({
      ...data,
      userId: user?.id,
      savedAt: Date.now()
    }));
  };

  // Get last watched position from database
  const getLastPosition = useCallback(async (): Promise<number> => {
    if (!user) {
      // Check local storage for offline position
      return getLocalPosition();
    }

    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select('playback_position, completed')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching last position:', error);
        return getLocalPosition();
      }

      // If completed, don't resume from near the end
      if (data?.completed && data.playback_position) {
        return 0; // Start from beginning for completed content
      }

      return data?.playback_position || getLocalPosition();
    } catch (error) {
      console.error('Error getting last position:', error);
      return getLocalPosition();
    }
  }, [user, contentId, contentType]);

  // Get position from local storage
  const getLocalPosition = (): number => {
    const key = `${LOCAL_STORAGE_PREFIX}${contentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.playbackPosition || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  // Start auto-save interval
  const startAutoSave = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Save immediately on start
    if (video.currentTime > 5) {
      saveProgress(video.currentTime, video.duration);
    }

    // Set up 30-second interval
    intervalRef.current = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const currentTime = videoRef.current.currentTime;
        const duration = videoRef.current.duration;
        
        // Only save if position changed significantly (more than 5 seconds)
        if (Math.abs(currentTime - lastSavedPosition.current) > 5) {
          saveProgress(currentTime, duration);
        }
      }
    }, SAVE_INTERVAL_MS);
  }, [saveProgress]);

  // Stop auto-save and save final position
  const stopAutoSave = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Save final position
    if (videoRef.current) {
      saveProgress(videoRef.current.currentTime, videoRef.current.duration);
    }
  }, [saveProgress]);

  // Sync local progress when coming back online
  const syncLocalProgress = useCallback(async () => {
    if (!user) return;

    const keys = Object.keys(localStorage).filter(k => k.startsWith(LOCAL_STORAGE_PREFIX));
    
    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        
        const data = JSON.parse(stored);
        if (data.userId === user.id) {
          await supabase
            .from('watch_history')
            .upsert({
              user_id: user.id,
              content_type: data.contentType,
              content_id: data.contentId,
              progress: data.progress,
              playback_position: data.playbackPosition,
              video_duration: data.videoDuration,
              completed: data.progress >= 90,
              last_watched_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,content_type,content_id'
            });
          
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.error('Error syncing local progress:', error);
      }
    }
  }, [user]);

  // Listen for online event to sync
  useEffect(() => {
    window.addEventListener('online', syncLocalProgress);
    
    // Sync on mount if online
    if (navigator.onLine) {
      syncLocalProgress();
    }

    return () => {
      window.removeEventListener('online', syncLocalProgress);
    };
  }, [syncLocalProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    saveProgress,
    getLastPosition,
    startAutoSave,
    stopAutoSave
  };
};
