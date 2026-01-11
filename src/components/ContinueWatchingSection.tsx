import { useNavigate } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useWatchHistory, WatchHistoryItem } from '@/hooks/useWatchHistory';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  onPlay: () => void;
  onRemove: () => void;
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  item,
  onPlay,
  onRemove,
}) => {
  const formatTimeRemaining = (duration: number, progress: number) => {
    if (!duration) return '';
    const watchedMinutes = (duration * progress) / 100;
    const remainingMinutes = Math.round(duration - watchedMinutes);
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      const mins = remainingMinutes % 60;
      return `${hours}h ${mins}m remaining`;
    }
    return `${remainingMinutes}m remaining`;
  };

  return (
    <div className="group relative flex-shrink-0 w-[280px] sm:w-[320px] md:w-[340px] snap-start">
      <div className="relative overflow-hidden rounded-lg bg-card transition-all duration-300 group-hover:ring-2 group-hover:ring-primary/50 group-hover:shadow-xl">
        {/* Thumbnail with gradient overlay */}
        <div className="relative aspect-video">
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Play size={32} className="text-muted-foreground" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Play button overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Button
              size="lg"
              onClick={onPlay}
              className="rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-transform shadow-2xl"
            >
              <Play size={24} className="fill-current" />
            </Button>
          </div>

          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            aria-label="Remove from Continue Watching"
          >
            <X size={14} />
          </button>

          {/* Content info at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
            <h3 className="font-semibold text-white text-sm line-clamp-1">
              {item.title || 'Unknown Title'}
            </h3>
            
            {/* Progress bar */}
            <div className="space-y-1">
              <Progress 
                value={item.progress} 
                className="h-1 bg-white/20"
              />
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>{Math.round(item.progress)}% watched</span>
                {item.duration && (
                  <span>{formatTimeRemaining(item.duration, item.progress)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContinueWatchingSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { continueWatching, loading, removeFromHistory } = useWatchHistory();

  // Don't render if user is not logged in or no content to show
  if (!user || loading || continueWatching.length === 0) {
    return null;
  }

  const handlePlay = (item: WatchHistoryItem) => {
    if (item.content_type === 'movie') {
      navigate(`/movie/${item.content_id}`);
    } else {
      navigate(`/episode/${item.content_id}`);
    }
  };

  const handleRemove = async (item: WatchHistoryItem) => {
    await removeFromHistory(item.id);
  };

  return (
    <section className="py-6 md:py-8">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Continue Watching
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pick up where you left off
            </p>
          </div>
        </div>

        {/* Horizontal scroll container */}
        <div 
          className={cn(
            "flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4",
            "scrollbar-hide snap-x snap-mandatory scroll-smooth",
            "md:scrollbar-default"
          )}
        >
          {continueWatching.map((item) => (
            <ContinueWatchingCard
              key={item.id}
              item={item}
              onPlay={() => handlePlay(item)}
              onRemove={() => handleRemove(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContinueWatchingSection;
