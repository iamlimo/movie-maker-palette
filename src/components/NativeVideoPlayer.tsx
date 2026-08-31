import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plyr } from "plyr-react";
import "plyr/dist/plyr.css";
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

  const plyrRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ time: number; x: number } | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    const player = plyrRef.current?.plyr as any | undefined;
    const readyRef = { current: false };
    const watchdogRef = { id: null as number | null };
    let styleEl: HTMLStyleElement | null = null;

    const ensureTopNavStyle = () => {
      try {
        styleEl = document.createElement("style");
        styleEl.setAttribute("data-native-player-topnav", "1");
        styleEl.innerHTML = `
          .cinema-top-navigation-bar { z-index: 100001 !important; pointer-events: auto !important; }
          .native-player-shell { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: #000 !important; }
        `;
        document.head.appendChild(styleEl);
      } catch (e) {
        // ignore
      }
    };
    ensureTopNavStyle();

    const clearWatchdog = () => {
      try {
        if (watchdogRef.id) {
          clearTimeout(watchdogRef.id);
          watchdogRef.id = null;
        }
      } catch (e) {}
    };

    const markReady = () => {
      readyRef.current = true;
      setIsReady(true);
      clearWatchdog();
    };

    const markReadyIfMediaIsLive = () => {
      const media = plyrRef.current?.plyr?.media as
        | HTMLMediaElement
        | undefined;

      if (!media) return;

      const isMediaLoaded =
        media.readyState >= 2 ||
        !!media.currentSrc ||
        Number.isFinite(media.duration) && media.duration > 0;

      if (isMediaLoaded) {
        markReady();
      }
    };

    const startWatchdog = () => {
      clearWatchdog();
      try {
        watchdogRef.id = window.setTimeout(() => {
          const media = plyrRef.current?.plyr?.media as
            | HTMLMediaElement
            | undefined;

          markReadyIfMediaIsLive();

          if (!readyRef.current && media) {
            try {
              media.pause();
              media.src = "";
              media.load();
            } catch (e) {}
          }

          if (!readyRef.current) {
            setPlaybackError(
              "Video unavailable. Playback timed out while loading the stream.",
            );
          }
        }, 30000);
      } catch (e) {}
    };

    const mediaEl = plyrRef.current?.plyr?.media ?? null;

    const handleMediaError = (event: any) => {
      console.error(
        "[NativeVideoPlayer] Core media playback error encountered:",
        event,
      );
      setPlaybackError(
        "Video unavailable. This video could not be loaded due to a network or server limitation.",
      );
      readyRef.current = false;
      clearWatchdog();
    };

    if (player && player.on) {
      player.on("error", handleMediaError);
    }

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
    }

    const handleReady = async () => {
      markReady();
      const startPosition = (await getLastPosition()) || 0;
      try {
        if (mediaEl) {
          mediaEl.currentTime = startPosition;
          setCurrentTime(startPosition);
        }
      } catch (e) {}

      if (autoPlay) {
        try {
          await plyrRef.current?.plyr?.play();
        } catch {}
      }
    };

    const handleTimeUpdate = () => {
      try {
        const t = (mediaEl as HTMLMediaElement)?.currentTime || 0;
        setCurrentTime(t);
      } catch {}
    };

    const handleLoaded = () => {
      try {
        const d = (mediaEl as HTMLMediaElement)?.duration || 0;
        setDuration(d);
        setCurrentTime((mediaEl as HTMLMediaElement)?.currentTime || 0);
      } catch {}
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    try {
      if (player && player.on) {
        player.on("ready", handleReady);
        player.on("timeupdate", handleTimeUpdate);
        player.on("loadedmetadata", handleLoaded);
        player.on("play", handlePlay);
        player.on("pause", handlePause);
      }
    } catch (e) {}

    const onDomTime = () => handleTimeUpdate();
    if (mediaEl)
      mediaEl.addEventListener("timeupdate", onDomTime, { passive: true });

    startWatchdog();

    return () => {
      try {
        if (styleEl && styleEl.parentNode)
          styleEl.parentNode.removeChild(styleEl);
      } catch (e) {}

      try {
        clearWatchdog();
      } catch (e) {}
      try {
        if (player && player.off) {
          player.off("error", handleMediaError);
          player.off("ready", handleReady);
          player.off("timeupdate", handleTimeUpdate);
          player.off("loadedmetadata", handleLoaded);
          player.off("play", handlePlay);
          player.off("pause", handlePause);
        }
      } catch {}
      try {
        if (mediaEl) {
          mediaEl.removeEventListener(
            "error",
            handleMediaError as EventListener,
          );
          mediaEl.removeEventListener("timeupdate", onDomTime as any);
          mediaEl.removeEventListener("canplay", markReadyIfMediaIsLive as any);
          mediaEl.removeEventListener(
            "loadedmetadata",
            markReadyIfMediaIsLive as any,
          );
          mediaEl.removeEventListener("playing", markReady as any);
          mediaEl.removeEventListener("progress", markReadyIfMediaIsLive as any);
        }
      } catch {}
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
    const forceCinemaLayoutOnDevice = async () => {
      try {
        // Force the phone to flip horizontally sideways immediately
        await ScreenOrientation.lock({ orientation: "landscape" } as any);
        await StatusBar.hide();
      } catch (err) {
        console.warn(
          "Native orientation locks only execute inside compiled mobile app wrappers:",
          err,
        );
      }
    };

    forceCinemaLayoutOnDevice();

    // --- THE CRITICAL REVERT CLEANUP ---
    // When the user leaves the player or clicks back, immediately restore portrait profile rules
    return () => {
      const restoreAppProfileLayout = async () => {
        try {
          await ScreenOrientation.unlock();
          await ScreenOrientation.lock({ orientation: "portrait" } as any);
          await StatusBar.show();
        } catch (err) {
          console.error("Failed to clean up device window layout:", err);
        }
      };
      restoreAppProfileLayout();
    };
  }, []);

  const handleBackNavigation = async () => {
    try {
      const player = plyrRef.current?.plyr;
      if (player && player.media) {
        try {
          player.media.pause();
        } catch (e) {}
        try {
          player.media.src = ""; // Empties the stream allocation path
        } catch (e) {}
        try {
          player.media.load(); // Forces browser to dump the hanging network sockets
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Failed to gracefully abort loading stream:", e);
    }

    try {
      plyrRef.current?.plyr?.destroy();
    } catch (e) {}

    // Route back safely now that the thread is unfrozen
    navigate(-1);
  };

  const handleDoubleTapSeek = (event: React.TouchEvent<HTMLDivElement>) => {
    const media = plyrRef.current?.plyr?.media as HTMLMediaElement | undefined;
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

  const options = {
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "mute",
      "volume",
      "fullscreen",
    ],
    invertTime: false,
    // disable Plyr autoplay to avoid early auto-initialized UI in webviews
    autoplay: false,
    muted: false,
    clickToPlay: true,
    keyboard: { focused: true, global: false },
    i18n: {
      restart: "Restart",
      rewind: "Rewind 10s",
      play: "Play",
      pause: "Pause",
      fastForward: "Forward 10s",
      currentTime: "Current time",
      duration: "Duration",
      mute: "Mute",
      unmute: "Unmute",
      volume: "Volume",
      fullscreen: "Fullscreen",
    },
    ratio: "16:9",
    hideControls: false,
    tooltips: { controls: true, seek: true },
    playsinline: true,
    webkitPlaysinline: true,
    fullscreen: {
      enabled: true,
      fallback: true,
      iosNative: false,
      // Use the app's own viewport instead of the native OS fullscreen controller.
      container: wrapperRef.current ?? undefined,
    },
    loadSprite: true,
  } as any;

  const source = {
    type: "video",
    title: title ?? "",
    poster: poster ?? undefined,
    sources: [
      {
        src: typeof resolvedVideoUrl === "string" ? resolvedVideoUrl : "",
        crossorigin: "anonymous",
        type:
          typeof resolvedVideoUrl === "string" &&
          resolvedVideoUrl.includes(".m3u8")
            ? "application/x-mpegURL"
            : "video/mp4",
      },
    ],
  } as any;

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
          // hide the player visually until it's fully ready to avoid tiny preview UI
          opacity: isReady ? 1 : 0,
          pointerEvents: isReady ? "auto" : "none",
        }}
      >
        <Plyr ref={plyrRef} source={source} options={options} />
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
