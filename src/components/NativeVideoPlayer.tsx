import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar, Style } from "@capacitor/status-bar";
import { ExoPlayer } from "@/plugins/exo-player";
import { Preferences } from "@capacitor/preferences";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { ArrowLeft, Loader2 } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";

interface NativeVideoPlayerProps {
  contentId: string;
  contentType: "movie" | "episode";
  videoUrl: string;
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
  const playerRef = useRef<Plyr | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ time: number; x: number } | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const supported = native && (platform === "ios" || platform === "android");
    setIsNativePlatform(supported);

    if (!supported) return;

    try {
      // Try to provide a cinema-like experience by hiding the status bar
      // and strictly requesting landscape orientation. We attempt multiple
      // approaches so it works reliably across Android and iOS Capacitor builds.
      if (Capacitor.isPluginAvailable("StatusBar")) {
        StatusBar.setOverlaysWebView({ overlay: true });
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.hide();
      }

      // Primary attempt: use the official ScreenOrientation plugin.
      if (Capacitor.isPluginAvailable("ScreenOrientation")) {
        // Request both landscape variants to be permissive across platforms.
        // Some devices/reserved APIs respond better to the explicit primary variant.
        void ScreenOrientation.lock({ orientation: "landscape" }).catch(() =>
          // best-effort fallback to primary landscape if plain "landscape" fails
          ScreenOrientation.lock({ orientation: "landscape-primary" }).catch(
            () => undefined,
          ),
        );
        // Also attempt to call the native ExoPlayer plugin which exposes a
        // platform-specific orientation API on Android.
        try {
          if (ExoPlayer && typeof ExoPlayer.lockOrientation === "function") {
            void ExoPlayer.lockOrientation().catch(() => {});
          }
        } catch (e) {
          // ignore
        }
        try {
          void Preferences.set({ key: "forceLandscape", value: "true" });
        } catch (e) {}
      }

      // Secondary/fallback: attempt a programmatic rotation via the webview
      // bridge. This is a non-standard best-effort step that may be picked up
      // by some Capacitor native wrappers that forward such requests.
      try {
        const win = window as any;
        if (win && win.Capacitor && win.Capacitor.Plugins) {
          const so = win.Capacitor.Plugins.ScreenOrientation;
          if (so && typeof so.lock === "function") {
            void so.lock({ orientation: "landscape" });
          }
        }
      } catch (e) {
        // non-fatal
      }
    } catch (error) {
      console.warn("Native video shell setup failed:", error);
    }

    return () => {
      try {
        // Restore normal behaviour when leaving the player: unlock screen
        // orientation and show the status bar again. Use best-effort calls
        // and swallow errors so unmount remains safe.
        try {
          if (Capacitor.isPluginAvailable("ScreenOrientation")) {
            void ScreenOrientation.unlock();
          }
        } catch (e) {
          // ignore
        }

        try {
          if (Capacitor.isPluginAvailable("StatusBar")) {
            StatusBar.show();
            StatusBar.setStyle({ style: Style.Light });
          }
        } catch (e) {
          // ignore
        }
        try {
          if (ExoPlayer && typeof ExoPlayer.unlockOrientation === "function") {
            void ExoPlayer.unlockOrientation().catch(() => {});
          }
        } catch (e) {
          // ignore
        }

        try {
          void Preferences.set({ key: "forceLandscape", value: "false" });
        } catch (e) {}
      } catch (error) {
        console.warn("Native video shell cleanup failed:", error);
      }
    };
  }, []);

  useEffect(() => {
    if (!isNativePlatform || !videoRef.current) return;

    const video = videoRef.current;
    const player = new Plyr(video, {
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
      autoplay: autoPlay,
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
      fullscreen: { enabled: true, iosNative: true },
      loadSprite: true,
    });

    playerRef.current = player;

    const handleReady = async () => {
      setIsReady(true);
      const startPosition = (await getLastPosition()) || 0;
      if (
        startPosition > 5 &&
        video.duration &&
        startPosition < video.duration - 5
      ) {
        video.currentTime = startPosition;
        setCurrentTime(startPosition);
      }

      if (autoPlay) {
        void Promise.resolve(player.play()).catch(() => undefined);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setCurrentTime(video.currentTime || 0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    player.on("ready", handleReady);
    player.on("timeupdate", handleTimeUpdate);
    player.on("loadedmetadata", handleLoadedMetadata);
    player.on("play", handlePlay);
    player.on("pause", handlePause);
    // Fullscreen enter/exit handlers to provide native-like cinema mode
    const handleEnterFullscreen = async () => {
      try {
        if (Capacitor.isPluginAvailable("StatusBar")) {
          await StatusBar.hide();
        }
        if (Capacitor.isPluginAvailable("ScreenOrientation")) {
          await ScreenOrientation.lock({ orientation: "landscape" });
          try {
            if (ExoPlayer && typeof ExoPlayer.lockOrientation === "function") {
              await ExoPlayer.lockOrientation();
            }
          } catch (e) {}
        }
      } catch (err) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.warn("enter fullscreen handling failed:", err);
      }
    };

    const handleExitFullscreen = async () => {
      try {
        if (Capacitor.isPluginAvailable("ScreenOrientation")) {
          await ScreenOrientation.unlock();
          try {
            if (
              ExoPlayer &&
              typeof ExoPlayer.unlockOrientation === "function"
            ) {
              await ExoPlayer.unlockOrientation();
            }
          } catch (e) {}
        }
        if (Capacitor.isPluginAvailable("StatusBar")) {
          await StatusBar.show();
          await StatusBar.setStyle({ style: Style.Light });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("exit fullscreen handling failed:", err);
      }
    };

    player.on("enterfullscreen", handleEnterFullscreen);
    player.on("exitfullscreen", handleExitFullscreen);

    video.src = videoUrl;
    video.poster = poster || "";
    video.setAttribute("playsinline", "true");
    video.setAttribute("preload", "metadata");

    return () => {
      player.off("ready", handleReady);
      player.off("timeupdate", handleTimeUpdate);
      player.off("loadedmetadata", handleLoadedMetadata);
      player.off("play", handlePlay);
      player.off("pause", handlePause);
      player.destroy();
      playerRef.current = null;
    };
  }, [
    autoPlay,
    contentId,
    getLastPosition,
    isNativePlatform,
    poster,
    videoUrl,
  ]);

  useEffect(() => {
    return () => {
      if (currentTime > 0 && duration > 0) {
        saveProgress(currentTime, duration);
      }
    };
  }, [currentTime, duration, saveProgress]);

  const handleBack = () => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    navigate(-1);
  };

  const handleDoubleTapSeek = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;

    const touch = event.touches[0];
    if (!touch) return;

    const now = Date.now();
    const lastTouch = touchRef.current;

    if (lastTouch && now - lastTouch.time < 280) {
      const delta = touch.clientX - lastTouch.x;
      const nextTime = Math.min(
        Math.max(videoRef.current.currentTime + (delta > 0 ? 10 : -10), 0),
        videoRef.current.duration || 0,
      );
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      touchRef.current = null;
      return;
    }

    touchRef.current = { time: now, x: touch.clientX };
  };

  if (!isNativePlatform) {
    return (
      <VideoPlayer
        src={videoUrl}
        contentId={contentId}
        contentType={contentType}
        title={title}
        poster={poster}
        subtitleUrl={subtitleUrl}
        autoPlay={autoPlay}
        immersive={true}
      />
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
        position: "relative",
        overflow: "hidden",
        color: "white",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
        ["--plyr-color-main" as any]: "#FD8208",
        ["--plyr-control-icon-size" as any]: "18px",
        ["--plyr-control-radius" as any]: "12px",
        ["--plyr-menu-background" as any]: "rgba(12, 12, 12, 0.96)",
      }}
    >
      <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-5 pb-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent">
        <button
          onClick={handleBack}
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
        style={{ aspectRatio: "16 / 9" }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          controls={false}
          playsInline
          poster={poster}
          preload="metadata"
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
