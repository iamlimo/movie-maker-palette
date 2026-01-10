import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play, Eye, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, memo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "@/hooks/use-toast";
import moviePlaceholder from "@/assets/movie-placeholder.jpg";
import { formatNaira } from "@/lib/priceUtils";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface EnhancedContentCardProps {
  id: string;
  title: string;
  year?: number;
  rating?: number | string;
  duration?: string | number;
  price: number;
  genre?: string;
  imageUrl?: string;
  contentType: "movie" | "tv_show";
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
  className = "",
}: EnhancedContentCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    favorites,
    toggleFavorite,
    loading: favoritesLoading,
  } = useFavorites();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isFavorite = favorites.some(
    (fav) => fav.content_id === id && fav.content_type === contentType
  );

  const handlePreview = () => {
    const route = contentType === "movie" ? `/movie/${id}` : `/tvshow/${id}`;
    navigate(route, {
      state: {
        preloadedData: {
          id,
          title,
          description,
          thumbnail_url: imageUrl,
          genre: { name: genre },
          rating: rating?.toString(),
          price,
          duration: typeof duration === 'number' ? duration : undefined,
          release_date: year ? `${year}-01-01` : undefined,
        }
      }
    });
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

  const displayImage = imageError || !imageUrl ? moviePlaceholder : imageUrl;

  const getFormattedPrice = () => {
    if (price === 0) return "Free";

    if (contentType === "movie") {
      return `${formatNaira(price)} • Rent`;
    } else {
      return "₦3,000.00 • Season";
    }
  };

  // Long-press gesture handling
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const handleTouchStart = useCallback(() => {
    setIsPressed(true);
    longPressTimer.current = setTimeout(async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
          // Haptics not available
        }
      }
      setShowQuickActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (err) {
        // Haptics not available
      }
    }
    setShowQuickActions(true);
  }, []);

  return (
    <div
      className={`group/card relative flex flex-col overflow-hidden rounded-lg bg-card border border-border/40 
        transition-all duration-300 ease-out cursor-pointer
        md:hover:scale-105 md:hover:z-10 md:hover:shadow-2xl md:hover:border-primary/40
        ${isPressed ? 'scale-[0.98]' : ''}
        ${featured ? "ring-1 ring-primary/20" : ""} 
        ${className}`}
      onClick={handlePreview}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-muted/30">
        {/* Shimmer loading placeholder */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-shimmer" />
        )}
        <img
          src={displayImage}
          alt={title}
          className={`w-full h-full object-cover transition-all duration-500 ease-out
            ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            group-hover/card:scale-110`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
          loading="lazy"
        />

        {/* Hover Overlay - Desktop only */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-0 md:group-hover/card:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-x-3 bottom-3 space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-9 text-xs font-medium shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview();
                }}
              >
                <Play className="h-3 w-3 mr-1.5" />
                {price > 0 ? "Rent" : "Watch"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 h-9 text-xs font-medium shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview();
                }}
              >
                <Eye className="h-3 w-3 mr-1.5" />
                Info
              </Button>
            </div>
          </div>
        </div>

        {/* Favorite Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 left-2 h-8 w-8 backdrop-blur-sm bg-background/80 hover:bg-background/90 border-0 opacity-0 md:group-hover/card:opacity-100 transition-all duration-300 shadow-sm"
          onClick={handleToggleFavorite}
          disabled={favoritesLoading}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isFavorite
                ? "fill-rose-500 text-rose-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          />
        </Button>

        {/* Price Badge */}
        <div className="absolute top-2 right-2">
          <Badge
            variant={price > 0 ? "default" : "secondary"}
            className="text-[10px] sm:text-xs font-semibold backdrop-blur-md bg-background/95 border-0 shadow-md"
          >
            <span className="text-muted-foreground">{getFormattedPrice()}</span>
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 sm:p-3 space-y-1.5 sm:space-y-2 flex-1 flex flex-col">
        <h3 className="font-semibold text-xs sm:text-sm leading-tight text-foreground md:group-hover/card:text-primary transition-colors line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
          {title}
        </h3>

        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
          {year && <span className="font-medium">{year}</span>}
          {rating && (
            <div className="flex items-center gap-1">
              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-amber-400 text-amber-400" />
            </div>
          )}
        </div>

        {genre && (
          <Badge
            variant="outline"
            className="text-[10px] sm:text-xs font-normal border-border/60 w-fit"
          >
            {genre}
          </Badge>
        )}

        {description && (
          <p className="hidden sm:block text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Quick Actions Modal */}
      {showQuickActions && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowQuickActions(false);
          }}
        >
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 min-w-[240px] max-w-[90vw] animate-scale-in">
            <h4 className="font-semibold text-sm text-center line-clamp-2">{title}</h4>
            <Button 
              className="w-full h-11" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowQuickActions(false);
                handlePreview();
              }}
            >
              <Play className="h-4 w-4 mr-2" />
              {price > 0 ? "Rent Now" : "Watch Now"}
            </Button>
            <Button 
              variant="secondary" 
              className="w-full h-11" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowQuickActions(false);
                handleToggleFavorite(e);
              }}
            >
              <Heart className={`h-4 w-4 mr-2 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
              {isFavorite ? "Remove from Watchlist" : "Add to Watchlist"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(EnhancedContentCard);

