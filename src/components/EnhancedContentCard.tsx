import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play, Clock, Eye, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "@/hooks/use-toast";
import moviePlaceholder from "@/assets/movie-placeholder.jpg";
import { formatNaira } from "@/lib/priceUtils";

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

  const isFavorite = favorites.some(
    (fav) => fav.content_id === id && fav.content_type === contentType
  );

  const handlePreview = () => {
    const route = contentType === "movie" ? `/movie/${id}` : `/tvshow/${id}`;
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
    if (!dur) return "";
    if (typeof dur === "string") return dur;
    return `${dur}min`;
  };

  const displayRating = rating
    ? typeof rating === "string"
      ? rating
      : rating.toFixed(1)
    : "0.0";
  const displayImage = imageError || !imageUrl ? moviePlaceholder : imageUrl;

  const getFormattedPrice = () => {
    if (price === 0) return "Free";

    if (contentType === "movie") {
      return `${formatNaira(price)} • Rent`;
    } else {
      // TV Show pricing
      return "₦3,000.00 • Season";
    }
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-xl cursor-pointer ${
        featured ? "ring-1 ring-primary/20" : ""
      } ${className}`}
      onClick={handlePreview}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-muted/30">
        <img
          src={displayImage}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImageError(true)}
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-x-4 bottom-4 space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs font-medium shadow-lg"
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
                className="flex-1 h-8 text-xs font-medium shadow-lg"
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
          className="absolute top-2 left-2 h-8 w-8 backdrop-blur-sm bg-background/80 hover:bg-background/90 border-0 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm"
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
            className="text-xs font-semibold backdrop-blur-md bg-background/95 border-0 shadow-md"
          >
            <span className="text-gray-400">{getFormattedPrice()}</span>
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm leading-tight text-white group-hover:text-primary transition-colors line-clamp-2 min-h-[2.5rem]">
          {title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {year && <span className="font-medium">{year}</span>}
          {rating && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {/* <span className="font-medium">{displayRating}</span> */}
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-1">
              {/* <Clock className="h-3 w-3" /> */}
              {/* <span>{formatDuration(duration)}</span> */}
            </div>
          )}
        </div>

        {genre && (
          <Badge
            variant="outline"
            className="text-xs font-normal border-border/60"
          >
            {genre}
          </Badge>
        )}

        {description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default EnhancedContentCard;
