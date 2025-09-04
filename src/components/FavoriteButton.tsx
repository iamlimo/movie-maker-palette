import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  contentType: 'movie' | 'episode' | 'season' | 'tv_show';
  contentId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  contentType,
  contentId,
  size = 'md',
  className
}) => {
  const { isFavorite, toggleFavorite, loading } = useFavorites();
  const isInFavorites = isFavorite(contentType, contentId);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavorite(contentType, contentId);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        sizeClasses[size],
        'rounded-full transition-all duration-200 hover:scale-110',
        isInFavorites 
          ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
          : 'bg-white/20 text-white hover:bg-white/30',
        className
      )}
      title={isInFavorites ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart 
        size={iconSizes[size]} 
        className={cn(
          'transition-all duration-200',
          isInFavorites && 'fill-current'
        )}
      />
    </Button>
  );
};

export default FavoriteButton;