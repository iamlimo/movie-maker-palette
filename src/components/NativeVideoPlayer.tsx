import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VideoPlayer } from "./VideoPlayer";
import { Capacitor } from "@capacitor/core";
import { VideoPlayer as CapgoVideoPlayer } from "@capgo/capacitor-video-player";
import { useToast } from "@/hooks/use-toast";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import {
  Loader2,
  ChevronLeft,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

const isHls = (url: string) => /\.m3u8($|\?)/i.test(url);

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
  const { toast } = useToast();
  const { saveProgress, getLastPosition } = useVideoProgress(
    contentId,
    contentType === "episode" ? "episode" : "movie",
  );
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === "android";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSavedRef = useRef(0);
  const loadedRef = useRef(false);
  const [capgoAvailable, setCapgoAvailable] = useState(false);
  const capgoPlayerRef = useRef<any>(null);
  const capgoModuleRef = useRef<any>(null);
  const capgoPollRef = useRef<number | null>(null);
  const [nativeIsPlaying, setNativeIsPlaying] = useState(false);
  const [nativeCurrentTime, setNativeCurrentTime] = useState(0);
  const [nativeDuration, setNativeDuration] = useState(0);

  const [showControls, setShowControls] = useState(true);

  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = async () => {
    loadedRef.current = false;
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    if (!["android", "ios"].includes(platform) || loadedRef.current) return;
    loadedRef.current = true;

    console.log("Loading rented video in NativeVideoPlayer:", {
      contentId,
      contentType,
      videoUrl: videoUrl.substring(0, 50) + "...",
      platform,
      isHls: isHls(videoUrl),
    });

    (async () => {
      const capgo = Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null;
      capgoModuleRef.current = capgo;

      if (capgo) {
        try {
          setCapgoAvailable(true);

          if (!videoUrl || !videoUrl.startsWith("http")) {
            throw new Error("Invalid video URL provided");
          }

          const startPos = (await getLastPosition()) || 0;
          const playerId = `rental-player-${contentId}-${contentType}`;
          capgoPlayerRef.current = playerId;

          await capgo.initPlayer({
            mode: "fullscreen",
            playerId,
            url: videoUrl,
            title,
            smallTitle:
              contentType === "episode" ? "Episode video" : "Movie video",
            artwork: poster || undefined,
            subtitle: subtitleUrl || undefined,
            language: subtitleUrl ? "en" : undefined,
            showControls: true,
            pipEnabled: true,
            bkmodeEnabled: true,
            displayMode: "all",
            accentColor: "#7c3aed",
            chromecast: true,
          } as any);

          if (startPos > 5) {
            await capgo.setCurrentTime({
              playerId,
              seektime: startPos,
            });
          }

          if (autoPlay) {
            await capgo.play({ playerId });
          }

          setNativeIsPlaying(true);

          if (startPos > 5) {
            toast({
              title: "Resumed",
              description: `Continuing from ${Math.round(startPos)}s`,
            });
          }

          return;
        } catch (capgoErr) {
          console.warn("Capgo player failed, falling back to web player", capgoErr);
        }
      }

      toast({
        title: "Native Player Unavailable",
        description: "Switching to the web player for this video.",
        variant: "destructive",
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAndroid,
    videoUrl,
    contentId,
    contentType,
    platform,
    toast,
    autoPlay,
    subtitleUrl,
    getLastPosition,
    retryKey,
  ]);

  // Poll Capgo player for state and expose simple control bindings
  useEffect(() => {
    const instance =
      capgoModuleRef.current ??
      (Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null);
    if (!capgoAvailable || !instance) return;

    const poll = window.setInterval(async () => {
      try {
        const playerId = capgoPlayerRef.current;
        if (!playerId) return;

        if (typeof instance.getCurrentTime === "function") {
          const pos = await instance.getCurrentTime({ playerId });
          const seconds = Number(pos?.value ?? pos?.currentTime ?? pos ?? 0);
          setNativeCurrentTime(Number.isFinite(seconds) ? seconds : 0);
        }
        if (typeof instance.getDuration === "function") {
          const dur = await instance.getDuration({ playerId });
          const seconds = Number(dur?.value ?? dur ?? 0);
          setNativeDuration(Number.isFinite(seconds) ? seconds : 0);
        }
        if (typeof instance.isPlaying === "function") {
          const p = await instance.isPlaying({ playerId });
          const playing = !!(p?.value ?? p?.isPlaying ?? p);
          setNativeIsPlaying(playing);
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 1000);

    capgoPollRef.current = poll;

    return () => {
      if (capgoPollRef.current) {
        clearInterval(capgoPollRef.current);
        capgoPollRef.current = null;
      }
    };
  }, [capgoAvailable]);

  const capgoPlay = async () => {
    try {
      const instance =
        capgoModuleRef.current ??
        (Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null);
      const playerId = capgoPlayerRef.current;
      if (instance && typeof instance.play === "function" && playerId) {
        await instance.play({ playerId });
        setNativeIsPlaying(true);
      }
    } catch (e) {
      // ignore
    }
  };

  const capgoPause = async () => {
    try {
      const instance =
        capgoModuleRef.current ??
        (Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null);
      const playerId = capgoPlayerRef.current;
      if (instance && typeof instance.pause === "function" && playerId) {
        await instance.pause({ playerId });
        setNativeIsPlaying(false);
      }
    } catch (e) {
      // ignore
    }
  };

  const capgoSeek = async (seconds: number) => {
    try {
      const instance =
        capgoModuleRef.current ??
        (Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null);
      const playerId = capgoPlayerRef.current;
      if (instance && typeof instance.setCurrentTime === "function" && playerId) {
        await instance.setCurrentTime({ playerId, seektime: seconds });
      }
      setNativeCurrentTime(seconds);
    } catch (e) {
      // ignore
    }
  };

  // Save position on unmount
  useEffect(() => {
    return () => {
      if (nativeCurrentTime > 0 && nativeDuration > 0) {
        saveProgress(nativeCurrentTime, nativeDuration);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeCurrentTime, nativeDuration, saveProgress]);

  // Cleanup Capgo player on unmount if used
  useEffect(() => {
    return () => {
      (async () => {
        try {
          const instance =
            capgoModuleRef.current ??
            (Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null);
          const playerId = capgoPlayerRef.current;

          if (instance && playerId) {
            if (typeof instance.exitPlayer === "function") {
              await instance.exitPlayer();
            }
            if (typeof instance.stopAllPlayers === "function") {
              await instance.stopAllPlayers();
            }
          }
          if (capgoPollRef.current) {
            clearInterval(capgoPollRef.current);
            capgoPollRef.current = null;
          }
        } catch (err) {
          // swallow cleanup errors
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Render: Native in-page overlay (Exo or Capgo) ----
  if (capgoAvailable && (platform === "android" || platform === "ios")) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center justify-between p-3 bg-background/80 backdrop-blur sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const instance =
                  capgoModuleRef.current ??
                  (Capacitor.isPluginAvailable("VideoPlayer") ? CapgoVideoPlayer : null);
                const playerId = capgoPlayerRef.current;
                if (instance && playerId) {
                  if (typeof instance.exitPlayer === "function") {
                    await instance.exitPlayer();
                  }
                  if (typeof instance.stopAllPlayers === "function") {
                    await instance.stopAllPlayers();
                  }
                }
              } finally {
                navigate(-1);
              }
            }}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <span className="text-sm font-medium truncate max-w-[60%] text-foreground">
            {title}
          </span>
          <span className="w-12" />
        </div>
        {/* Native player overlays on top of this transparent area */}
        <div
          ref={containerRef}
          className="relative w-full bg-black"
          style={{ aspectRatio: "16 / 9" }}
          onClick={() => setShowControls((s) => !s)}
        >
          <div className="absolute inset-0 flex items-center justify-center text-center p-4 text-white pointer-events-none">
            <div>
              <div className="mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary/80 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold">
                Playing in native player
              </h3>
              <p className="text-sm text-white/70 mt-2">
                Capgo handles playback with built-in controls enabled.
              </p>
            </div>
          </div>
          {/* Capgo controls when available */}
          {showControls && (
            <div className="flex items-center justify-center gap-3 p-4 bg-background absolute bottom-0 left-0 right-0 z-20">
              <Button
                size="icon"
                variant="secondary"
                onClick={() => (nativeIsPlaying ? capgoPause() : capgoPlay())}
              >
                {nativeIsPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <div className="text-xs text-muted-foreground tabular-nums">
                {formatTime(nativeCurrentTime)} / {formatTime(nativeDuration)}
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

  // ---- Fallback: native plugin not available or load error -> use web VideoPlayer ----
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
};

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default NativeVideoPlayer;
