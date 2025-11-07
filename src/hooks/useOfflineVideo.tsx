import { useState, useCallback } from 'react';
import { dbCache } from '@/utils/indexedDBCache';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseOfflineVideoProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  rentalId?: string;
}

export const useOfflineVideo = ({ contentId, contentType, rentalId }: UseOfflineVideoProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const { toast } = useToast();

  const checkIfCached = useCallback(async () => {
    try {
      const cached = await dbCache.getCachedVideo(contentId, contentType);
      setIsCached(!!cached);
      return !!cached;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }, [contentId, contentType]);

  const getCachedVideoUrl = useCallback(async (): Promise<string | null> => {
    try {
      const cached = await dbCache.getCachedVideo(contentId, contentType);
      if (cached) {
        // Create blob URL for playback
        const blobUrl = URL.createObjectURL(cached.blob);
        return blobUrl;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached video:', error);
      return null;
    }
  }, [contentId, contentType]);

  const downloadForOffline = useCallback(async (expiresAt: number): Promise<boolean> => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Get signed video URL
      const { data, error } = await supabase.functions.invoke('get-video-url', {
        body: {
          movieId: contentId,
          expiryHours: 24
        }
      });

      if (error || !data?.signedUrl) {
        throw new Error('Failed to get video URL');
      }

      // Fetch video with progress tracking
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('Failed to download video');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to read video stream');

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total > 0) {
          setDownloadProgress((receivedLength / total) * 100);
        }
      }

      // Combine chunks into blob
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });

      // Cache the video
      await dbCache.cacheVideo({
        contentId,
        contentType,
        blob,
        size: blob.size,
        expiresAt,
        rentalId
      });

      setIsCached(true);
      toast({
        title: "Downloaded for offline viewing",
        description: "You can now watch this content without internet",
      });

      return true;
    } catch (error) {
      console.error('Error downloading video:', error);
      toast({
        title: "Download failed",
        description: "Could not download video for offline viewing",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [contentId, contentType, rentalId, toast]);

  const removeFromOffline = useCallback(async () => {
    try {
      await dbCache.deleteCachedVideo(contentId, contentType);
      setIsCached(false);
      toast({
        title: "Removed from offline storage",
        description: "Video deleted to free up space",
      });
    } catch (error) {
      console.error('Error removing video:', error);
      toast({
        title: "Error",
        description: "Could not remove video from offline storage",
        variant: "destructive"
      });
    }
  }, [contentId, contentType, toast]);

  return {
    isDownloading,
    downloadProgress,
    isCached,
    checkIfCached,
    getCachedVideoUrl,
    downloadForOffline,
    removeFromOffline
  };
};
