import React, { useEffect, useRef, useState, useCallback } from "react";
import { Plyr } from "plyr-react";
import Hls from "hls.js";
import "plyr/dist/plyr.css";
import "./MobileMoviePlayer.css";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar } from "@capacitor/status-bar";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
  Eye,
} from "lucide-react";

interface MobilePlayerProps {
  streamUrl: string;
  poster?: string;
  title?: string;
  subtitleUrl?: string;
  autoPlay?: boolean;
}

const MobileMoviePlayer: React.FC<MobilePlayerProps> = ({
  streamUrl,
  poster,
  title,
  subtitleUrl,
  autoPlay = true,
}) => {
  const plyrRef = useRef<any>(null);
  const [showControls, setShowControls] = useState(true);
  const [alwaysShowControls, setAlwaysShowControls] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    if (!alwaysShowControls) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [alwaysShowControls]);

  const showAndReset = useCallback(() => {
    setShowControls(true);
    resetHideTimer();
  }, [resetHideTimer]);
  // Note: do not lock orientation on mount — allow user to rotate freely.
  // We lock to landscape only when entering fullscreen (see handlers below).

  useEffect(() => {
    const player = plyrRef.current?.plyr as any | undefined;
    let hls: Hls | undefined;
    const attachHls = (media: HTMLMediaElement | null) => {
      if (!media) return;
      if (streamUrl.includes(".m3u8")) {
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(streamUrl);
          hls.attachMedia(media);
        } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
          media.src = streamUrl;
        }
      } else {
        media.src = streamUrl;
      }
    };

    const mediaEl =
      player?.media ??
      (document.querySelector("video") as HTMLVideoElement | null);
    attachHls(mediaEl);

    // Add fullscreen enter/exit handlers to ensure fullscreen works across mobile browsers
    const handleEnter = async () => {
      try {
        if (
          Capacitor.isPluginAvailable &&
          Capacitor.isPluginAvailable("StatusBar")
        ) {
          await StatusBar.hide();
        }
        if (
          Capacitor.isPluginAvailable &&
          Capacitor.isPluginAvailable("ScreenOrientation")
        ) {
          await ScreenOrientation.lock({ orientation: "landscape" });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("mobile enter fullscreen failed:", err);
      }

      // Ensure document fullscreen on browsers, fallback to webkit iOS fullscreen
      try {
        const media = player?.media as HTMLMediaElement | undefined;
        if (media) {
          if (media.requestFullscreen && !document.fullscreenElement) {
            await media.requestFullscreen().catch(() => undefined);
          } else if ((media as any).webkitEnterFullscreen) {
            try {
              (media as any).webkitEnterFullscreen();
            } catch {}
          }
        }
      } catch {}
    };

    const handleExit = async () => {
      try {
        if (
          Capacitor.isPluginAvailable &&
          Capacitor.isPluginAvailable("ScreenOrientation")
        ) {
          await ScreenOrientation.unlock();
        }
        if (
          Capacitor.isPluginAvailable &&
          Capacitor.isPluginAvailable("StatusBar")
        ) {
          await StatusBar.show();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("mobile exit fullscreen failed:", err);
      }

      try {
        if (document.fullscreenElement)
          await document.exitFullscreen().catch(() => undefined);
        // webkit exit fallback
        if ((document as any).webkitFullscreenElement) {
          try {
            (document as any).webkitExitFullscreen();
          } catch {}
        }
      } catch {}
    };

    try {
      if (player && player.on) {
        player.on("enterfullscreen", handleEnter);
        player.on("exitfullscreen", handleExit);
        player.on("play", () => setIsPlaying(true));
        player.on("pause", () => setIsPlaying(false));
      }
    } catch (err) {
      // ignore
    }

    // show controls on interaction and start timer
    const userActivity = () => showAndReset();
    document.addEventListener("touchstart", userActivity, { passive: true });
    document.addEventListener("mousemove", userActivity);

    const fsChange = () => {
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement
      ) {
        void handleExit();
      }
    };
    document.addEventListener("fullscreenchange", fsChange);
    document.addEventListener("webkitfullscreenchange", fsChange);
    // start auto-hide timer
    resetHideTimer();
    return () => {
      try {
        if (hls) {
          hls.destroy();
          hls = undefined;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("HLS cleanup failed:", err);
      }
      try {
        if (player && player.off) {
          player.off("enterfullscreen", () => undefined);
          player.off("exitfullscreen", () => undefined);
        }
      } catch {}
      document.removeEventListener("fullscreenchange", fsChange);
      document.removeEventListener("webkitfullscreenchange", fsChange);
      document.removeEventListener("touchstart", userActivity);
      document.removeEventListener("mousemove", userActivity);
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [streamUrl]);

  const mobileOptions = {
    controls: [
      "play-large",
      "rewind",
      "play",
      "fast-forward",
      "progress",
      "current-time",
      "duration",
      "settings",
      "fullscreen",
    ],
    seekTime: 10,
    tooltips: { controls: false, seek: true },
    autoplay: autoPlay,
    hideControls: false,
    clickToPlay: true,
  } as any;

  const source = {
    type: "video",
    title: title ?? "",
    poster: poster ?? undefined,
    sources: [
      {
        src: streamUrl,
        type: streamUrl.includes(".m3u8")
          ? "application/x-mpegURL"
          : "video/mp4",
      },
    ],
  } as any;

  return (
    <div className="mobile-cinema-container">
      <div
        className="relative w-full h-full"
        onTouchStart={() => showAndReset()}
        onMouseMove={() => showAndReset()}
      >
        <Plyr ref={plyrRef} source={source} options={mobileOptions} />

        {/* Custom control overlay */}
        <div
          className={`absolute inset-0 flex flex-col justify-end items-stretch pointer-events-none transition-opacity duration-200 mobile-controls-overlay ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-auto px-4 pb-6">
            <div className="flex items-center justify-between gap-3 mobile-controls-bar">
              <div className="flex items-center gap-2">
                <button
                  aria-label="Replay 10s"
                  onClick={() => {
                    const player = plyrRef.current?.plyr as any | undefined;
                    if (player) {
                      try {
                        player.currentTime = Math.max(
                          0,
                          (player.currentTime || 0) - 10,
                        );
                      } catch {}
                    }
                    showAndReset();
                  }}
                  className="p-2 rounded-full text-white"
                >
                  <SkipBack size={18} />
                </button>

                <button
                  aria-label="Play/Pause"
                  onClick={() => {
                    const player = plyrRef.current?.plyr as any | undefined;
                    if (!player) return;
                    if (isPlaying) player.pause();
                    else player.play();
                    showAndReset();
                  }}
                  className="p-2 rounded-full text-white"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>

                <button
                  aria-label="Forward 10s"
                  onClick={() => {
                    const player = plyrRef.current?.plyr as any | undefined;
                    if (player) {
                      try {
                        player.currentTime = Math.min(
                          player.duration || 0,
                          (player.currentTime || 0) + 10,
                        );
                      } catch {}
                    }
                    showAndReset();
                  }}
                  className="p-2 rounded-full text-white"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label="Toggle always show controls"
                  onClick={() => {
                    setAlwaysShowControls((v) => {
                      const next = !v;
                      if (next) {
                        if (hideTimeoutRef.current) {
                          window.clearTimeout(hideTimeoutRef.current);
                          hideTimeoutRef.current = null;
                        }
                        setShowControls(true);
                      } else {
                        resetHideTimer();
                      }
                      return next;
                    });
                  }}
                  className={`p-2 rounded-md text-white ${
                    alwaysShowControls ? "bg-white/10" : ""
                  }`}
                >
                  <Eye size={16} />
                </button>

                <button
                  aria-label="Fullscreen"
                  onClick={() => {
                    const player = plyrRef.current?.plyr as any | undefined;
                    if (!player) return;
                    if (
                      document.fullscreenElement ||
                      (document as any).webkitFullscreenElement
                    ) {
                      document.exitFullscreen().catch(() => undefined);
                    } else {
                      const media = player.media as
                        | HTMLMediaElement
                        | undefined;
                      if (media) {
                        if (media.requestFullscreen)
                          media.requestFullscreen().catch(() => undefined);
                        else if ((media as any).webkitEnterFullscreen)
                          (media as any).webkitEnterFullscreen();
                      }
                    }
                  }}
                  className="p-2 rounded-full text-white"
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMoviePlayer;
