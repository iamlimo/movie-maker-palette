import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import RentalButton from './RentalButton';

interface VideoPlayerWithValidationProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  title: string;
  price?: number;
  posterUrl?: string;
}

const VideoPlayerWithValidation = ({ 
  contentId, 
  contentType, 
  title, 
  price = 0,
  posterUrl 
}: VideoPlayerWithValidationProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasAccess, setHasAccess] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (user) {
      checkRentalAccess();
    } else {
      setIsLoading(false);
    }
  }, [user, contentId, contentType]);

  const checkRentalAccess = async () => {
    try {
      setIsLoading(true);
      
      // Call unified rental manager to validate access
      const { data, error } = await supabase.functions.invoke('unified-rental-manager', {
        body: {
          contentId,
          contentType,
          action: 'validate'
        }
      });
      
      if (error) {
        console.error('Rental validation error:', error);
        setHasAccess(false);
        return;
      }

      setHasAccess(data.hasAccess);
      if (data.hasAccess && data.videoUrl) {
        setVideoUrl(data.videoUrl);
      }
      
    } catch (error: any) {
      console.error('Access check error:', error);
      setHasAccess(false);
      
      // Fallback for free tier issues
      if (error.message?.includes('timeout')) {
        toast({
          title: "Checking Access...",
          description: "Please wait while we verify your rental status.",
        });
        
        // Retry after delay
        setTimeout(() => checkRentalAccess(), 3000);
      }
      
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = () => {
    if (!hasAccess) {
      toast({
        title: "Access Required",
        description: "Please rent this content to watch it.",
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
          <p className="text-muted-foreground">Please sign in to watch this content</p>
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
          <p className="text-muted-foreground">This {contentType} requires a rental to watch</p>
          <RentalButton
            contentId={contentId}
            contentType={contentType === 'episode' ? 'tv' : 'movie'}
            price={price}
            title={title}
          />
        </div>
      </div>
    );
  }

  if (isPlaying && videoUrl) {
    return (
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        <video
          controls
          autoPlay
          className="w-full h-full"
          poster={posterUrl}
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
      </div>
    </div>
  );
};

export default VideoPlayerWithValidation;