import { useState, useRef, useEffect, useCallback } from "react";
// Vidstack player for improved HLS support and uniform inline playback on mobile
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { VideoPlayerControls } from "./VideoPlayerControls";
import { MovieInfoOverlay } from "./MovieInfoOverlay";

// Client-side URL cache
const urlCache = new Map<
  string,
  { url: string; expiresAt: Date; source: string }
>();

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
  className = "",
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
  availableQualities = ["Auto", "1080p", "720p", "480p", "240p"],
  availableSubtitles = [],
}: VideoPlayerProps) => {
  const controlsId = `video-controls-${contentId ?? movieId ?? "player"}`;
  const [videoUrl, setVideoUrl] = useState<string>(src || "");
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isBandwidthLimited, setIsBandwidthLimited] = useState(false);
  const [showMovieInfo, setShowMovieInfo] = useState(false);
  const [currentQuality, setCurrentQuality] = useState("Auto");
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(
    subtitleUrl ? "en" : null,
  );
  const [hideControlsTimeout, setHideControlsTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skipIntroClicked, setSkipIntroClicked] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(true);

  const videoRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const [hlsLevels, setHlsLevels] = useState<
    Array<{ height?: number; bitrate?: number }>
  >([]);
  const { toast } = useToast();

  const { saveProgress, getLastPosition, startAutoSave, stopAutoSave } =
    useVideoProgress(
      contentId || movieId || "",
      contentType === "episode" || contentType === "movie"
        ? contentType
        : "movie",
    );

  const isTypingTarget = (el: EventTarget | null) => {
    const node = el as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    const isContentEditable = !!(node as HTMLElement).isContentEditable;
    return tag === "input" || tag === "textarea" || isContentEditable;
  };

  // Keyboard shortcuts (web only):
  // - Space: play/pause (when not typing)
  // - F: toggle fullscreen (when not typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key?.toLowerCase?.() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, isPlaying]);

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
      containerRef.current?.addEventListener("mousemove", handleMouseMove);
      return () => {
        containerRef.current?.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, [isFullscreen, isPlaying, hideControlsTimeout]);

  // double-click toggles fullscreen (desktop expectation)
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFullscreen();
  };

  const fetchVideoUrl = useCallback(
    async (retryCount = 0) => {
      if (src) {
        setVideoUrl(src);
        setLoading(false);
        return;
      }

      if (!movieId) {
        setError("No video source provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setIsBandwidthLimited(false);

        // Check cache first
        const cached = urlCache.get(movieId);
        if (cached && new Date() < cached.expiresAt) {
          console.log("Using cached video URL");
          setVideoUrl(cached.url);
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("Please log in to watch this video");
          return;
        }

        const { data, error, response } = await supabase.functions.invoke(
          "get-video-url",
          {
            body: {
              movieId: movieId,
              expiryHours: 24,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );

        const isBwLimited =
          response?.headers?.get("X-Bandwidth-Limited") === "true";
        if (isBwLimited) {
          setIsBandwidthLimited(true);
        }

        const apiError =
          data?.error || error?.message || "Failed to load video";
        const accessDenied =
          apiError.toLowerCase().includes("access denied") ||
          apiError.toLowerCase().includes("forbidden");

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

        const finalUrl = data.signedUrl;

        // Cache the URL
        const expiresAt = new Date(data.expiresAt);
        urlCache.set(movieId, {
          url: finalUrl,
          expiresAt,
          source: data.source || "backblaze",
        });
        setVideoUrl(finalUrl);

        if (isBwLimited) {
          toast({
            title: "Using Backup Server",
            description:
              "Backblaze bandwidth limit reached. Using Supabase storage.",
            variant: "default",
          });
        }
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load video";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [movieId, toast],
  );

  useEffect(() => {
    fetchVideoUrl();
    return () => {
      // cleanup hls instance on unmount or src change
      try {
        const hls = hlsRef.current;
        if (hls && typeof hls.destroy === "function") hls.destroy();
        hlsRef.current = null;
      } catch {}
    };
  }, [fetchVideoUrl]);

  // If the subtitle URL changes (switching content), reset subtitle state.
  useEffect(() => {
    setCurrentSubtitle(subtitleUrl ? "en" : null);
  }, [subtitleUrl]);

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      stopAutoSave();
    };
  }, [stopAutoSave]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      void videoRef.current.pause();
      setShowMovieInfo(true);
    } else {
      void videoRef.current.play();
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

    const nextVolume = Math.max(0, Math.min(100, newVolume));
    videoRef.current.volume = nextVolume / 100;
    setVolume(nextVolume);

    if (nextVolume === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
      return;
    }

    videoRef.current.muted = false;
    setIsMuted(false);
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
    startAutoSave(videoRef.current.provider?.media || videoRef.current);
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
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
    videoRef.current.currentTime = Math.max(
      0,
      videoRef.current.currentTime - 10,
    );
  };

  const handleCastToTV = () => {
    // Implementation for Google Cast API (stub)
    const w = window as Window & { chrome?: { cast?: unknown } };
    const hasCast = !!w.chrome?.cast;

    if (hasCast) {
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
    // HLS.js level switching: set currentLevel to index or -1 for Auto
    try {
      const hls = hlsRef.current;
      if (hls) {
        if (quality === "Auto") {
          hls.currentLevel = -1; // enable ABR
          toast({ title: "Quality", description: `Auto (adaptive)` });
          return;
        }

        const targetHeight = parseInt(
          String(quality).replace(/[^0-9]/g, ""),
          10,
        );
        const levels = hls.levels || [];
        let bestIdx = -1;
        for (let i = 0; i < levels.length; i++) {
          const lvl = levels[i];
          if (lvl && lvl.height === targetHeight) {
            bestIdx = i;
            break;
          }
        }
        if (bestIdx === -1 && levels.length > 0) {
          // fallback: choose nearest by height
          let nearest = 0;
          let diff = Infinity;
          for (let i = 0; i < levels.length; i++) {
            const h = levels[i].height || 0;
            const d = Math.abs((h || 0) - targetHeight);
            if (d < diff) {
              diff = d;
              nearest = i;
            }
          }
          bestIdx = nearest;
        }

        if (bestIdx >= 0) {
          hls.currentLevel = bestIdx;
          toast({ title: "Quality", description: `Set ${quality}` });
          return;
        }
      }

      // Non-hls fallback: just toast
      toast({
        title: "Quality Changed",
        description: `Switched to ${quality}`,
      });
    } catch (e) {
      toast({
        title: "Quality Change Failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleSubtitlesChange = (subtitle: string | null) => {
    // DB only provides a single English subtitle_url for now.
    if (!subtitleUrl) {
      setCurrentSubtitle(null);
      toast({
        title: "Subtitles",
        description: "Subtitles are not available for this content",
        variant: "destructive",
      });
      return;
    }

    const next = subtitle === null ? null : "en";
    setCurrentSubtitle(next);

    toast({
      title: "Subtitles",
      description: next ? "English captions on" : "Subtitles off",
    });
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Prevent right-click on video to protect against piracy
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target === videoRef.current ||
        containerRef.current?.contains(target)
      ) {
        e.preventDefault();
        return false;
      }
    };

    if (videoRef.current) {
      videoRef.current.addEventListener(
        "contextmenu",
        handleContextMenu as EventListener,
      );
      return () => {
        videoRef.current?.removeEventListener(
          "contextmenu",
          handleContextMenu as EventListener,
        );
      };
    }
  }, []);

  // Initialize hls.js for m3u8 streams on browsers that don't natively support HLS
  useEffect(() => {
    // Only run on web and when we have a videoRef and an HLS manifest URL
    const url = videoUrl || src || "";
    const isM3u8 = /\.m3u8(\?|$)/i.test(url);
    if (!isM3u8) return;
    let mounted = true;

    (async () => {
      try {
        // dynamic import to avoid SSR and keep bundle small
        const Hls = (await import("hls.js")).default;
        if (!mounted) return;
        if (Hls.isSupported()) {
          const mediaEl =
            videoRef.current?.provider?.media ||
            videoRef.current?.media ||
            videoRef.current;
          const hls = new Hls({ capLevelToPlayerSize: true });
          hlsRef.current = hls;
          if (mediaEl) hls.attachMedia(mediaEl as any);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(url);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const levels = (hls.levels || []).map((l: any) => ({
              height: l.height,
              bitrate: l.bitrate,
            }));
            setHlsLevels(levels);
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
            const level = hls.levels[data.level];
            const nextQuality = level?.height
              ? `${level.height}p`
              : `${Math.round((level?.bitrate || 0) / 1000)}kbps`;
            setCurrentQuality(nextQuality);
          });
        } else {
          // Some browsers (Safari) support native HLS - let the MediaPlayer handle it
        }
      } catch (e) {
        // ignore if import fails
      }
    })();

    return () => {
      mounted = false;
      try {
        const hls = hlsRef.current;
        if (hls && typeof hls.destroy === "function") hls.destroy();
        hlsRef.current = null;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, src]);

  if (loading) {
    return (
      <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
        {poster ? (
          <div className="relative w-full aspect-video bg-black overflow-hidden">
            <img
              src={poster}
              alt={title ?? "Poster"}
              className="w-full h-full object-cover opacity-90 transform transition-transform duration-700 ease-out group-focus-within:scale-105 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="w-24 h-24 rounded-full" />
            </div>
            {title && (
              <div className="absolute left-4 bottom-4 text-white/90 text-sm drop-shadow">
                {title}
              </div>
            )}
          </div>
        ) : (
          <Skeleton className="w-full aspect-video rounded-none" />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-black rounded-lg p-6 ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="text-white text-center max-w-lg">
          <p className="text-lg font-semibold mb-2">Playback Error</p>
          <p className="text-sm mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="default" onClick={() => fetchVideoUrl()}>
              Retry
            </Button>
            <Button variant="outline" onClick={() => setError("")}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showControlsAndMaybePlay = () => {
    setControlsVisible(true);

    // If paused, start playing (primary tap-to-toggle behavior)
    if (videoRef.current && !isPlaying) {
      togglePlay();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={() => showControlsAndMaybePlay()}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          showControlsAndMaybePlay();
        }
      }}
      tabIndex={0}
      role="region"
      aria-label={`Video player: ${title ?? "content"}`}
      className={`relative bg-black ${
        immersive ? "w-screen h-screen" : "rounded-lg overflow-hidden"
      } ${className} group cursor-default focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20`}
    >
      {/* Bandwidth Limited Banner */}
      {isBandwidthLimited && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-900/80 text-amber-100 px-4 py-2 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Using backup server due to bandwidth limits. Service will resume
            tomorrow.
          </span>
        </div>
      )}

      <MediaPlayer
        ref={videoRef as any}
        src={videoUrl}
        aria-describedby={controlsId}
        tabIndex={0}
        playsinline
        controls={false}
        className="w-full h-full object-contain"
        style={{
          ["--media-brand" as any]: "#FD8307",
          ["--video-brand" as any]: "#FD8307",
          ["--media-slider-track-fill-bg" as any]: "#FD8307",
          ["--media-button-hover-bg" as any]: "rgba(253, 131, 7, 0.22)",
          ["--media-menu-bg" as any]: "rgba(15, 15, 15, 0.94)",
          ["--video-volume-bg" as any]: "rgba(17, 17, 17, 0.9)",
          ["--media-button-color" as any]: "#ffffff",
          ["--video-focus-ring-color" as any]: "#FD8307",
          ["--media-focus-ring-color" as any]: "#FD8307",
          ["--media-controls-color" as any]: "#ffffff",
          ["--video-controls-color" as any]: "#ffffff",
          ["--media-buffering-track-fill-color" as any]: "#FD8307",
          ["--video-border-radius" as any]: "14px",
          ["--video-border" as any]: "1px solid rgba(255,255,255,0.12)",
        }}
        onTimeUpdate={handleTimeUpdate as any}
        onLoadedMetadata={handleLoadedMetadata as any}
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
      >
        <MediaProvider>
          {subtitleUrl && currentSubtitle !== null && (
            <track
              key={`track-${currentSubtitle}`}
              kind="subtitles"
              src={subtitleUrl}
              srcLang="en"
              label="English"
              default
            />
          )}
          <DefaultVideoLayout icons={defaultLayoutIcons as any} />
        </MediaProvider>
      </MediaPlayer>

      {/* Video Controls */}
      {controlsVisible && (
        <VideoPlayerControls
          id={controlsId}
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
            className="bg-[#FD8307] hover:bg-[#e77706] text-white rounded-full p-4 shadow-[0_0_0_8px_rgba(253,131,7,0.18)] ring-4 ring-white/10 transition-all duration-200 hover:scale-110 active:scale-100"
            aria-label="Play"
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
