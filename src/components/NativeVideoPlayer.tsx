import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plyr } from "plyr-react";
import "plyr/dist/plyr.css";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { ArrowLeft, Loader2 } from "lucide-react";

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

  const plyrRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ time: number; x: number } | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const player = plyrRef.current?.plyr as any | undefined;
    let hls: any | undefined;

    const attachHls = (media: HTMLMediaElement | null) => {
      if (!media) return;
      try {
        // lazy-load HLS if .m3u8 and supported
        if (videoUrl.includes(".m3u8")) {
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported && Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(media);
          } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
            media.src = videoUrl;
          }
        } else {
          media.src = videoUrl;
        }
      } catch (err) {
        // non-fatal
      }
    };

    const mediaEl = plyrRef.current?.plyr?.media ?? null;
    attachHls(mediaEl as HTMLMediaElement | null);

    const handleReady = async () => {
      setIsReady(true);
      const startPosition = (await getLastPosition()) || 0;
      try {
        if (
          startPosition > 5 &&
          mediaEl &&
          mediaEl.duration &&
          startPosition < mediaEl.duration - 5
        ) {
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

    return () => {
      try {
        if (player && player.off) {
          player.off("ready", handleReady);
          player.off("timeupdate", handleTimeUpdate);
          player.off("loadedmetadata", handleLoaded);
          player.off("play", handlePlay);
          player.off("pause", handlePause);
        }
      } catch {}
      try {
        if (mediaEl)
          mediaEl.removeEventListener("timeupdate", onDomTime as any);
      } catch {}
      try {
        if (hls) {
          hls.destroy();
          hls = undefined;
        }
      } catch {}
    };
  }, [videoUrl, autoPlay, getLastPosition]);

  useEffect(() => {
    return () => {
      if (currentTime > 0 && duration > 0) {
        saveProgress(currentTime, duration);
      }
    };
  }, [currentTime, duration, saveProgress]);

  const handleBack = () => {
    try {
      plyrRef.current?.plyr?.destroy();
    } catch (e) {}
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
        src: videoUrl,
        type: videoUrl.includes(".m3u8")
          ? "application/x-mpegURL"
          : "video/mp4",
      },
    ],
  } as any;

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
        style={{
          aspectRatio: "16 / 9",
          width: "100%",
          maxWidth: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
