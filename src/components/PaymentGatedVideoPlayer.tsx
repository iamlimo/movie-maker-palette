import React, { useState, useEffect } from 'react';
import { Play, Lock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PaymentGatedVideoPlayerProps {
  episodeId: string;
  episodeTitle: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  showTitle?: string;
  price?: number;
}

export const PaymentGatedVideoPlayer: React.FC<PaymentGatedVideoPlayerProps> = ({
  episodeId,
  episodeTitle,
  thumbnailUrl,
  trailerUrl,
  showTitle,
  price = 0
}) => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, [episodeId, user]);

  const checkAccess = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-episode-access', {
        body: { 
          episode_id: episodeId,
          user_id: user?.id || null
        }
      });

      if (error) {
        console.error('Error checking access:', error);
        return;
      }

      setHasAccess(data.hasAccess);
      setVideoUrl(data.episode?.video_url || null);
    } catch (error) {
      console.error('Access check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayEpisode = () => {
    if (hasAccess && videoUrl) {
      setIsPlaying(true);
    } else {
      toast.error('Payment required to watch this episode');
    }
  };

  const handlePlayTrailer = () => {
    if (trailerUrl) {
      setIsPlayingTrailer(true);
    } else {
      toast.error('No trailer available');
    }
  };

  const handlePurchaseAccess = () => {
    // This would integrate with your payment system
    toast.info('Payment integration coming soon');
  };

  if (loading) {
    return (
      <Card className="w-full aspect-video bg-muted animate-pulse">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  // Full episode player (for paid users)
  if (isPlaying && hasAccess && videoUrl) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video
          src={videoUrl}
          controls
          className="w-full h-full"
          autoPlay
          onError={() => toast.error('Failed to load video')}
        >
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  // Trailer player
  if (isPlayingTrailer && trailerUrl) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video
          src={trailerUrl}
          controls
          className="w-full h-full"
          autoPlay
          onError={() => toast.error('Failed to load trailer')}
        >
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  // Preview/locked state
  return (
    <Card className="w-full aspect-video relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)'
        }}
      >
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="text-center space-y-4 text-white">
            <div className="space-y-2">
              {showTitle && (
                <Badge variant="secondary" className="mb-2">
                  {showTitle}
                </Badge>
              )}
              <h3 className="text-2xl font-bold">{episodeTitle}</h3>
              {price > 0 && (
                <p className="text-lg">₦{price.toLocaleString()}</p>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              {hasAccess ? (
                <Button 
                  onClick={handlePlayEpisode}
                  size="lg"
                  className="gap-2"
                >
                  <Play className="h-5 w-5" />
                  Watch Episode
                </Button>
              ) : (
                <>
                  {trailerUrl && (
                    <Button 
                      onClick={handlePlayTrailer}
                      variant="outline"
                      size="lg"
                      className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <Play className="h-5 w-5" />
                      Watch Trailer
                    </Button>
                  )}
                  <Button 
                    onClick={handlePurchaseAccess}
                    size="lg"
                    className="gap-2"
                  >
                    <CreditCard className="h-5 w-5" />
                    Get Access
                  </Button>
                </>
              )}
            </div>

            {!hasAccess && (
              <div className="flex items-center justify-center gap-2 text-yellow-300">
                <Lock className="h-4 w-4" />
                <span className="text-sm">Premium content - Purchase required</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};