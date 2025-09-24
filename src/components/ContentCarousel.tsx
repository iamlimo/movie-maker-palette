import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ContentCarouselProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  showNavigation?: boolean;
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({
  title,
  subtitle,
  children,
  className,
  showNavigation = true
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        
        {showNavigation && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              className="rounded-full w-10 h-10 hover:bg-secondary"
            >
              <ChevronLeft size={18} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              className="rounded-full w-10 h-10 hover:bg-secondary"
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        )}
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex space-x-4 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
};

interface ContentCarouselItemProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}

export const ContentCarouselItem: React.FC<ContentCarouselItemProps> = ({
  children,
  className,
  minWidth = '280px'
}) => {
  return (
    <div 
      className={cn('flex-shrink-0 snap-start', className)}
      style={{ minWidth }}
    >
      {children}
    </div>
  );
};

export default ContentCarousel;