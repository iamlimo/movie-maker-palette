import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VideoPlayer } from "./VideoPlayer";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useExoPlayer } from "@/hooks/useExoPlayer";
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  Play,
  Pause,
  RefreshCw,
  WifiOff,
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
  const { markAsCompleted } = useWatchHistory();

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

  const exo = useExoPlayer();

  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = async () => {
    try {
      await exo.release();
    } catch {}
    loadedRef.current = false;
    setRetryKey((k) => k + 1);
  };

  // Sync the native PlayerView rect to the placeholder div on Android.
  useEffect(() => {
    if (!isAndroid || !exo.isAvailable) return;
    const el = containerRef.current;
    if (!el) return;

    const sync = () => {
      const r = el.getBoundingClientRect();
      exo
        .setRect({ x: r.left, y: r.top, width: r.width, height: r.height })
        .catch(() => {});
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [isAndroid, exo.isAvailable, exo.setRect]);

  // ---- Android: position the native PlayerView over the React placeholder ----
  // Update rect logic preserved for compatibility - player.setRect not direct, assume exo.setRect available or adapt

  useEffect(() => {
    if (!isAndroid || !exo.isAvailable || loadedRef.current) return;
    loadedRef.current = true;

    console.log("Loading rented video in NativeVideoPlayer:", {
      contentId,
      contentType,
      videoUrl: videoUrl.substring(0, 50) + "...",
      platform,
      isHls: isHls(videoUrl),
      exoAvailable: exo.isAvailable,
    });

    (async () => {
      // Try Capgo / capacitor-video-player first (dynamic import)
      try {
        const mod = await import("@capgo/capacitor-video-player");
        capgoModuleRef.current = mod;
        const plugin =
          (mod as any).CapacitorVideoPlayer ??
          (mod as any).VideoPlayer ??
          (mod as any).default ??
          (mod as any);

        if (plugin) {
          // Mark available so UI can adapt if necessary
          setCapgoAvailable(true);

          // Validate URL
          if (!videoUrl || !videoUrl.startsWith("http")) {
            throw new Error("Invalid video URL provided");
          }

          const startPos = (await getLastPosition()) || 0;
          const startMs = startPos > 5 ? Math.floor(startPos * 1000) : 0;

          // Some capgo builds expect a create/init + play flow. We'll try both safe methods.
          try {
            // Prefer a create API if available
            if (typeof plugin.create === "function") {
              const createOpts = {
                mode: "fullscreen",
                url: videoUrl,
                title: title,
                subtitle: subtitleUrl || undefined,
                isHLS: isHls(videoUrl),
                startPosition: startMs,
              } as any;
              const res = await plugin.create(createOpts);
              capgoPlayerRef.current =
                res?.playerId ?? res?.id ?? "capgo-player";

              if (typeof plugin.play === "function") {
                await plugin.play({ playerId: capgoPlayerRef.current });
                setNativeIsPlaying(true);
              }
            } else if (typeof plugin.play === "function") {
              // Fallback: direct play call
              await plugin.play({
                url: videoUrl,
                isHLS: isHls(videoUrl),
                startPosition: startMs,
              });
              setNativeIsPlaying(true);
              capgoPlayerRef.current = "capgo-player";
            }

            if (startMs > 0) {
              toast({
                title: "Resumed",
                description: `Continuing from ${Math.round(startPos)}s`,
              });
            }

            // Capgo handled playback, don't initialize exo
            return;
          } catch (capgoErr) {
            console.warn(
              "Capgo player failed, falling back to ExoPlayer",
              capgoErr,
            );
            // proceed to exo fallback below
          }
        }
      } catch (importErr) {
        // module not available or errored — fall back to existing exo
        // console.debug('capgo plugin not available', importErr);
      }

      // Fallback: existing ExoPlayer flow
      try {
        // Validate URL before load
        if (!videoUrl || !videoUrl.startsWith("http")) {
          throw new Error("Invalid video URL provided");
        }

        const startPos = (await getLastPosition()) || 0;
        const startMs = startPos > 5 ? Math.floor(startPos * 1000) : 0;
        await exo.loadVideo({
          url: videoUrl,
          type: isHls(videoUrl) ? "hls" : "progressive",
          startPositionMs: startMs,
          subtitleUrl: subtitleUrl || undefined,
          subtitleLanguage: subtitleUrl ? "en" : undefined,
        } as any);
        // Delay play to correct thread
        setTimeout(async () => {
          if (autoPlay) await exo.play();
        }, 100);
        if (startMs > 0) {
          toast({
            title: "Resumed",
            description: `Continuing from ${Math.round(startPos)}s`,
          });
        }
      } catch (e: any) {
        console.error("ExoPlayer load failed for rented content", {
          contentId,
          contentType,
          videoUrl: videoUrl?.substring(0, 50) + "...",
          error: e,
        });
        toast({
          title: "Native Player Error - Using Web Fallback",
          description: e?.message || "Switching to web player for this video",
          variant: "destructive",
        });
        // Don't navigate back, let fallback render
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAndroid,
    exo.isAvailable,
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
    if (!capgoAvailable || !capgoModuleRef.current) return;
    const instance = capgoModuleRef.current as any;

    const poll = window.setInterval(async () => {
      try {
        if (!instance) return;
        if (typeof instance.getCurrentPosition === "function") {
          const pos = await instance.getCurrentPosition({
            playerId: capgoPlayerRef.current,
          });
          const millis = Number(pos?.position ?? pos ?? 0);
          setNativeCurrentTime(millis / 1000);
        }
        if (typeof instance.getDuration === "function") {
          const dur = await instance.getDuration({
            playerId: capgoPlayerRef.current,
          });
          const millis = Number(dur?.duration ?? dur ?? 0);
          setNativeDuration(millis / 1000);
        }
        if (typeof instance.isPlaying === "function") {
          const p = await instance.isPlaying({
            playerId: capgoPlayerRef.current,
          });
          setNativeIsPlaying(!!(p?.isPlaying ?? p));
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
      const plugin = capgoModuleRef.current as any;
      const instance =
        plugin?.CapacitorVideoPlayer ??
        plugin?.VideoPlayer ??
        plugin?.default ??
        plugin;
      if (instance && typeof instance.play === "function") {
        await instance.play({ playerId: capgoPlayerRef.current });
        setNativeIsPlaying(true);
      }
    } catch (e) {
      // ignore
    }
  };

  const capgoPause = async () => {
    try {
      const plugin = capgoModuleRef.current as any;
      const instance =
        plugin?.CapacitorVideoPlayer ??
        plugin?.VideoPlayer ??
        plugin?.default ??
        plugin;
      if (instance && typeof instance.pause === "function") {
        await instance.pause({ playerId: capgoPlayerRef.current });
        setNativeIsPlaying(false);
      }
    } catch (e) {
      // ignore
    }
  };

  const capgoSeek = async (seconds: number) => {
    try {
      const plugin = capgoModuleRef.current as any;
      const instance =
        plugin?.CapacitorVideoPlayer ??
        plugin?.VideoPlayer ??
        plugin?.default ??
        plugin;
      if (instance && typeof instance.seek === "function") {
        await instance.seek({
          playerId: capgoPlayerRef.current,
          position: Math.floor(seconds * 1000),
        });
      }
      setNativeCurrentTime(seconds);
    } catch (e) {
      // ignore
    }
  };

  // Save position on unmount
  useEffect(() => {
    return () => {
      if (exo.currentTime > 0 && exo.duration > 0) {
        saveProgress(exo.currentTime, exo.duration);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup Capgo player on unmount if used
  useEffect(() => {
    return () => {
      (async () => {
        try {
          const plugin = capgoModuleRef.current ?? null;
          const playerId = capgoPlayerRef.current;
          if (plugin && playerId) {
            const instance =
              (plugin as any).CapacitorVideoPlayer ??
              (plugin as any).VideoPlayer ??
              (plugin as any).default ??
              plugin;
            if (instance) {
              if (typeof instance.stop === "function") {
                await instance.stop({ playerId });
              }
              if (typeof instance.destroy === "function") {
                await instance.destroy({ playerId });
              }
              if (typeof instance.close === "function") {
                await instance.close({ playerId });
              }
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
  if (
    (isAndroid && exo.isAvailable) ||
    (capgoAvailable && (platform === "android" || platform === "ios"))
  ) {
    const usingExo = isAndroid && exo.isAvailable;
    const showLoader = usingExo
      ? exo.state === "loading" || exo.state === "buffering" || exo.isBuffering
      : false;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center justify-between p-3 bg-background/80 backdrop-blur sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                if (usingExo) {
                  await exo.pause();
                  if (exo.currentTime > 0 && exo.duration > 0) {
                    await saveProgress(exo.currentTime, exo.duration);
                  }
                  await exo.release();
                } else {
                  // Try to stop/destroy capgo player if present
                  const plugin = capgoModuleRef.current ?? null;
                  const playerId = capgoPlayerRef.current;
                  const instance = plugin
                    ? plugin.CapacitorVideoPlayer ??
                      plugin.VideoPlayer ??
                      plugin.default ??
                      plugin
                    : null;
                  if (instance) {
                    if (typeof instance.stop === "function") {
                      await instance.stop({ playerId });
                    }
                    if (typeof instance.destroy === "function") {
                      await instance.destroy({ playerId });
                    }
                    if (typeof instance.close === "function") {
                      await instance.close({ playerId });
                    }
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
          {showLoader && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}

          {/* Exo-specific error UI */}
          {usingExo && exo.state === "error" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-black/80 via-black/90 to-black backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full bg-destructive/30 blur-2xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-destructive/15 border border-destructive/40 flex items-center justify-center">
                  {/offline|network|connection/i.test(exo.error || "") ? (
                    <WifiOff className="h-8 w-8 text-destructive" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  )}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Playback failed
              </h3>
              <p className="text-sm text-white/70 max-w-sm mb-5 leading-relaxed">
                {exo.error ||
                  "We couldn't start this video. Check your connection and try again."}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleRetry}
                  className="gap-2 shadow-glow"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="gap-1 border-white/30 text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Capgo: if plugin used and exo not available show minimal placeholder */}
          {!usingExo && capgoAvailable && (
            <div className="absolute inset-0 flex items-center justify-center text-center p-4 text-white">
              <div>
                <div className="mb-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary/80 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold">
                  Playing in native player
                </h3>
                <p className="text-sm text-white/70 mt-2">
                  The native player handles playback. Use device controls to
                  manage playback.
                </p>
              </div>
            </div>
          )}
          {/* Capgo controls when available */}
          {showControls && !usingExo && capgoAvailable && (
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

        {showControls && usingExo && (
          <div className="flex items-center justify-center gap-3 p-4 bg-background">
            <Button
              size="icon"
              variant="secondary"
              onClick={() =>
                exo.state === "playing" ? exo.pause() : exo.play()
              }
            >
              {exo.state === "playing" ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatTime(exo.currentTime)} / {formatTime(exo.duration)}
            </div>
          </div>
        )}
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
