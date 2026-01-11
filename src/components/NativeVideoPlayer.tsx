import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Play } from 'lucide-react';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { useToast } from '@/hooks/use-toast';

interface NativeVideoPlayerProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  posterUrl?: string;
  onError?: (error: string) => void;
  autoPlay?: boolean;
}

// Dynamic import for native video player (installed separately on native builds)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CapacitorVideoPlayer: any = null;
const loadNativePlayer = async () => {
  if (Capacitor.isNativePlatform() && !CapacitorVideoPlayer) {
    try {
      // @ts-ignore - Package installed on native builds only
      const module = await import(/* @vite-ignore */ '@capacitor-community/video-player');
      CapacitorVideoPlayer = module.CapacitorVideoPlayer;
    } catch (e) {
      console.log('Native video player not available, using web fallback');
    }
  }
  return CapacitorVideoPlayer;
};

const NativeVideoPlayer = ({
  contentId,
  contentType,
  posterUrl,
  onError,
  autoPlay = false
}: NativeVideoPlayerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nativePlayerReady, setNativePlayerReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerIdRef = useRef(`video-${contentId}-${Date.now()}`);
  const lastPositionLoaded = useRef(false);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();
  
  const { saveProgress, getLastPosition, startAutoSave, stopAutoSave } = useVideoProgress(contentId, contentType);

  // Initialize native player on mount
  useEffect(() => {
    if (isNative) {
      loadNativePlayer().then((player) => {
        setNativePlayerReady(!!player);
      });
    }
  }, [isNative]);

  const fetchSignedUrl = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/generate-b2-signed-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ contentId, contentType })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get video URL');
      }

      const data = await response.json();
      setSignedUrl(data.signedUrl);
      setLoading(false);

      if (autoPlay) {
        handlePlay(data.signedUrl);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load video';
      setError(errorMessage);
      setLoading(false);
      onError?.(errorMessage);
    }
  };

  const handlePlay = async (url?: string) => {
    const videoUrl = url || signedUrl;
    if (!videoUrl) return;

    if (isNative && nativePlayerReady && CapacitorVideoPlayer) {
      try {
        // Use native Capacitor video player for hardware acceleration
        await CapacitorVideoPlayer.initPlayer({
          mode: 'fullscreen',
          url: videoUrl,
          playerId: playerIdRef.current,
          componentTag: 'native-video-player',
          title: '',
          smallTitle: '',
          accentColor: '#6366f1',
          chromecast: false,
          headers: {},
          showControls: true,
          displayMode: 'landscape',
          pipEnabled: true,
          bkmodeEnabled: true,
          exitOnEnd: true
        });

        setIsPlaying(true);

        // Listen for player events
        CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPlay', () => {
          setIsPlaying(true);
        });

        CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPause', () => {
          setIsPlaying(false);
        });

        CapacitorVideoPlayer.addListener('jeepCapVideoPlayerEnded', () => {
          setIsPlaying(false);
        });

        CapacitorVideoPlayer.addListener('jeepCapVideoPlayerExit', () => {
          setIsPlaying(false);
        });

      } catch (err: any) {
        console.error('Native player error:', err);
        // Fall back to web player
        playWebVideo(videoUrl);
      }
    } else {
      playWebVideo(videoUrl);
    }
  };

  const playWebVideo = async (url: string) => {
    if (videoRef.current) {
      videoRef.current.src = url;
      
      // Restore last position
      if (!lastPositionLoaded.current) {
        const lastPosition = await getLastPosition();
        if (lastPosition > 5) {
          videoRef.current.currentTime = lastPosition;
          toast({
            title: "Resuming playback",
            description: "Continuing from where you left off"
          });
        }
        lastPositionLoaded.current = true;
      }
      
      videoRef.current.play();
      setIsPlaying(true);
      startAutoSave(videoRef.current);
    }
  };

  // Handle pause event
  const handlePause = useCallback(() => {
    if (videoRef.current) {
      saveProgress(videoRef.current.currentTime, videoRef.current.duration);
    }
    stopAutoSave();
  }, [saveProgress, stopAutoSave]);

  // Handle video end
  const handleEnded = useCallback(() => {
    if (videoRef.current) {
      saveProgress(videoRef.current.duration, videoRef.current.duration);
    }
    stopAutoSave();
    setIsPlaying(false);
  }, [saveProgress, stopAutoSave]);

  useEffect(() => {
    fetchSignedUrl();

    return () => {
      // Cleanup native player on unmount
      stopAutoSave();
      if (isNative && CapacitorVideoPlayer) {
        CapacitorVideoPlayer.stopAllPlayers?.().catch(() => {});
        CapacitorVideoPlayer.removeAllListeners?.();
      }
    };
  }, [contentId, contentType, stopAutoSave]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  if (loading) {
    return <Skeleton className="aspect-video w-full rounded-lg" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchSignedUrl()} className="ml-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative">
      {!isPlaying ? (
        // Poster with play button
        <div
          className="aspect-video bg-black rounded-lg overflow-hidden relative cursor-pointer group"
          onClick={() => handlePlay()}
        >
          {posterUrl && (
            <img
              src={posterUrl}
              alt="Video poster"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 md:w-10 md:h-10 text-primary-foreground ml-1" />
            </div>
          </div>
        </div>
      ) : (
        // Web video player (for non-native or fallback)
        <div
          className="aspect-video bg-black rounded-lg overflow-hidden"
          onContextMenu={handleContextMenu}
        >
          <video
            ref={videoRef}
            poster={posterUrl}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            onContextMenu={handleContextMenu}
            onPause={handlePause}
            onEnded={handleEnded}
            className="w-full h-full"
            style={{ pointerEvents: 'auto' }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {/* Watermark overlay */}
      <div
        className="absolute top-4 right-4 text-white/30 text-xs font-mono select-none pointer-events-none"
        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
      >
        Protected Content
      </div>
    </div>
  );
};

export default NativeVideoPlayer;
