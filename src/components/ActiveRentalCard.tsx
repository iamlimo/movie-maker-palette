import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Rental {
  id: string;
  content_id: string;
  content_type: string;
  expires_at: string;
  amount: number;
  created_at: string;
}

interface ActiveRentalCardProps {
  rental: Rental;
  formatTimeRemaining: (date: string) => string;
}

const ActiveRentalCard: React.FC<ActiveRentalCardProps> = ({ rental, formatTimeRemaining }) => {
  const navigate = useNavigate();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number } | null>(null);
  const [expiryPercentage, setExpiryPercentage] = useState(100);

  // Calculate time remaining and expiry percentage
  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const expiry = new Date(rental.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0 });
        setExpiryPercentage(0);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Calculate percentage (assuming 48-hour rental default)
      const totalHours = 48;
      const percentage = Math.max(0, (hours / totalHours) * 100);

      setTimeLeft({ hours, minutes });
      setExpiryPercentage(percentage);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [rental.expires_at]);

  // Fetch content details
  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        let query;

        if (rental.content_type === 'movie') {
          query = supabase
            .from('movies')
            .select('id, title, thumbnail_url, duration, release_date, price')
            .eq('id', rental.content_id)
            .single();
        } else if (rental.content_type === 'tv_show') {
          query = supabase
            .from('tv_shows')
            .select('id, title, thumbnail_url, total_seasons')
            .eq('id', rental.content_id)
            .single();
        } else if (rental.content_type === 'season') {
          query = supabase
            .from('seasons')
            .select('id, season_number, description, tv_shows(title, thumbnail_url)')
            .eq('id', rental.content_id)
            .single();
        } else if (rental.content_type === 'episode') {
          query = supabase
            .from('episodes')
            .select('id, title, episode_number, season_id, seasons(tv_shows(title, thumbnail_url))')
            .eq('id', rental.content_id)
            .single();
        }

        if (query) {
          const { data, error } = await query;
          if (error) throw error;
          setContent(data);
        }
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [rental.content_id, rental.content_type]);

  // Determine expiry status
  const hoursLeft = timeLeft?.hours || 0;
  const isExpiringSoon = hoursLeft < 24;
  const isCritical = hoursLeft < 1;

  // Get title based on content type
  const getTitle = () => {
    if (rental.content_type === 'movie' || rental.content_type === 'tv_show') {
      return content?.title || 'Loading...';
    } else if (rental.content_type === 'season') {
      return `${content?.tv_shows?.title || 'Show'} - ${content?.title || 'Season'}`;
    } else if (rental.content_type === 'episode') {
      return `${content?.seasons?.tv_shows?.title || 'Show'} - Ep ${content?.episode_number}`;
    }
    return 'Content';
  };

  // Get thumbnail
  const getThumbnail = () => {
    if (rental.content_type === 'episode') {
      return content?.seasons?.tv_shows?.thumbnail_url;
    } else if (rental.content_type === 'season') {
      return content?.tv_shows?.thumbnail_url;
    }
    return content?.thumbnail_url;
  };

  const thumbnail = getThumbnail();

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group',
        isCritical ? 'border-red-500/50 bg-red-500/5' :
        isExpiringSoon ? 'border-yellow-500/50 bg-yellow-500/5' : ''
      )}
    >
      {/* Thumbnail Section */}
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={getTitle()}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play size={40} className="text-muted-foreground" />
          </div>
        )}

        {/* Content Type Badge */}
        <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs">
          {rental.content_type === 'movie' ? 'Movie' : 
           rental.content_type === 'tv_show' ? 'TV Show' : 
           rental.content_type === 'season' ? 'Season' : 
           'Episode'}
        </Badge>

        {/* Expiry Alert Badge */}
        {isCritical && (
          <Badge className="absolute top-2 right-2 bg-red-500/90 text-white text-xs flex items-center gap-1">
            <AlertTriangle size={12} />
            Expiring Soon
          </Badge>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Button
            size="lg"
            onClick={() => navigate(`/watch/${rental.content_type}/${rental.content_id}`)}
            className="rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30"
          >
            <Play size={24} className="mr-2 fill-current" />
            Watch
          </Button>
        </div>

        {/* Expiry Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <Progress
            value={expiryPercentage}
            className={cn(
              'h-2',
              isCritical ? 'bg-red-500/30' :
              isExpiringSoon ? 'bg-yellow-500/30' : 'bg-white/20'
            )}
          />
        </div>
      </div>

      {/* Content Info Section */}
      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-foreground">
          {getTitle()}
        </h3>

        {/* Expiry Status */}
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className={cn(
            isCritical ? 'text-red-600' :
            isExpiringSoon ? 'text-yellow-600' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'text-xs font-medium',
            isCritical ? 'text-red-600' :
            isExpiringSoon ? 'text-yellow-600' : 'text-muted-foreground'
          )}>
            {timeLeft && (
              <>
                {timeLeft.hours > 0 ? `${timeLeft.hours}h ${timeLeft.minutes}m left` : `${timeLeft.minutes}m left`}
              </>
            )}
          </span>
        </div>

        {/* Additional Info */}
        {rental.content_type === 'movie' && content?.duration && (
          <div className="text-xs text-muted-foreground mb-3">
            Duration: <span className="font-medium">{content.duration} min</span>
          </div>
        )}

        {rental.content_type === 'tv_show' && content?.total_seasons && (
          <div className="text-xs text-muted-foreground mb-3">
            Seasons: <span className="font-medium">{content.total_seasons}</span>
          </div>
        )}

        {rental.content_type === 'season' && content?.episode_count && (
          <div className="text-xs text-muted-foreground mb-3">
            Episodes: <span className="font-medium">{content.episode_count}</span>
          </div>
        )}

        {/* Price Paid */}
        {rental.amount && (
          <div className="text-xs text-muted-foreground mb-3">
            Paid: <span className="font-medium">₦{(rental.amount / 100).toLocaleString('en-NG')}</span>
          </div>
        )}

        {/* Watch Button */}
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => navigate(`/watch/${rental.content_type}/${rental.content_id}`)}
        >
          <Play size={16} />
          Watch Now
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActiveRentalCard;
