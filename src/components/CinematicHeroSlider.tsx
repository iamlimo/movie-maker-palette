import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Plus, Star, Clock, ChevronLeft, ChevronRight, Sparkles, Bell } from 'lucide-react';
import { useSliderItems, SliderItem } from '@/hooks/useSliderItems';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import moviePlaceholder from "@/assets/movie-placeholder.jpg";
import FavoriteButton from '@/components/FavoriteButton';
import { formatNaira } from '@/lib/priceUtils';
import { differenceInDays, differenceInHours, differenceInMinutes, format, isPast } from 'date-fns';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

const CinematicHeroSlider = () => {
  const navigate = useNavigate();
  const { sliderItems, loading } = useSliderItems();
  const { toggleFavorite } = useFavorites();
  const { user } = useAuth();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Swipe gesture handling for mobile
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => nextSlide(),
    onSwipeRight: () => prevSlide(),
    threshold: 50,
  });

  // Preload first slide image for LCP optimization
  useEffect(() => {
    if (sliderItems.length > 0 && sliderItems[0].poster_url) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = sliderItems[0].poster_url;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
      return () => {
        try {
          document.head.removeChild(link);
        } catch (e) {
          // Link already removed
        }
      };
    }
  }, [sliderItems]);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying || sliderItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, sliderItems.length]);

  // Reset image loaded state when slide changes
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
    setIsAutoPlaying(false);
  }, [sliderItems.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + sliderItems.length) % sliderItems.length);
    setIsAutoPlaying(false);
  }, [sliderItems.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  }, []);

  const handleAddToWatchlist = async (item: SliderItem) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add to watchlist.",
        variant: "destructive",
      });
      return;
    }

    try {
      await toggleFavorite(item.content_type, item.content_id);
      toast({
        title: "Added to Watchlist",
        description: `${item.title} has been added to your watchlist.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to add to watchlist",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCountdown = (releaseDate: string | null) => {
    if (!releaseDate) return null;
    
    const release = new Date(releaseDate);
    if (isPast(release)) return null;

    const days = differenceInDays(release, new Date());
    const hours = differenceInHours(release, new Date()) % 24;
    const minutes = differenceInMinutes(release, new Date()) % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleNotifyMe = (item: SliderItem) => {
    toast({
      title: "Notification Set",
      description: `We'll notify you when ${item.title} is released!`,
    });
  };

  if (loading) {
    return (
      <section className="relative min-h-[80vh] sm:min-h-screen flex items-center justify-center bg-background overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl space-y-4 sm:space-y-6">
            <Skeleton className="h-6 sm:h-8 w-32 sm:w-48" />
            <Skeleton className="h-12 sm:h-20 w-full" />
            <Skeleton className="h-8 sm:h-12 w-3/4" />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Skeleton className="h-12 w-full sm:w-32" />
              <Skeleton className="h-12 w-full sm:w-32" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!sliderItems.length) {
    return null;
  }

  const currentItem = sliderItems[currentIndex];
  const isComingSoon = currentItem.promotion_type === 'coming_soon';
  const isPromoted = currentItem.promotion_type === 'promoted';
  const countdown = getCountdown(currentItem.release_date);

  return (
    <section 
      className="relative min-h-[80vh] sm:min-h-screen flex items-center overflow-hidden"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
      {...swipeHandlers}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Background Image with smooth loading */}
          <div className="absolute inset-0">
            {/* Shimmer placeholder */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-shimmer" />
            )}
            <img 
              src={currentItem.poster_url || moviePlaceholder} 
              alt={currentItem.title}
              fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover transition-all duration-700 ${
                isComingSoon ? 'opacity-60 blur-sm' : ''
              } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = moviePlaceholder;
                setImageLoaded(true);
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            
            {/* Promoted overlay effect */}
            {isPromoted && (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 animate-pulse" />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows - Hidden on mobile, visible on tablet+ */}
      {sliderItems.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="hidden sm:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-background/20 hover:bg-background/40 text-foreground border-border/20 backdrop-blur-sm transition-all duration-300 hover:scale-110"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="hidden sm:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-background/20 hover:bg-background/40 text-foreground border-border/20 backdrop-blur-sm transition-all duration-300 hover:scale-110"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-16 sm:pt-20">
        <div className="max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Badges - Responsive wrap */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
                {isPromoted && (
                  <Badge className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-orange-600 animate-pulse">
                    <Sparkles className="mr-1 h-3 w-3" />
                    {currentItem.promotion_badge_text || 'PROMOTED'}
                  </Badge>
                )}
                {isComingSoon && (
                  <Badge className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gradient-to-r from-blue-500 to-purple-600">
                    <Clock className="mr-1 h-3 w-3" />
                    COMING SOON
                  </Badge>
                )}
                <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-sm">
                  {currentItem.is_featured ? 'Featured' : 'Premium'} {currentItem.content_type === 'movie' ? 'Movie' : 'TV Show'}
                </Badge>
                
                {!isComingSoon && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                    {currentItem.rating && (
                      <>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          <span>{currentItem.rating}</span>
                        </div>
                        <span>•</span>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>48h rental</span>
                    </div>
                    <span>•</span>
                    <span>{formatNaira(currentItem.price)}</span>
                  </div>
                )}
              </div>

              {/* Coming Soon Release Info */}
              {isComingSoon && currentItem.release_date && (
                <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  <Badge variant="outline" className="text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
                    Releases: {format(new Date(currentItem.release_date), 'MMM d, yyyy')}
                  </Badge>
                  {countdown && (
                    <Badge variant="outline" className="text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2 animate-pulse">
                      <Clock className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      {countdown} remaining
                    </Badge>
                  )}
                </div>
              )}

              {/* Title - Responsive sizing */}
              <h1 className={`text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-3 sm:mb-4 bg-gradient-to-r ${
                isPromoted ? 'from-amber-500 via-orange-500 to-primary' :
                isComingSoon ? 'from-blue-500 via-purple-500 to-primary' :
                'from-foreground to-primary'
              } bg-clip-text text-transparent leading-tight`}>
                {currentItem.title}
              </h1>

              {/* Description - Responsive */}
              {currentItem.description && (
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 leading-relaxed line-clamp-3 sm:line-clamp-none">
                  {currentItem.description}
                </p>
              )}

              {/* Genres & Price on mobile */}
              <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8">
                {currentItem.genre && (
                  <Badge variant="outline" className="text-xs sm:text-sm">{currentItem.genre}</Badge>
                )}
                {!isComingSoon && (
                  <Badge variant="outline" className="text-xs sm:text-sm sm:hidden">{formatNaira(currentItem.price)}</Badge>
                )}
              </div>

              {/* Action Buttons - Responsive stacking */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                {isComingSoon ? (
                  <Button 
                    variant="default" 
                    size="lg" 
                    className="w-full sm:w-auto shadow-glow hover:scale-105 transition-transform bg-gradient-to-r from-blue-500 to-purple-600 h-12 sm:h-11 text-base"
                    onClick={() => handleNotifyMe(currentItem)}
                  >
                    <Bell className="h-5 w-5 mr-2" />
                    Notify Me
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    size="lg" 
                    className={`w-full sm:w-auto shadow-glow hover:scale-105 transition-transform h-12 sm:h-11 text-base ${
                      isPromoted ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700' : ''
                    }`}
                    onClick={() => {
                      const route = currentItem.content_type === 'movie' 
                        ? `/movie/${currentItem.content_id}` 
                        : `/tvshow/${currentItem.content_id}`;
                      navigate(route);
                    }}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {isPromoted ? 'Watch Now' : 'View Details'}
                  </Button>
                )}
                
                <div className="flex items-center gap-2 sm:gap-3">
                  <FavoriteButton
                    contentType={currentItem.content_type}
                    contentId={currentItem.content_id}
                    size="lg"
                    className="flex-1 sm:flex-none bg-background/20 hover:bg-background/30 h-12 sm:h-11"
                  />
                  {!isComingSoon && (
                    <Button 
                      variant="cinema" 
                      size="lg"
                      className="flex-1 sm:flex-none h-12 sm:h-11 text-sm sm:text-base"
                      onClick={() => handleAddToWatchlist(currentItem)}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      <span className="hidden xs:inline">Add to</span> Watchlist
                    </Button>
                  )}
                </div>
              </div>

              {/* Info Footer */}
              <div className="mt-4 sm:mt-6 text-xs sm:text-sm text-muted-foreground">
                {isComingSoon ? (
                  <p>We'll notify you when this becomes available</p>
                ) : (
                  <p className="hidden sm:block">48-hour rental period • HD & 4K available • Instant streaming</p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Slide Indicators - Larger touch targets on mobile */}
      {sliderItems.length > 1 && (
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-2">
          {sliderItems.map((item, index) => {
            const isPromotedSlide = item.promotion_type === 'promoted';
            const isComingSoonSlide = item.promotion_type === 'coming_soon';
            
            return (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 sm:h-3 rounded-full transition-all duration-300 touch-target min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  index === currentIndex 
                    ? ''
                    : ''
                }`}
                aria-label={`Go to slide ${index + 1}`}
              >
                <span className={`block rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? isPromotedSlide 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 h-2.5 sm:h-3 w-6 sm:w-8' 
                      : isComingSoonSlide
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 sm:h-3 w-6 sm:w-8'
                      : 'bg-primary h-2.5 sm:h-3 w-6 sm:w-8'
                    : 'bg-foreground/40 hover:bg-foreground/60 h-2 sm:h-3 w-2 sm:w-3'
                }`} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CinematicHeroSlider;