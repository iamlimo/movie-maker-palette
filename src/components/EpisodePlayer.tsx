import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Lock, SkipForward, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import RentalButton from './RentalButton';

interface EpisodePlayerProps {
  episodeId: string;
  seasonId: string;
  title: string;
  price: number;
  posterUrl?: string;
  nextEpisodeId?: string;
  autoPlay?: boolean;
}

interface RentalAccess {
  has_access: boolean;
  access_type: 'rental' | 'purchase' | null;
  expires_at: string | null;
}

const EpisodePlayer = ({ 
  episodeId, 
  seasonId,
  title, 
  price,
  posterUrl,
  nextEpisodeId,
  autoPlay = false
}: EpisodePlayerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateWatchProgress, markAsCompleted } = useWatchHistory();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [hasAccess, setHasAccess] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showNextEpisode, setShowNextEpisode] = useState(false);

  useEffect(() => {
    if (user) {
      checkAccessAndLoadVideo();
    } else {
      setIsLoading(false);
    }
  }, [user, episodeId]);

  const checkAccessAndLoadVideo = async () => {
    try {
      setIsLoading(true);
      
      // Check both episode-level and season-level access
      const [episodeAccess, seasonAccess] = await Promise.all([
        checkRentalAccess(episodeId, 'episode'),
        checkRentalAccess(seasonId, 'season')
      ]);

      const hasEpisodeAccess = episodeAccess.has_access;
      const hasSeasonAccess = seasonAccess.has_access;
      
      if (hasEpisodeAccess || hasSeasonAccess) {
        setHasAccess(true);
        await loadVideoUrl();
      } else {
        setHasAccess(false);
      }
      
    } catch (error: any) {
      console.error('Access check error:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkRentalAccess = async (contentId: string, contentType: 'episode' | 'season'): Promise<RentalAccess> => {
    const { data, error } = await supabase.functions.invoke('rental-access', {
      body: { content_id: contentId, content_type: contentType }
    });
    
    if (error) throw error;
    return data;
  };

  const loadVideoUrl = async () => {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('video_url')
        .eq('id', episodeId)
        .single();

      if (error) throw error;
      setVideoUrl(data.video_url);
    } catch (error) {
      console.error('Error loading video URL:', error);
    }
  };

  const handlePlay = () => {
    if (!hasAccess) {
      toast({
        title: "Access Required",
        description: "Please rent this episode or season to watch it.",
        variant: "destructive"
      });
      return;
    }
    
    if (!videoUrl) {
      toast({
        title: "Video Unavailable",
        description: "Video file not found. Please contact support.",
        variant: "destructive"
      });
      return;
    }
    
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !user) return;
    
    const currentTime = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    
    if (duration > 0) {
      const progressPercent = (currentTime / duration) * 100;
      setProgress(progressPercent);
      
      // Update watch progress every 10 seconds
      if (Math.floor(currentTime) % 10 === 0) {
        updateWatchProgress('episode', episodeId, progressPercent, progressPercent >= 90);
      }

      // Show next episode button when 85% complete
      if (progressPercent >= 85 && nextEpisodeId && !showNextEpisode) {
        setShowNextEpisode(true);
      }
    }
  };

  const handleVideoEnd = () => {
    if (user) {
      markAsCompleted('episode', episodeId);
    }
    
    // Auto-play next episode if enabled
    if (autoPlay && nextEpisodeId) {
      toast({
        title: "Next Episode",
        description: "Playing next episode in 5 seconds...",
      });
      
      setTimeout(() => {
        // Navigate to next episode (this would be handled by parent component)
        window.location.href = `/episodes/${nextEpisodeId}`;
      }, 5000);
    }
  };

  const handleNextEpisode = () => {
    if (nextEpisodeId) {
      window.location.href = `/episodes/${nextEpisodeId}`;
    }
  };

  if (isLoading) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-4 p-8">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-muted-foreground">Please sign in to watch this episode</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-4 p-8">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Rent to Watch</h3>
          <p className="text-muted-foreground">This episode requires a rental to watch</p>
          <div className="space-y-2">
            <RentalButton
              contentId={episodeId}
              contentType="tv"
              price={price}
              title={`Episode: ${title}`}
            />
            <p className="text-xs text-muted-foreground">
              Or rent the entire season for better value
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isPlaying && videoUrl) {
    return (
      <div className="relative">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full h-full"
            poster={posterUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnd}
            onError={(e) => {
              console.error('Video playback error:', e);
              toast({
                title: "Playback Error",
                description: "Unable to play video. Please try again.",
                variant: "destructive"
              });
              setIsPlaying(false);
            }}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        
        {/* Next Episode Overlay */}
        {showNextEpisode && nextEpisodeId && (
          <div className="absolute bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg">
            <p className="text-sm mb-2">Next Episode Available</p>
            <Button 
              size="sm" 
              onClick={handleNextEpisode}
              className="flex items-center gap-2"
            >
              <SkipForward className="h-4 w-4" />
              Next Episode
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="aspect-video bg-muted rounded-lg flex items-center justify-center cursor-pointer group relative overflow-hidden"
      onClick={handlePlay}
      style={posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {posterUrl && <div className="absolute inset-0 bg-black/30" />}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="h-8 w-8 text-primary-foreground ml-1" />
        </div>
        <p className="text-sm text-white font-medium">Click to play</p>
        {progress > 0 && (
          <div className="w-32 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodePlayer;