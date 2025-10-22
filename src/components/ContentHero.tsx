import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Star,
  Clock,
  Calendar,
  Heart,
  Share2,
} from "lucide-react";

interface ContentHeroProps {
  title: string;
  description: string;
  imageUrl: string;
  rating?: string;
  duration?: number;
  year?: number;
  genre?: string;
  price?: number;
  contentType?: "movie" | "tv_show";
  language?: string;
  onBack: () => void;
  onRent?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  cast_info?: string;
  viewer_discretion: string;
}

const ContentHero = ({
  title,
  description,
  imageUrl,
  rating,
  duration,
  year,
  genre,
  price,
  contentType = "movie",
  language,
  onBack,
  onRent,
  onToggleFavorite,
  isFavorite,
  viewer_discretion,
  cast_info,
}: ContentHeroProps) => {
  return (
    <section className="relative min-h-[70vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={imageUrl || "/placeholder.svg"}
          alt={title}
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-16">
        <div className="max-w-3xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-6 text-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {/* Compact Metadata - Single Line */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-wrap">
            <Badge variant="secondary" className="px-3 py-1">
              {contentType === "movie" ? "Movie" : "TV Show"}
            </Badge>
            {year && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{year}</span>
                </div>
              </>
            )}
            {duration && contentType === "movie" && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{duration}m</span>
                </div>
              </>
            )}
            {language && (
              <>
                <span>•</span>
                <span>{language}</span>
              </>
            )}
            {rating && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <span>{rating}</span>
                </div>
              </>
            )}
            {genre && (
              <>
                <span>•</span>
                <Badge variant="outline" className="px-2 py-0.5 text-xs">
                  {genre}
                </Badge>
              </>
            )}
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-foreground drop-shadow-lg">
            {title}
          </h1>

          {/* Description */}
          <p className="text-base md:text-lg text-foreground/90 mb-8 leading-relaxed max-w-2xl">
            {description}
          </p>
          {/* Cast Info */}
          {cast_info && (
            <p className="text-sm text-foreground/90 mb-4 leading-relaxed max-w-2xl">
              <span className="font-semibold italic">Starring:</span>{" "}
              {cast_info}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 flex-wrap">
            {onRent && price && (
              <Button
                variant="default"
                size="lg"
                className="shadow-glow hover:scale-105 transition-transform"
                onClick={onRent}
              >
                <Play className="h-5 w-5 mr-2" />
                {contentType === "movie"
                  ? `Rent for ₦${price}`
                  : "Rent Episodes"}
              </Button>
            )}
            {onToggleFavorite && (
              <Button variant="outline" size="lg" onClick={onToggleFavorite}>
                <Heart
                  className={`h-5 w-5 mr-2 ${isFavorite ? "fill-current" : ""}`}
                />
                {isFavorite ? "In Watchlist" : "Add to Watchlist"}
              </Button>
            )}
            <Button variant="outline" size="lg">
              <Share2 className="h-5 w-5 mr-2" />
              Share
            </Button>
          </div>

          {/* Rental Info */}
          <div className="mt-6 text-sm text-muted-foreground">
            <p>
              {/* {contentType === "movie"
                ? "48-hour rental period • HD & 4K available • Instant streaming • ⚠️  `{view_descirption}`"
                : "Multiple seasons available • Rent per episode or season"} */}
              {contentType === "movie" ? (
                <>
                  48-hour rental period • HD & 4K available • Instant streaming
                  • ⚠️ {viewer_discretion}
                </>
              ) : (
                <>
                  Multiple seasons available • Rent per episode or season • ⚠️{" "}
                  {viewer_discretion}
                </>
              )}
            </p>
            <br />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContentHero;
