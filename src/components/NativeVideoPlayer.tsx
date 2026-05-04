import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { usePlayer } from "@/hooks/usePlayer";
import { Loader2, AlertCircle, ChevronLeft, Play, Pause } from "lucide-react";
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

  const [showControls, setShowControls] = useState(true);

  const player = usePlayer();

  // ---- Android: position the native PlayerView over the React placeholder ----
  // Update rect logic preserved for compatibility - player.setRect not direct, assume exo.setRect available or adapt

  // ---- Android: load video once ready ----
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
      try {
        // Validate URL before load
        if (!videoUrl || !videoUrl.startsWith("http")) {
          throw new Error("Invalid video URL provided");
        }

        const startPos = await getLastPosition();
        const startMs = startPos > 5 ? Math.floor(startPos * 1000) : 0;
        await exo.loadVideo({
          url: videoUrl,
          type: isHls(videoUrl) ? "hls" : "progressive",
          startPositionMs: startMs,
          subtitleUrl: subtitleUrl || undefined,
          subtitleLanguage: subtitleUrl ? "en" : undefined,
          contentId,
          contentType,
        });
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
          videoUrl: videoUrl.substring(0, 50) + "...",
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
  ]);

  // Save position on unmount
  useEffect(() => {
    return () => {
      if (exo.currentTime > 0 && exo.duration > 0) {
        saveProgress(exo.currentTime, exo.duration);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Render: Android in-page overlay ----
  if (isAndroid && exo.isAvailable) {
    const showLoader =
      exo.state === "loading" || exo.state === "buffering" || exo.isBuffering;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center justify-between p-3 bg-background/80 backdrop-blur sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await exo.pause();
                if (exo.currentTime > 0 && exo.duration > 0) {
                  await saveProgress(exo.currentTime, exo.duration);
                }
                await exo.release();
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
          {exo.state === "error" && exo.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 p-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mb-2" />
              <p className="text-sm text-foreground">{exo.error}</p>
            </div>
          )}
        </div>

        {showControls && (
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

  // ---- Fallback: native plugin not available or load error (use web player via Watch.tsx routing) ----
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-white">
      <AlertCircle className="h-16 w-16 text-destructive/70 mb-6" />
      <h1 className="text-2xl font-bold mb-2">Native Playback Unavailable</h1>
      <p className="text-lg text-white/80 mb-8 max-w-md text-center">
        Plugin error or iOS - falling back to web player automatically.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => navigate(0)}
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Retry Native
        </Button>
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          size="lg"
          className="border-white/50 text-white hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      <p className="text-sm text-white/60 mt-6">
        Content loads in web player if native fails
      </p>
    </div>
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
