import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar } from "@capacitor/status-bar";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { ArrowLeft, Loader2 } from "lucide-react";

interface NativeVideoPlayerProps {
  contentId: string;
  contentType: "movie" | "episode";
  // `streamUrl` is accepted as an alias for `videoUrl` from callers
  videoUrl?: string;
  streamUrl?: string;
  title: string;
  poster?: string;
  subtitleUrl?: string;
  autoPlay?: boolean;
  watermarkText?: string;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      secs,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
};

const NativeVideoPlayer: React.FC<NativeVideoPlayerProps> = ({
  contentId,
  contentType,
  videoUrl,
  streamUrl,
  title,
  poster,
  subtitleUrl,
  autoPlay = true,
}) => {
  const navigate = useNavigate();
  const { saveProgress, getLastPosition } = useVideoProgress(
    contentId,
    contentType === "episode" ? "episode" : "movie",
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ time: number; x: number } | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const markReadyIfMediaIsLive = () => {
    const media = videoRef.current;
    if (!media) return;

    const isMediaLoaded =
      media.readyState >= 2 ||
      !!media.currentSrc ||
      (Number.isFinite(media.duration) && media.duration > 0);

    if (isMediaLoaded) {
      setIsReady(true);
    }
  };

  useEffect(() => {
    const readyRef = { current: false };
    const watchdogRef = { id: null as number | null };

    const clearWatchdog = () => {
      if (watchdogRef.id) {
        clearTimeout(watchdogRef.id);
        watchdogRef.id = null;
      }
    };

    const markReady = () => {
      readyRef.current = true;
      setIsReady(true);
      clearWatchdog();
    };

    const startWatchdog = () => {
      clearWatchdog();
      watchdogRef.id = window.setTimeout(() => {
        const media = videoRef.current;
        markReadyIfMediaIsLive();

        if (!readyRef.current && media) {
          try {
            media.pause();
            media.removeAttribute("src");
            media.load();
          } catch (e) {}
        }

        if (!readyRef.current) {
          setPlaybackError(
            "Video unavailable. Playback timed out while loading the stream.",
          );
        }
      }, 30000);
    };

    const mediaEl = videoRef.current;
    const handleMediaError = () => {
      console.error("[NativeVideoPlayer] Core media playback error encountered");
      setPlaybackError(
        "Video unavailable. This video could not be loaded due to a network or server limitation.",
      );
      readyRef.current = false;
      clearWatchdog();
    };

    if (mediaEl) {
      mediaEl.addEventListener("error", handleMediaError, { passive: true });
      mediaEl.addEventListener("loadedmetadata", markReadyIfMediaIsLive, {
        passive: true,
      });
      mediaEl.addEventListener("canplay", markReadyIfMediaIsLive, {
        passive: true,
      });
      mediaEl.addEventListener("playing", markReady, { passive: true });
      mediaEl.addEventListener("progress", markReadyIfMediaIsLive, {
        passive: true,
      });
      mediaEl.addEventListener("timeupdate", () => {
        setCurrentTime(mediaEl.currentTime || 0);
      }, { passive: true });
    }

    const hydratePosition = async () => {
      const startPosition = (await getLastPosition()) || 0;
      if (videoRef.current) {
        videoRef.current.currentTime = startPosition;
        setCurrentTime(startPosition);
      }
      if (autoPlay) {
        try {
          await videoRef.current?.play();
        } catch (e) {}
      }
    };

    videoRef.current?.addEventListener("loadedmetadata", hydratePosition, {
      passive: true,
      once: true,
    });

    startWatchdog();

    return () => {
      clearWatchdog();
      if (mediaEl) {
        mediaEl.removeEventListener("error", handleMediaError);
        mediaEl.removeEventListener("loadedmetadata", markReadyIfMediaIsLive);
        mediaEl.removeEventListener("canplay", markReadyIfMediaIsLive);
        mediaEl.removeEventListener("playing", markReady);
        mediaEl.removeEventListener("progress", markReadyIfMediaIsLive);
      }
    };
  }, [streamUrl, videoUrl, autoPlay, getLastPosition]);

  useEffect(() => {
    return () => {
      if (currentTime > 0 && duration > 0) {
        saveProgress(currentTime, duration);
      }
    };
  }, [currentTime, duration, saveProgress]);

  // Force hardware orientation to landscape on native apps and hide status bar
  useEffect(() => {
    const restoreAppProfileLayout = async () => {
      try {
        if (typeof ScreenOrientation?.unlock === "function") {
          await ScreenOrientation.unlock();
        }
        if (typeof StatusBar?.show === "function") {
          await StatusBar.show();
        }
      } catch (err) {
        console.warn("Failed to clean up device window layout:", err);
      }
    };

    return () => {
      void restoreAppProfileLayout();
    };
  }, []);

  const handleBackNavigation = async () => {
    try {
      const media = videoRef.current;
      if (media) {
        try {
          media.pause();
        } catch (e) {}
        try {
          media.removeAttribute("src");
        } catch (e) {}
        try {
          media.load();
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Failed to gracefully abort loading stream:", e);
    }

    navigate(-1);
  };

  const handleDoubleTapSeek = (event: React.TouchEvent<HTMLDivElement>) => {
    const media = videoRef.current;
    if (!media) return;

    const touch = event.touches[0];
    if (!touch) return;

    const now = Date.now();
    const lastTouch = touchRef.current;

    if (lastTouch && now - lastTouch.time < 280) {
      const delta = touch.clientX - lastTouch.x;
      const nextTime = Math.min(
        Math.max((media.currentTime || 0) + (delta > 0 ? 10 : -10), 0),
        media.duration || 0,
      );
      media.currentTime = nextTime;
      setCurrentTime(nextTime);
      touchRef.current = null;
      return;
    }

    touchRef.current = { time: now, x: touch.clientX };
  };
  const resolvedVideoUrl = streamUrl ?? videoUrl ?? null;

  if (playbackError) {
    return (
      <div
        className="ux-player-container error-state"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#000",
          color: "#fff",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "#141414",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "420px",
            width: "100%",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#E50914",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Playback Error
          </span>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: "12px 0 8px 0",
              color: "#fff",
            }}
          >
            Video Unavailable
          </h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
              margin: "0 0 24px 0",
            }}
          >
            {playbackError}
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="native-player-shell"
      onTouchStart={handleDoubleTapSeek}
      style={{
        background: "#000000",
        minHeight: "100vh",
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        overflow: "hidden",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
        ["--plyr-color-main" as any]: "hsl(var(--foreground, 0 0% 98%))",
        ["--plyr-control-icon-size" as any]: "18px",
        ["--plyr-control-radius" as any]: "12px",
        ["--plyr-menu-background" as any]: "rgba(12, 12, 12, 0.96)",
      }}
    >
      <div className="cinema-top-navigation-bar absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-5 pb-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent">
        <button
          onClick={handleBackNavigation}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-white backdrop-blur-md transition hover:bg-black/60"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="max-w-[55%] truncate text-sm font-medium text-white/90">
          {title}
        </div>

        <div className="w-10" />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-5 pt-10">
        <div className="flex items-center justify-between gap-3 text-[11px] text-white/80">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {!isReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <Loader2 className="h-9 w-9 animate-spin text-[#FD8208]" />
        </div>
      )}

      <div
        className="mx-auto w-full max-w-full"
        style={{
          aspectRatio: "16 / 9",
          width: "100%",
          maxWidth: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isReady ? 1 : 0,
          pointerEvents: isReady ? "auto" : "none",
        }}
      >
        <video
          ref={videoRef}
          src={resolvedVideoUrl ?? undefined}
          key={resolvedVideoUrl || "native-player-video"}
          autoPlay={autoPlay}
          playsInline
          controls
          muted={false}
          preload="metadata"
          poster={poster ?? undefined}
          className="h-full w-full object-cover"
          onLoadedMetadata={async () => {
            const startPosition = (await getLastPosition()) || 0;
            if (videoRef.current) {
              videoRef.current.currentTime = startPosition;
              setCurrentTime(startPosition);
            }
            setDuration(videoRef.current?.duration || 0);
            markReadyIfMediaIsLive();
            if (autoPlay) {
              videoRef.current?.play().catch(() => {});
            }
          }}
          onCanPlay={() => {
            const media = videoRef.current;
            if (!media) return;
            setDuration(media.duration || 0);
            setCurrentTime(media.currentTime || 0);
            markReadyIfMediaIsLive();
            if (autoPlay) {
              media.play().catch(() => {});
            }
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime || 0);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            setPlaybackError(
              "Video unavailable. This video could not be loaded due to a network or server limitation.",
            );
          }}
          onEnded={() => setIsPlaying(false)}
          style={{
            background: "#000",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-2 pb-2">
        <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/75 backdrop-blur-md">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FD8208]" />
          {isPlaying ? "Playing" : "Ready"}
        </div>
      </div>
    </div>
  );
};

export default NativeVideoPlayer;
