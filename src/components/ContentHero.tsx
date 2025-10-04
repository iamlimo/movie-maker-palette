import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Star, Clock, Calendar } from "lucide-react";
import TrailerPlayer from "./TrailerPlayer";

interface ContentHeroProps {
  title: string;
  description: string;
  imageUrl: string;
  trailerUrl?: string;
  rating?: string;
  duration?: number;
  year?: number;
  genre?: string;
  price?: number;
  contentType?: 'movie' | 'tv_show';
  language?: string;
  onBack: () => void;
  onRent?: () => void;
}

const ContentHero = ({
  title,
  description,
  imageUrl,
  trailerUrl,
  rating,
  duration,
  year,
  genre,
  price,
  contentType = 'movie',
  language,
  onBack,
  onRent
}: ContentHeroProps) => {
  const [showTrailer, setShowTrailer] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Auto-play trailer after 3 seconds (credit optimized)
  useEffect(() => {
    if (!trailerUrl || !imageLoaded) return;

    const timer = setTimeout(() => {
      setShowTrailer(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [trailerUrl, imageLoaded]);

  // Pause video when section is out of view (credit optimization)
  useEffect(() => {
    if (!showTrailer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setShowTrailer(false);
        }
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [showTrailer]);

  return (
    <section 
      ref={sectionRef}
      className="relative min-h-[80vh] flex items-center overflow-hidden"
    >
      {/* Background - Poster or Trailer */}
      <div className="absolute inset-0">
        {showTrailer && trailerUrl ? (
          <div className="relative w-full h-full">
            <TrailerPlayer 
              trailerUrl={trailerUrl}
              title={title}
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
          </div>
        ) : (
          <>
            <img 
              src={imageUrl || '/placeholder.svg'} 
              alt={title}
              className="w-full h-full object-cover"
              loading="eager"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </>
        )}
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
              {contentType === 'movie' ? 'Movie' : 'TV Show'}
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
            {duration && contentType === 'movie' && (
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
                <Badge variant="outline" className="px-2 py-0.5 text-xs">{genre}</Badge>
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
                {contentType === 'movie' ? `Rent for ₦${price}` : 'Rent Episodes'}
              </Button>
            )}
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