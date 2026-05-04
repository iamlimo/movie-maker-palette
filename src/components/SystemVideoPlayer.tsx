import { useEffect, useCallback, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { Loader2, ChevronLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SystemVideoPlayerProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  videoUrl: string;
  title: string;
  poster?: string;
  subtitleUrl?: string;
  autoPlay?: boolean;
}

const SystemVideoPlayer: React.FC<SystemVideoPlayerProps> = ({
  contentId,
  contentType,
  videoUrl,
  title,
  poster,
}) => {
  const [openingPlayer, setOpeningPlayer] = useState(false);
  const { toast } = useToast();
  const { saveProgress } = useVideoProgress(contentId, contentType === 'episode' ? 'episode' : 'movie');
  const { markAsCompleted } = useWatchHistory();
  const platform = Capacitor.getPlatform();

  const openSystemPlayer = useCallback(async () => {
    if (!videoUrl) {
      toast({
        title: 'No video URL',
        description: 'Contact support',
        variant: 'destructive',
      });
      return;
    }

    try {
      setOpeningPlayer(true);
      console.log('Opening OS default player:', { contentId, platform, videoUrl: videoUrl.substring(0, 50) });

      // Save current progress (0) before opening
      await saveProgress(0, 0);

      await Browser.open({ url: videoUrl });
    } catch (error) {
      console.error('Failed to open system player:', error);
      toast({
        title: 'Failed to open player',
        description: 'Using web fallback',
        variant: 'destructive',
      });
    } finally {
      setOpeningPlayer(false);
    }
  }, [videoUrl, contentId, platform, toast, saveProgress]);

  useEffect(() => {
    // Auto-open on mount for native
    if (Capacitor.isNativePlatform()) {
      const timer = setTimeout(openSystemPlayer, 1000);
      return () => clearTimeout(timer);
    }
  }, [openSystemPlayer]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <img 
        src={poster} 
        alt={title}
        className="w-64 h-96 object-cover rounded-2xl shadow-2xl mb-8"
        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
      />
      <h1 className="text-3xl font-bold text-white mb-4 text-center max-w-md">{title}</h1>
      <p className="text-white/70 text-lg mb-8 text-center max-w-md">
        Tapping will open in your device's native video player ({platform}).
      </p>
      <Button 
        onClick={openSystemPlayer}
        size="lg"
        className="gap-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xl px-12 py-8 rounded-2xl shadow-2xl"
        disabled={openingPlayer}
      >
        {openingPlayer ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            Opening...
          </>
        ) : (
          <>
            <Play className="h-6 w-6 ml-1" />
            Open Native Player
          </>
        )}
      </Button>
      <Button 
        variant="outline" 
        onClick={() => window.history.back()}
        className="mt-6 gap-2 border-white/30 text-white hover:bg-white/10"
        size="lg"
      >
        <ChevronLeft className="h-5 w-5" />
        Back
      </Button>
    </div>
  );
};

export default SystemVideoPlayer;

