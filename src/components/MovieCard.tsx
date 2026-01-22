import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play, Clock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import moviePlaceholder from "@/assets/movie-placeholder.jpg";
import { formatNaira } from "@/lib/priceUtils";
import { usePlatform } from "@/hooks/usePlatform";

interface MovieCardProps {
  id: string;
  title: string;
  year: number;
  rating: number;
  duration: string;
  price: string | number;
  genre: string;
  imageUrl: string;
  contentType?: "movie" | "tv_show";
  featured?: boolean;
}

const MovieCard = ({
  id,
  title,
  year,
  rating,
  duration,
  price,
  genre,
  imageUrl,
  contentType = "movie",
  featured = false,
}: MovieCardProps) => {
  const navigate = useNavigate();
  const { isIOS } = usePlatform();

  const handlePreview = () => {
    const route = contentType === "movie" ? `/movie/${id}` : `/tvshow/${id}`;
    navigate(route, {
      state: {
        preloadedData: {
          id,
          title,
          thumbnail_url: imageUrl,
          genre: { name: genre },
          rating: rating?.toString(),
          price: typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, "")) : price,
          duration,
          release_date: year ? `${year}-01-01` : undefined,
        }
      }
    });
  };

  const getFormattedPrice = () => {
    // iOS: Hide pricing to comply with App Store guidelines
    if (isIOS) return "Available";
    
    const numPrice =
      typeof price === "string"
        ? parseFloat(price.replace(/[^0-9.]/g, ""))
        : price;

    if (numPrice === 0) return "Free";

    if (contentType === "movie") {
      return `${formatNaira(numPrice)} • Rent`;
    } else {
      // TV Show pricing
      return "₦3000 • Season";
    }
  };

  return (
    <div
      onClick={handlePreview}
      className={`group relative flex flex-col overflow-hidden rounded-lg bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-xl cursor-pointer ${
        featured ? "ring-1 ring-primary/20" : ""
      }`}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-muted/30">
        <img
          src={imageUrl || moviePlaceholder}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = moviePlaceholder;
          }}
          loading="lazy"
        />

        {/* Hover Overlay - Hide Rent/Info buttons on iOS */}
        {!isIOS && (
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute inset-x-4 bottom-4 flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs font-medium shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Play className="h-3 w-3 mr-1.5" />
                {getFormattedPrice() === "Free" ? "Watch" : "Rent"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 h-8 text-xs font-medium shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="h-3 w-3 mr-1.5" />
                Info
              </Button>
            </div>
          </div>
        )}

        {/* Price Badge */}
        <div className="absolute top-2 right-2">
          <Badge
            variant={getFormattedPrice() === "Free" ? "secondary" : "default"}
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
          <span className="font-medium">{year}</span>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-medium">{rating || "0.0"}</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1">
              {/* <Clock className="h-3 w-3" />
              <span>{duration}</span> */}
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
      </div>
    </div>
  );
};

export default MovieCard;
