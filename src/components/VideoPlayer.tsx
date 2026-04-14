import { useState, useRef, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { VideoPlayerControls } from './VideoPlayerControls';
import { MovieInfoOverlay } from './MovieInfoOverlay';

const SUPABASE_URL = "https://tsfwlereofjlxhjsarap.supabase.co";

// Client-side URL cache
const urlCache = new Map<string, { url: string; expiresAt: Date; source: string }>();

interface VideoPlayerProps {
  src?: string;
  movieId?: string;
  contentId?: string;
  contentType?: string;
  title?: string;
  poster?: string;
  className?: string;
  subtitleUrl?: string;
  autoPlay?: boolean;
  immersive?: boolean;
  watermarkText?: string;
  // Enhanced props
  cast?: string[];
  director?: string;
  description?: string;
  episodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
  availableQualities?: string[];
  availableSubtitles?: { code: string; label: string }[];
}

export const VideoPlayer = ({
  src,
  movieId,
  contentId,
  contentType,
  title,
  poster,
  className = '',
  subtitleUrl,
  autoPlay = false,
  immersive = false,
  cast,
  director,
  description,
  episodeTitle,
  seasonNumber,
  episodeNumber,
  hasNextEpisode = false,
  onNextEpisode,
  watermarkText,
  availableQualities = ['Auto', '1080p', '720p', '480p', '240p'],
  availableSubtitles = [],
}: VideoPlayerProps) => {
  const [videoUrl, setVideoUrl] = useState<string>(src || '');
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isBandwidthLimited, setIsBandwidthLimited] = useState(false);
  const [showMovieInfo, setShowMovieInfo] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('Auto');
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [hideControlsTimeout, setHideControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skipIntroClicked, setSkipIntroClicked] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const watermarkLabel = watermarkText || 'Signature TV';
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { saveProgress, getLastPosition, startAutoSave, stopAutoSave } = useVideoProgress(
    contentId || movieId || '',
    contentType === 'episode' || contentType === 'movie' ? contentType : 'movie'
  );

  // Auto-hide controls in fullscreen
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true);

      if (hideControlsTimeout) clearTimeout(hideControlsTimeout);

      if (isFullscreen && isPlaying) {
        const timeout = setTimeout(() => {
          setControlsVisible(false);
        }, 3000);
        setHideControlsTimeout(timeout);
      }
    };

    if (isFullscreen) {
      containerRef.current?.addEventListener('mousemove', handleMouseMove);
      return () => {
        containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isFullscreen, isPlaying, hideControlsTimeout]);

  const fetchVideoUrl = useCallback(async (retryCount = 0) => {
    if (src) {
      setVideoUrl(src);
      setLoading(false);
      return;
    }

    if (!movieId && !contentId) {
      setError('No video source provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setIsBandwidthLimited(false);

      const cacheKey = contentId ? `${contentType || 'episode'}:${contentId}` : movieId!;
      const cached = urlCache.get(cacheKey);
      if (cached && new Date() < cached.expiresAt) {
        console.log('Using cached video URL');
        setVideoUrl(cached.url);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Please log in to watch this video');
        setLoading(false);
        return;
      }

      const body: any = { expiryHours: 24 };
      if (contentId) {
        body.contentId = contentId;
        body.contentType = contentType || 'episode';
      } else {
        body.movieId = movieId;
      }

      const { data, error, response } = await supabase.functions.invoke('get-video-url', {
        body,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const isBwLimited = response?.headers?.get('X-Bandwidth-Limited') === 'true';
      if (isBwLimited) {
        setIsBandwidthLimited(true);
      }

      const apiError = data?.error || error?.message || 'Failed to load video';
      const accessDenied = apiError.toLowerCase().includes('access denied') || apiError.toLowerCase().includes('forbidden');

      if (error || !data?.success) {
        if (retryCount === 0 && accessDenied) {
          setTimeout(() => fetchVideoUrl(1), 1500);
        }

        setError(apiError);
        toast({
          title: "Error",
          description: apiError,
          variant: "destructive",
        });
        return;
      }

      let finalUrl = data.signedUrl;
      if (data.source === 'backblaze') {
        const queryKey = contentId
          ? `contentId=${contentId}&contentType=${encodeURIComponent(contentType || 'episode')}`
          : `movieId=${movieId}`;
        finalUrl = `${SUPABASE_URL}/functions/v1/get-video-url?${queryKey}&stream=true`;
      }

      const expiresAt = new Date(data.expiresAt);
      urlCache.set(cacheKey, {
        url: finalUrl,
        expiresAt,
        source: data.source || 'backblaze'
      });
      setVideoUrl(finalUrl);

      if (isBwLimited) {
        toast({
          title: "Using Backup Server",
          description: "Backblaze bandwidth limit reached. Using Supabase storage.",
          variant: "default",
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load video';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [movieId, toast]);

  useEffect(() => {
    fetchVideoUrl();
  }, [fetchVideoUrl]);

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      stopAutoSave();
    };
  }, [stopAutoSave]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setShowMovieInfo(true);
    } else {
      videoRef.current.play();
      setShowMovieInfo(false);
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume / 100;
    setVolume(newVolume);

    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    
    // Hide skip intro after 1:30 (90 seconds) of playback
    if (videoRef.current.currentTime >= 90 && showSkipIntro) {
      setShowSkipIntro(false);
    }
  };

  const handleLoadedMetadata = async () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);

    // Restore last position
    const lastPos = await getLastPosition();
    if (lastPos > 0 && lastPos < videoRef.current.duration - 10) {
      videoRef.current.currentTime = lastPos;
      setCurrentTime(lastPos);
    }

    // Start auto-save
    startAutoSave(videoRef.current);
  };

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSkipIntro = () => {
    if (!videoRef.current) return;
    // Typically skip intro is 90 seconds, but this can be customized
    videoRef.current.currentTime += 90;
    setSkipIntroClicked(true);
    setShowSkipIntro(false);
    toast({
      title: "Skipped",
      description: "Intro skipped",
    });
  };

  const handleReplay10s = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
  };

  const handleCastToTV = () => {
    // Implementation for Google Cast API
    if ((window as any).chrome && (window as any).chrome.cast) {
      toast({
        title: "Cast",
        description: "Casting to TV...",
      });
    } else {
      toast({
        title: "Cast not available",
        description: "Chromecast is not available on this device",
        variant: "destructive",
      });
    }
  };

  const handleQualityChange = (quality: string) => {
    setCurrentQuality(quality);
    // In a production app, you'd implement quality switching here
    toast({
      title: "Quality Changed",
      description: `Switched to ${quality}`,
    });
  };

  const handleSubtitlesChange = (subtitle: string | null) => {
    setCurrentSubtitle(subtitle);
    // In a production app, you'd load the appropriate subtitle track
    toast({
      title: "Subtitles",
      description: subtitle ? `Switched to ${subtitle}` : "Subtitles off",
    });
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Prevent right-click on video to protect against piracy
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target === videoRef.current || containerRef.current?.contains(target)) {
        e.preventDefault();
        return false;
      }
    };

    if (videoRef.current) {
      videoRef.current.addEventListener('contextmenu', handleContextMenu as EventListener);
      return () => {
        videoRef.current?.removeEventListener('contextmenu', handleContextMenu as EventListener);
      };
    }
  }, []);

  if (loading) {
    return (
      <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
        <Skeleton className="w-full aspect-video rounded-none" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-black rounded-lg p-8 ${className}`}>
        <div className="text-white text-center">
          <p className="text-lg mb-2">⚠️ {error}</p>
          <Button variant="outline" onClick={() => fetchVideoUrl()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${
        immersive ? 'w-screen h-screen' : 'rounded-lg overflow-hidden'
      } ${className} group cursor-default`}
    >
      {/* Bandwidth Limited Banner */}
      {isBandwidthLimited && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-900/80 text-amber-100 px-4 py-2 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>Using backup server due to bandwidth limits. Service will resume tomorrow.</span>
        </div>
      )}
      
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => {
          setIsPlaying(true);
          setShowMovieInfo(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowMovieInfo(true);
        }}
        preload="metadata"
        crossOrigin="anonymous"
        autoPlay={autoPlay}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      >
        {subtitleUrl && (
          <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />
        )}
      </video>
      
      {/* Watermark Overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4">
        <span className="text-[10px] uppercase tracking-[0.35em] text-white/30 drop-shadow-lg">
          {watermarkLabel}
        </span>
      </div>

      {/* Video Controls */}
      {controlsVisible && (
        <VideoPlayerControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          isFullscreen={isFullscreen}
          hasNextEpisode={hasNextEpisode}
          showSkipIntro={showSkipIntro}
          onPlay={togglePlay}
          onPause={togglePlay}
          onMute={toggleMute}
          onVolumeChange={handleVolumeChange}
          onSeek={handleSeek}
          onFullscreen={toggleFullscreen}
          onSkipIntro={handleSkipIntro}
          onNextEpisode={onNextEpisode}
          onReplay10s={handleReplay10s}
          onCastToTV={handleCastToTV}
          onQualityChange={handleQualityChange}
          onSubtitlesChange={handleSubtitlesChange}
          availableQualities={availableQualities}
          availableSubtitles={availableSubtitles}
          currentQuality={currentQuality}
          currentSubtitle={currentSubtitle}
        />
      )}

      {/* Play Button Overlay - Center */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Button
            variant="ghost"
            size="lg"
            onClick={togglePlay}
            className="bg-white/20 hover:bg-white/30 text-white rounded-full p-4 transition-all hover:scale-110"
          >
            <Play size={48} fill="white" />
          </Button>
        </div>
      )}

      {/* Movie Info Overlay - Shows when paused */}
      <MovieInfoOverlay
        isVisible={showMovieInfo && !isPlaying}
        title={title}
        subtitle={episodeTitle}
        cast={cast}
        director={director}
        description={description}
        posterUrl={poster}
        episodeTitle={episodeTitle}
        seasonNumber={seasonNumber}
        episodeNumber={episodeNumber}
        onClose={() => {
          setShowMovieInfo(false);
          if (!isPlaying && videoRef.current) {
            videoRef.current.play();
            setIsPlaying(true);
          }
        }}
      />
    </div>
  );
};