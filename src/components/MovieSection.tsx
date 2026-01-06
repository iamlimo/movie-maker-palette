import EnhancedContentCard from "./EnhancedContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useMemo, memo } from "react";

interface MovieSectionProps {
  title: string;
  subtitle?: string;
  movies: Array<{
    id: string;
    title: string;
    year?: number;
    rating?: number;
    duration?: string;
    price: number;
    genre?: string;
    imageUrl?: string;
    contentType?: 'movie' | 'tv_show';
    description?: string;
  }>;
}

const MovieSection = memo(({ title, subtitle, movies }: MovieSectionProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!movies || movies.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{title}</h2>
            {subtitle && (
              <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
            )}
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => scroll('left')}
              className="h-9 w-9 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => scroll('right')}
              className="h-9 w-9 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Grid/Scroll Container - with momentum scrolling */}
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 md:gap-6 md:overflow-visible md:pb-0 snap-x snap-mandatory scroll-smooth"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {movies.map((movie) => (
            <div 
              key={movie.id}
              className="flex-shrink-0 w-48 md:w-auto snap-start"
            >
              <EnhancedContentCard
                id={movie.id}
                title={movie.title}
                year={movie.year}
                rating={movie.rating}
                duration={movie.duration}
                price={movie.price || 0}
                genre={movie.genre}
                imageUrl={movie.imageUrl}
                contentType={movie.contentType || 'movie'}
                description={movie.description}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

MovieSection.displayName = 'MovieSection';

export default MovieSection;

