import EnhancedContentCard from "./EnhancedContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, memo, useState, useEffect } from "react";

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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons, { passive: true });
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, [movies]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.75;
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
    <section className="py-6 sm:py-8 md:py-12 group/section">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">{title}</h2>
            {subtitle && (
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">{subtitle}</p>
            )}
          </div>
          
          {/* Desktop navigation arrows */}
          <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity duration-300">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="h-9 w-9 rounded-full transition-all duration-200 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="h-9 w-9 rounded-full transition-all duration-200 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Scroll Container */}
        <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
          {/* Left fade gradient */}
          <div className={`hidden md:block absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
          
          {/* Right fade gradient */}
          <div className={`hidden md:block absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

          <div 
            ref={scrollContainerRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 
              snap-x snap-mandatory scroll-smooth
              md:overflow-visible md:pb-0 
              md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-5"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {movies.map((movie) => (
              <div 
                key={movie.id}
                className="flex-shrink-0 w-[42vw] min-w-[140px] max-w-[180px] 
                  sm:w-[35vw] sm:max-w-[200px]
                  md:w-auto md:max-w-none
                  snap-start"
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
      </div>
    </section>
  );
});

MovieSection.displayName = 'MovieSection';

export default MovieSection;

