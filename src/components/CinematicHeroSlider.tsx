import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Plus, Star, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSliderItems, SliderItem } from '@/hooks/useSliderItems';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import moviePlaceholder from "@/assets/movie-placeholder.jpg";
import FavoriteButton from '@/components/FavoriteButton';

const CinematicHeroSlider = () => {
  const navigate = useNavigate();
  const { sliderItems, loading } = useSliderItems();
  const { toggleFavorite } = useFavorites();
  const { user } = useAuth();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying || sliderItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, sliderItems.length]);

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

  // Rental functionality removed - use movie/TV preview pages for rentals

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

  if (loading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </section>
    );
  }

  if (!sliderItems.length) {
    return null;
  }

  const currentItem = sliderItems[currentIndex];

  return (
    <section 
      className="relative min-h-screen flex items-center overflow-hidden"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
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
          {/* Background Image */}
          <div className="absolute inset-0">
            <img 
              src={currentItem.poster_url || moviePlaceholder} 
              alt={currentItem.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = moviePlaceholder;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {sliderItems.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/20 hover:bg-background/40 text-white border-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/20 hover:bg-background/40 text-white border-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-16">
        <div className="max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Movie Badge */}
              <div className="flex items-center gap-4 mb-6">
                <Badge variant="secondary" className="px-3 py-1">
                  {currentItem.is_featured ? 'Featured' : 'Premium'} {currentItem.content_type === 'movie' ? 'Movie' : 'TV Show'}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                  <span>₦{currentItem.price}</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                {currentItem.title}
              </h1>

              {/* Description */}
              {currentItem.description && (
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  {currentItem.description}
                </p>
              )}

              {/* Genres */}
              {currentItem.genre && (
                <div className="flex items-center gap-2 mb-8">
                  <Badge variant="outline">{currentItem.genre}</Badge>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <Button 
                  variant="default" 
                  size="lg" 
                  className="shadow-glow hover:scale-105 transition-transform"
                  onClick={() => navigate(`/preview/${currentItem.content_type}/${currentItem.content_id}`)}
                >
                  <Play className="h-5 w-5 mr-2" />
                  View Details
                </Button>
                <div className="flex items-center gap-2">
                  <FavoriteButton
                    contentType={currentItem.content_type}
                    contentId={currentItem.content_id}
                    size="lg"
                    className="bg-white/20 hover:bg-white/30"
                  />
                  <Button 
                    variant="cinema" 
                    size="lg"
                    onClick={() => handleAddToWatchlist(currentItem)}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add to Watchlist
                  </Button>
                </div>
              </div>

              {/* Rental Info */}
              <div className="mt-6 text-sm text-muted-foreground">
                <p>48-hour rental period • HD & 4K available • Instant streaming</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Slide Indicators */}
      {sliderItems.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {sliderItems.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-primary scale-125' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default CinematicHeroSlider;