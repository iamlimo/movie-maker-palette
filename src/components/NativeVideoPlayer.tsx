import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useExoPlayer } from '@/hooks/useExoPlayer';
import { Loader2, AlertCircle, ChevronLeft, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NativeVideoPlayerProps {
  contentId: string;
  contentType: 'movie' | 'episode';
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
    contentType === 'episode' ? 'episode' : 'movie'
  );
  const { markAsCompleted } = useWatchHistory();

  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSavedRef = useRef(0);
  const loadedRef = useRef(false);

  const [showControls, setShowControls] = useState(true);

  const exo = useExoPlayer({
    onProgress: (ct, dur) => {
      // Persist every ~10s to backend
      if (ct - lastSavedRef.current >= 10 && dur > 0) {
        lastSavedRef.current = ct;
        saveProgress(ct, dur);
      }
    },
    onEnded: async () => {
      try {
        await saveProgress(exo.duration || 0, exo.duration || 0);
        await markAsCompleted(contentType === 'episode' ? 'episode' : 'movie', contentId);
      } catch (e) {
        console.error('Completion tracking failed', e);
      }
      toast({ title: 'Playback complete', description: title });
    },
  });

  // ---- Android: position the native PlayerView over the React placeholder ----
  useEffect(() => {
    if (!isAndroid || !exo.isAvailable) return;

    const updateRect = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      exo.setRect({
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    };

    updateRect();
    const ro = new ResizeObserver(updateRect);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('orientationchange', updateRect);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('orientationchange', updateRect);
    };
  }, [isAndroid, exo.isAvailable, exo.setRect]);

  // ---- Android: load video once ready ----
  useEffect(() => {
    if (!isAndroid || !exo.isAvailable || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const startPos = await getLastPosition();
        const startMs = startPos > 5 ? Math.floor(startPos * 1000) : 0;
        await exo.loadVideo({
          url: videoUrl,
          type: isHls(videoUrl) ? 'hls' : 'progressive',
          startPositionMs: startMs,
          subtitleUrl: subtitleUrl || undefined,
          subtitleLanguage: subtitleUrl ? 'en' : undefined,
        });
        if (autoPlay) await exo.play();
        if (startMs > 0) {
          toast({ title: 'Resumed', description: `Continuing from ${Math.round(startPos)}s` });
        }
      } catch (e: any) {
        console.error('ExoPlayer load failed', e);
        toast({
          title: 'Playback error',
          description: e?.message || 'Failed to start video',
          variant: 'destructive',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroid, exo.isAvailable, videoUrl]);

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
    const showLoader = exo.state === 'loading' || exo.state === 'buffering' || exo.isBuffering;
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
          <span className="text-sm font-medium truncate max-w-[60%] text-foreground">{title}</span>
          <span className="w-12" />
        </div>

        {/* Native player overlays on top of this transparent area */}
        <div
          ref={containerRef}
          className="relative w-full bg-black"
          style={{ aspectRatio: '16 / 9' }}
          onClick={() => setShowControls((s) => !s)}
        >
          {showLoader && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
          {exo.state === 'error' && exo.error && (
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
              onClick={() => (exo.state === 'playing' ? exo.pause() : exo.play())}
            >
              {exo.state === 'playing' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatTime(exo.currentTime)} / {formatTime(exo.duration)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Fallback: native plugin not available (e.g. iOS without legacy plugin, or web debug) ----
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <AlertCircle className="h-12 w-12 text-destructive mb-3" />
      <h1 className="text-xl font-bold text-foreground mb-1">Native player unavailable</h1>
      <p className="text-muted-foreground text-center mb-4 max-w-md text-sm">
        The ExoPlayer plugin is not registered on this device. Falling back to the standard player.
      </p>
      <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
        <ChevronLeft className="h-4 w-4" /> Go Back
      </Button>
    </div>
  );
};

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default NativeVideoPlayer;
