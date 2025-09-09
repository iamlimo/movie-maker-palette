import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Star, Clock } from "lucide-react";

interface ContentHeroProps {
  title: string;
  description: string;
  imageUrl: string;
  rating?: string;
  duration?: number;
  year?: number;
  genre?: string;
  price?: number;
  contentType?: 'movie' | 'tv_show';
  onBack: () => void;
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
  contentType = 'movie',
  onBack
}: ContentHeroProps) => {
  return (
    <section className="relative min-h-[70vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={imageUrl || '/placeholder.svg'} 
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
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

          {/* Content Badge & Metadata */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <Badge variant="secondary" className="px-3 py-1">
              {contentType === 'movie' ? 'Movie' : 'TV Show'}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {rating && (
                <>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span>{rating}</span>
                  </div>
                  <span>•</span>
                </>
              )}
              {duration && contentType === 'movie' && (
                <>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{duration}m</span>
                  </div>
                  <span>•</span>
                </>
              )}
              {year && <span>{year}</span>}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent leading-tight">
            {title}
          </h1>

          {/* Description */}
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl">
            {description}
          </p>

          {/* Genres & Price */}
          <div className="flex items-center gap-4 mb-8 flex-wrap">
            {genre && (
              <Badge variant="outline">{genre}</Badge>
            )}
            {price && (
              <Badge variant="secondary" className="text-primary font-semibold">
                ₦{price}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="premium" size="lg" className="shadow-glow">
              <Play className="h-5 w-5 mr-2" />
              {contentType === 'movie' ? `Rent for ₦${price}` : 'View Episodes'}
            </Button>
          </div>

          {/* Rental Info */}
          <div className="mt-6 text-sm text-muted-foreground">
            <p>
              {contentType === 'movie' 
                ? '48-hour rental period • HD & 4K available • Instant streaming'
                : 'Multiple seasons available • Rent per episode or season'
              }
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContentHero;