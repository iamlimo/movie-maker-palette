import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useWatchHistory, WatchHistoryItem } from "@/hooks/useWatchHistory";
import { useAuth } from "@/contexts/AuthContext";

import { cn } from "@/lib/utils";

import { formatNaira } from "@/lib/priceUtils";

interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  onAction: () => void;
  onRemove: () => void;
  canRemove: boolean;
  isExpired: boolean;
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  item,
  onAction,
  onRemove,
  canRemove,
  isExpired,
}) => {
  const formatTimeRemaining = (item: WatchHistoryItem) => {
    if (
      item.playback_position !== undefined &&
      item.video_duration &&
      item.video_duration > 0
    ) {
      const remainingSeconds = Math.max(
        item.video_duration - item.playback_position,
        0,
      );
      const remainingMinutes = Math.round(remainingSeconds / 60);
      if (remainingMinutes >= 60) {
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;
        return `${hours}h ${mins}m remaining`;
      }
      return `${remainingMinutes}m remaining`;
    }

    if (!item.duration) return "";
    const watchedMinutes = (item.duration * item.progress) / 100;
    const remainingMinutes = Math.max(
      Math.round(item.duration - watchedMinutes),
      0,
    );
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      const mins = remainingMinutes % 60;
      return `${hours}h ${mins}m remaining`;
    }
    return `${remainingMinutes}m remaining`;
  };

  const progressValue = Math.min(100, Math.max(0, item.progress));
  const priceLabel =
    item.price !== undefined && item.price !== null
      ? formatNaira(item.price)
      : null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPlay();
    }
  };

  return (
    <div
      className="group relative flex-shrink-0 w-[280px] sm:w-[320px] md:w-[340px] snap-start cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      role="button"
      tabIndex={0}
      onClick={onAction}
      onKeyDown={handleKeyDown}
    >
      <div className="relative overflow-hidden rounded-lg bg-card transition-all duration-300 group-hover:ring-2 group-hover:ring-primary/50 group-hover:shadow-xl">
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

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Button
              size="lg"
              onClick={(event) => {
                event.stopPropagation();
                onAction();
              }}
              className="rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-transform shadow-2xl"
            >
              <Play size={24} className="fill-current" />
            </Button>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              if (canRemove) {
                onRemove();
              }
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-full text-white transition-opacity ${
              canRemove
                ? "bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-black/80"
                : "bg-black/35 opacity-100 cursor-not-allowed"
            }`}
            aria-label={
              canRemove
                ? "Remove from Continue Watching"
                : "Active rental cannot be removed"
            }
            disabled={!canRemove}
            title={
              canRemove
                ? "Remove from Continue Watching"
                : "Active rental cannot be removed"
            }
          >
            <X size={14} />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
            <h3 className="font-semibold text-white text-sm line-clamp-1">
              {item.title || "Unknown Title"}
            </h3>

            <div className="space-y-1">
              <Progress value={progressValue} className="h-1 bg-white/20" />
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>{Math.round(progressValue)}% watched</span>
                <span>{formatTimeRemaining(item)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 bg-card p-3">
          {priceLabel && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Rental price</span>
              <span className="font-semibold text-foreground">
                {priceLabel}
              </span>
            </div>
          )}

          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Play size={16} className="mr-2 fill-current" />
            Continue Watching
          </Button>
        </div>
      </div>
    </div>
  );
};

const ContinueWatchingSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    continueWatching,
    loading,
    removeFromHistory,
    canRemoveFromHistory,
    hasActiveAccess,
  } = useWatchHistory();

  // Show both active and expired rentals in Continue Watching.
  // Expired rentals will prompt the user to rent again.
  const visibleItems = continueWatching.filter(
    (item) => item.rental_status === "active" || item.rental_status === "expired",
  );

  // Don't render if user is not logged in or no relevant content to show
  if (!user || loading || visibleItems.length === 0) {
    return null;
  }


  const handlePlay = (item: WatchHistoryItem) => {
    // Navigate to the actual watch page instead of preview
    navigate(`/watch/${item.content_type}/${item.content_id}`);
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
            "md:scrollbar-default",
          )}
        >
          {visibleItems.map((item) => (
            <ContinueWatchingCard

              key={item.id}
              item={item}
              onPlay={() => handlePlay(item)}
              onRemove={() => handleRemove(item)}
              canRemove={canRemoveFromHistory(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContinueWatchingSection;
