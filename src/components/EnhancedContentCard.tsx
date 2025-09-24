import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play, Clock, Eye, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "@/hooks/use-toast";
import moviePlaceholder from "@/assets/movie-placeholder.jpg";

interface EnhancedContentCardProps {
  id: string;
  title: string;
  year?: number;
  rating?: number | string;
  duration?: string | number;
  price: number;
  genre?: string;
  imageUrl?: string;
  contentType: 'movie' | 'tv_show';
  description?: string;
  featured?: boolean;
  className?: string;
}

const EnhancedContentCard = ({ 
  id,
  title, 
  year, 
  rating, 
  duration, 
  price, 
  genre, 
  imageUrl,
  contentType,
  description,
  featured = false,
  className = ""
}: EnhancedContentCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, toggleFavorite, loading: favoritesLoading } = useFavorites();
  const [imageError, setImageError] = useState(false);

  const isFavorite = favorites.some(fav => fav.content_id === id && fav.content_type === contentType);

  const handlePreview = () => {
    const route = contentType === 'movie' ? `/movie/${id}` : `/tvshow/${id}`;
    navigate(route);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add content to your watchlist.",
        variant: "destructive",
      });
      return;
    }

    try {
      await toggleFavorite(contentType, id);
      toast({
        title: isFavorite ? "Removed from Watchlist" : "Added to Watchlist",
        description: isFavorite 
          ? `${title} has been removed from your watchlist.`
          : `${title} has been added to your watchlist.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update watchlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (dur?: string | number) => {
    if (!dur) return '';
    if (typeof dur === 'string') return dur;
    return `${dur}min`;
  };

  const formatPrice = (p: number) => {
    return p > 0 ? `₦${p.toLocaleString()}` : 'Free';
  };

  const displayRating = rating ? (typeof rating === 'string' ? rating : rating.toFixed(1)) : '0.0';
  const displayImage = imageError || !imageUrl ? moviePlaceholder : imageUrl;

  return (
    <div 
      className={`group relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer bg-card border border-border/50 hover:border-primary/20 hover:shadow-lg ${
        featured ? 'shadow-premium ring-1 ring-primary/10' : 'shadow-sm'
      } ${className}`}
      onClick={handlePreview}
    >
      {/* Poster Image */}
      <div className="relative aspect-[2/3] overflow-hidden bg-secondary">
        <img 
          src={displayImage} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          onError={() => setImageError(true)}
          loading="lazy"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Content Type Badge */}
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2 text-xs font-medium bg-background/90 text-foreground border-0"
        >
          {contentType === 'movie' ? 'Movie' : 'TV Show'}
        </Badge>

        {/* Favorite Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background/90 opacity-0 group-hover:opacity-100 transition-all duration-300"
          onClick={handleToggleFavorite}
          disabled={favoritesLoading}
        >
          <Heart className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-foreground'}`} />
        </Button>

        {/* Action Buttons Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 h-8 text-xs font-medium"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview();
              }}
            >
              <Play className="h-3 w-3 mr-1" />
              {price > 0 ? `Rent ${formatPrice(price)}` : 'Watch Free'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 h-8 text-xs font-medium bg-background/90 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview();
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
        </div>
      </div>

      {/* Content Info */}
      <div className="p-3 space-y-2">
        {/* Title and Price */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight flex-1">
            {title}
          </h3>
          <Badge 
            variant={price > 0 ? "default" : "secondary"} 
            className="text-xs font-medium shrink-0"
          >
            {formatPrice(price)}
          </Badge>
        </div>
        
        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {year && <span>{year}</span>}
          {rating && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{displayRating}</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(duration)}</span>
            </div>
          )}
        </div>
        
        {/* Genre */}
        {genre && (
          <Badge variant="outline" className="text-xs font-normal">
            {genre}
          </Badge>
        )}

        {/* Description (if provided) */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default EnhancedContentCard;