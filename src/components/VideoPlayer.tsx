import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar, Style } from "@capacitor/status-bar";
import { ExoPlayer } from "@/plugins/exo-player";
import { Preferences } from "@capacitor/preferences";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  type MediaPlayerInstance,
} from "@vidstack/react";
import "@vidstack/react/player/styles/default/theme.css";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  onBack?: () => void;
}

export const VideoPlayer = ({
  src,
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
  contentType,
  onBack,
}: VideoPlayerProps) => {
  const [isPaused, setIsPaused] = useState(!autoPlay);
  const [playerError, setPlayerError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<MediaPlayerInstance | null>(null);

  const handleClose = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "/";
  }, [onBack]);

  const isTypingTarget = (target: EventTarget | null) => {
    const node = target as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    const isEditable = node.isContentEditable;
    return tag === "input" || tag === "textarea" || isEditable;
  };

  useEffect(() => {
    if (!src) {
      setPlayerError("Video is not available right now.");
      return;
    }

    setPlayerError("");
  }, [src]);

  useEffect(() => {
    // Ensure that if native screen orientation was locked by other components/plugins,
    // we unlock it when this player unmounts so the app returns to normal auto-rotation.
    return () => {
      try {
        if (
          Capacitor.isPluginAvailable &&
          Capacitor.isPluginAvailable("ScreenOrientation")
        ) {
          ScreenOrientation.unlock();
        }
      } catch (error) {
        // keep non-fatal: log for visibility
        // eslint-disable-next-line no-console
        console.warn("ScreenOrientation unlock failed:", error);
      }
    };
  }, []);

  useEffect(() => {
    // When in immersive mode on native platforms, request a strict landscape
    // fullscreen experience and hide the status bar. Cleanup restores defaults.
    const native = Capacitor.isNativePlatform && Capacitor.isNativePlatform();
    if (!native || !immersive) return;

    try {
      if (Capacitor.isPluginAvailable("StatusBar")) {
        StatusBar.setOverlaysWebView({ overlay: true });
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.hide();
      }

      if (Capacitor.isPluginAvailable("ScreenOrientation")) {
        void ScreenOrientation.lock({ orientation: "landscape" }).catch(() =>
          ScreenOrientation.lock({ orientation: "landscape-primary" }).catch(
            () => undefined,
          ),
        );
        try {
          if (ExoPlayer && typeof ExoPlayer.lockOrientation === "function") {
            void ExoPlayer.lockOrientation().catch(() => {});
          }
        } catch (e) {
          // ignore
        }
        try {
          void Preferences.set({ key: "forceLandscape", value: "true" });
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // non-fatal
    }

    return () => {
      try {
        if (Capacitor.isPluginAvailable("ScreenOrientation")) {
          void ScreenOrientation.unlock();
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
    };
  }, [immersive]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!containerRef.current || !target) return;
      if (containerRef.current.contains(target)) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;

      if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (playerRef.current) {
          if (playerRef.current.paused) {
            void playerRef.current.play();
          } else {
            void playerRef.current.pause();
          }
        }
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!containerRef.current) return;
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void containerRef.current.requestFullscreen();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (playerRef.current) {
          playerRef.current.currentTime = Math.min(
            playerRef.current.currentTime + 10,
            playerRef.current.duration || 0,
          );
        }
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (playerRef.current) {
          playerRef.current.currentTime = Math.max(
            playerRef.current.currentTime - 10,
            0,
          );
        }
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        const nextValue = !isMuted;
        if (playerRef.current) {
          playerRef.current.muted = nextValue;
        }
        setIsMuted(nextValue);
      }
    };

    const current = containerRef.current;
    current?.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      current?.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMuted]);

  const label = [
    title,
    episodeTitle,
    seasonNumber && episodeNumber
      ? `S${seasonNumber} • E${episodeNumber}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const mediaHeader =
    contentType === "episode"
      ? "Episode"
      : contentType === "season"
      ? "Season"
      : contentType === "movie"
      ? "Movie"
      : "Watch";

  const playerStyle: CSSProperties & Record<`--${string}`, string | number> = {
    ["--media-brand" as `--${string}`]: "#FD8208",
    ["--media-brand-hover" as `--${string}`]: "#FF9C3A",
    ["--media-focus-ring-color" as `--${string}`]: "#FD8208",
    ["--media-slider-track-fill-bg" as `--${string}`]: "#FD8208",
    ["--media-slider-track-buffer-bg" as `--${string}`]:
      "rgba(255,255,255,0.3)",
    ["--media-slider-thumb-bg" as `--${string}`]: "#ffffff",
    ["--media-menu-bg" as `--${string}`]: "rgba(9, 9, 11, 0.94)",
    ["--media-menu-item-hover-bg" as `--${string}`]: "rgba(253, 130, 8, 0.16)",
    ["--media-control-hover-bg" as `--${string}`]: "rgba(253, 130, 8, 0.18)",
    ["--media-control-color" as `--${string}`]: "#ffffff",
    ["--media-button-bg" as `--${string}`]: "rgba(255,255,255,0.06)",
    ["--media-button-hover-bg" as `--${string}`]: "rgba(253, 130, 8, 0.2)",
    ["--media-button-text" as `--${string}`]: "#fff",
    ["--media-text-color" as `--${string}`]: "#fff",
    ["--media-range-track-height" as `--${string}`]: "0.25rem",
    ["--media-range-thumb-size" as `--${string}`]: "0.9rem",
  };

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#060606] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ${
        immersive ? "h-screen w-full" : "aspect-video w-full"
      } ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsHovering(true)}
      onBlur={() => setIsHovering(false)}
      aria-label={`Video player for ${title ?? "content"}`}
    >
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/45 via-transparent to-black/25 pointer-events-none" />

      <button
        type="button"
        onClick={handleClose}
        className={`absolute left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-md transition-all duration-200 hover:bg-black/60 ${
          isHovering
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 -translate-y-2"
        }`}
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div
        className={`absolute right-4 top-4 z-30 flex items-center gap-2 transition-opacity duration-200 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-white/70 backdrop-blur-md">
          HD
        </div>
      </div>


      {playerError ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 px-6">
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#FD8208]">
              Playback error
            </p>
            <h3 className="mt-4 text-2xl font-semibold text-white">
              Video unavailable
            </h3>
            <p className="mt-2 text-sm text-slate-300">{playerError}</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-6 bg-[#FD8208] text-black hover:bg-[#ff9b4a]"
            >
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <MediaPlayer
          ref={playerRef}
          src={src}
          title={title || "Signature TV"}
          poster={poster}
          className="sig-player h-full w-full"
          style={playerStyle}
          playsInline
          preload="metadata"
          autoPlay={autoPlay}
          onPlay={() => setIsPaused(false)}
          onPause={() => setIsPaused(true)}
          onError={() => setPlayerError("This video could not be loaded.")}
        >
          <MediaProvider>
            {subtitleUrl && (
              <Track
                kind="subtitles"
                src={subtitleUrl}
                lang="en"
                label="English"
                default
              />
            )}
          </MediaProvider>
          <DefaultVideoLayout
            icons={defaultLayoutIcons}
            className="!absolute inset-0"
          />
        </MediaPlayer>
      )}

      {!playerError && isPaused && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-end p-5 md:p-8">
          <div className="max-w-xl rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_16px_32px_rgba(0,0,0,0.4)] backdrop-blur-md md:p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#FD8208]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FD8208]" />
              {mediaHeader}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white md:text-4xl">
              {title}
            </h2>
            {(episodeTitle || description) && (
              <p className="mt-2 max-w-lg text-sm text-slate-200 md:text-base">
                {episodeTitle || description}
              </p>
            )}
            {(seasonNumber || episodeNumber) && (
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                {seasonNumber ? `Season ${seasonNumber}` : "Season"}
                {episodeNumber ? ` • Episode ${episodeNumber}` : ""}
              </p>
            )}
          </div>
        </div>
      )}


      {!poster && !src && !playerError && (
        <div className="absolute inset-0 z-10 bg-black/30">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      )}
    </div>
  );
};
