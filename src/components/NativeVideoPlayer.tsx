import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NativeVideoPlayerProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  videoUrl: string;
  title: string;
  poster?: string;
  subtitleUrl?: string;
  autoPlay?: boolean;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const playerInitialized = useRef(false);
  const { saveProgress, getLastPosition } = useVideoProgress(contentId, 'movie');
  const { markAsCompleted } = useWatchHistory();

  // Resume playback position
  useEffect(() => {
    const resumePlayback = async () => {
      try {
        const lastPosition = await getLastPosition();
        if (lastPosition > 5) {
          toast({
            title: 'Resuming',
            description: `Continuing from ${Math.round(lastPosition)}s`,
          });
        }
      } catch (err) {
        console.error('Error getting last position:', err);
      }
    };

    resumePlayback();
  }, [contentId, getLastPosition, toast]);

  // Initialize native video player
  useEffect(() => {
    if (playerInitialized.current) return;
    playerInitialized.current = true;

    const initializePlayer = async () => {
      try {
        setLoading(true);
        setError(null);

        // Only run on native platforms
        if (!Capacitor.isNativePlatform()) {
          setError('This is a native-only player');
          return;
        }

        // Determine platform-specific implementation
        const platform = Capacitor.getPlatform();

        if (platform === 'ios') {
          await initializeIOSPlayer();
        } else if (platform === 'android') {
          await initializeAndroidPlayer();
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Player initialization failed:', err);
        setError(err.message || 'Failed to initialize player');
        setLoading(false);
      }
    };

    initializePlayer();
  }, [videoUrl, title]);

  const initializeIOSPlayer = async () => {
    try {
      // On iOS, we use AVPlayer via Capacitor's native bridge
      // Try to use @capacitor-community/video-player if available
      let VideoPlayer;

      try {
        // @ts-ignore - Plugin may not be installed
        // Use computed string to prevent Vite from trying to resolve at build time
        const pluginName = '@capacitor-community' + '/' + 'video-player';
        const module = await import(pluginName);
        VideoPlayer = module.VideoPlayer;
      } catch {
        console.warn('Video Player plugin not found, falling back to web player');
        throw new Error('Capacitor Video Player plugin not available on iOS');
      }

      if (VideoPlayer) {
        // Play full-screen video with Capacitor Video Player
        await VideoPlayer.play({
          url: videoUrl,
          playerId: 'video-player-ios',
          width: undefined,
          height: undefined,
          showControls: true,
          showBackButton: true,
          videoWidth: 1920,
          videoHeight: 1080,
          title: title,
          smallPlaybackRate: true,
          rate: 1.0,
          // Custom attributes for security
          controlsList: 'nodownload',
          disablePictureInPicture: true,
        });

        // Track playback events
        VideoPlayer.addListener('playing', () => {
          // Save progress on play
          toast({
            title: 'Playing',
            description: title,
          });
        });

        VideoPlayer.addListener('ended', async () => {
          await saveProgress(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
          await markAsCompleted('movie', contentId);
          toast({
            title: 'Video Complete',
            description: 'Thank you for watching!',
          });
        });

        VideoPlayer.addListener('stopped', () => {
          // User exited
          navigate(-1);
        });
      }
    } catch (err: any) {
      console.error('iOS player error:', err);
      throw err;
    }
  };

  const initializeAndroidPlayer = async () => {
    try {
      // On Android, use similar approach with Capacitor Video Player
      let VideoPlayer;

      try {
        // @ts-ignore - Plugin may not be installed
        // Use computed string to prevent Vite from trying to resolve at build time
        const pluginName = '@capacitor-community' + '/' + 'video-player';
        const module = await import(pluginName);
        VideoPlayer = module.VideoPlayer;
      } catch {
        console.warn('Video Player plugin not found for Android');
        throw new Error('Capacitor Video Player plugin not available on Android');
      }

      if (VideoPlayer) {
        // Play full-screen video with Capacitor Video Player
        await VideoPlayer.play({
          url: videoUrl,
          playerId: 'video-player-android',
          width: undefined,
          height: undefined,
          showControls: true,
          showBackButton: true,
          videoWidth: 1920,
          videoHeight: 1080,
          title: title,
          smallPlaybackRate: false,
          rate: 1.0,
          controlsList: 'nodownload',
          disablePictureInPicture: true,
        });

        // Track playback events
        VideoPlayer.addListener('playing', () => {
          toast({
            title: 'Playing',
            description: title,
          });
        });

        VideoPlayer.addListener('ended', async () => {
          await saveProgress(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
          await markAsCompleted('movie', contentId);
          toast({
            title: 'Complete',
            description: 'Video finished!',
          });
        });

        VideoPlayer.addListener('closed', () => {
          navigate(-1);
        });
      }
    } catch (err: any) {
      console.error('Android player error:', err);
      throw err;
    }
  };

  // Fallback UI for web/error states
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Player Error</h1>
        <p className="text-white/70 text-center mb-6 max-w-md">{error}</p>
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-white text-lg">Initializing player...</p>
          <p className="text-white/50 text-sm mt-2">{title}</p>
        </div>
      </div>
    );
  }

  // The actual video player is handled by Capacitor native code
  // This component is essentially a bridge
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-white">Loading video player...</p>
      </div>
    </div>
  );
};

export default NativeVideoPlayer;
