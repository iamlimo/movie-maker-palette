import { Play, Clock, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WatchHistoryItem } from '@/hooks/useWatchHistory';
import { formatDistanceToNow } from 'date-fns';

interface WatchProgressCardProps {
  item: WatchHistoryItem;
  onPlay?: () => void;
  onRemove?: () => void;
  onMarkCompleted?: () => void;
}

const WatchProgressCard: React.FC<WatchProgressCardProps> = ({
  item,
  onPlay,
  onRemove,
  onMarkCompleted
}) => {
  const formatDuration = (minutes: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatProgress = (progress: number) => {
    if (progress >= 100) return 'Completed';
    if (progress === 0) return 'Not started';
    return `${Math.round(progress)}% watched`;
  };

  const getTimeRemaining = (duration: number, progress: number) => {
    if (!duration || progress >= 100) return '';
    const watchedMinutes = (duration * progress) / 100;
    const remainingMinutes = duration - watchedMinutes;
    return formatDuration(Math.round(remainingMinutes));
  };

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/20">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
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
        
        {/* Progress overlay */}
        {item.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <Progress 
              value={item.progress} 
              className="h-1 bg-white/20" 
            />
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Button
            size="lg"
            onClick={onPlay}
            className="rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30"
          >
            <Play size={24} className="mr-2 fill-current" />
            {item.progress > 0 ? 'Continue' : 'Play'}
          </Button>
        </div>

        {/* Status badge */}
        {item.completed && (
          <Badge className="absolute top-2 left-2 bg-green-500/80 text-white">
            Completed
          </Badge>
        )}

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPlay && (
              <DropdownMenuItem onClick={onPlay}>
                <Play size={16} className="mr-2" />
                {item.progress > 0 ? 'Continue Watching' : 'Start Watching'}
              </DropdownMenuItem>
            )}
            {!item.completed && onMarkCompleted && (
              <DropdownMenuItem onClick={onMarkCompleted}>
                <Clock size={16} className="mr-2" />
                Mark as Completed
              </DropdownMenuItem>
            )}
            {onRemove && (
              <DropdownMenuItem 
                onClick={onRemove}
                className="text-destructive focus:text-destructive"
              >
                Remove from History
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight">
            {item.title || 'Unknown Title'}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatProgress(item.progress)}</span>
            {item.duration && (
              <span className="flex items-center">
                <Clock size={12} className="mr-1" />
                {item.completed 
                  ? formatDuration(item.duration)
                  : `${getTimeRemaining(item.duration, item.progress)} left`
                }
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            {item.genre && (
              <Badge variant="outline" className="text-xs">
                {item.genre}
              </Badge>
            )}
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(item.last_watched_at), { addSuffix: true })}
            </span>
          </div>

          {item.price && (
            <div className="text-xs font-medium text-primary">
              ₦{item.price.toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WatchProgressCard;