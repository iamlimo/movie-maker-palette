import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "@/components/MovieCard";

interface RecommendationsSectionProps {
  currentContentId: string;
  contentType: 'movie' | 'tv_show';
  genreId?: string;
}

interface RecommendedContent {
  id: string;
  title: string;
  release_date: string;
  rating: string;
  duration?: number;
  price: number;
  thumbnail_url: string;
  genre?: { name: string };
  content_type: 'movie' | 'tv_show';
}

const RecommendationsSection = ({ 
  currentContentId, 
  contentType, 
  genreId 
}: RecommendationsSectionProps) => {
  const [recommendations, setRecommendations] = useState<RecommendedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchRecommendations();
  }, [currentContentId, contentType, genreId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);

      // Fetch movies and TV shows separately
      const moviesQuery = supabase
        .from('movies')
        .select(`
          id,
          title,
          release_date,
          rating,
          duration,
          price,
          thumbnail_url,
          genre:genres(name)
        `)
        .eq('status', 'approved')
        .neq('id', contentType === 'movie' ? currentContentId : '00000000-0000-0000-0000-000000000000');

      const tvShowsQuery = supabase
        .from('tv_shows')
        .select(`
          id,
          title,
          release_date,
          rating,
          price,
          thumbnail_url,
          genres
        `)
        .eq('status', 'approved')
        .neq('id', contentType === 'tv_show' ? currentContentId : '00000000-0000-0000-0000-000000000000');

      // Add genre filtering if available
      if (genreId) {
        moviesQuery.eq('genre_id', genreId);
        tvShowsQuery.eq('genre_id', genreId);
      }

      // Limit results
      moviesQuery.limit(6);
      tvShowsQuery.limit(6);

      const [moviesResult, tvShowsResult] = await Promise.all([
        moviesQuery,
        tvShowsQuery
      ]);

      const movies = (moviesResult.data || []).map(item => ({
        ...item,
        content_type: 'movie' as const
      }));

      const tvShows = (tvShowsResult.data || []).map(item => ({
        ...item,
        genre: item.genres?.[0] ? { name: item.genres[0] } : undefined,
        content_type: 'tv_show' as const
      }));

      // Combine and shuffle results
      const combined = [...movies, ...tvShows];
      const shuffled = combined.sort(() => Math.random() - 0.5);
      
      // If we don't have enough recommendations with genre filter, fetch more without genre filter
      if (shuffled.length < 6 && genreId) {
        const [additionalMovies, additionalTVShows] = await Promise.all([
          supabase
            .from('movies')
            .select(`
              id,
              title,
              release_date,
              rating,
              duration,
              price,
              thumbnail_url,
              genre:genres(name)
            `)
            .eq('status', 'approved')
            .neq('id', contentType === 'movie' ? currentContentId : '00000000-0000-0000-0000-000000000000')
            .limit(3),
          supabase
            .from('tv_shows')
            .select(`
              id,
              title,
              release_date,
              rating,
              price,
              thumbnail_url,
              genres
            `)
            .eq('status', 'approved')
            .neq('id', contentType === 'tv_show' ? currentContentId : '00000000-0000-0000-0000-000000000000')
            .limit(3)
        ]);

        if (additionalMovies.data) {
          const additionalItems = additionalMovies.data.map(item => ({
            ...item,
            content_type: 'movie' as const
          }));
          shuffled.push(...additionalItems);
        }
        
        if (additionalTVShows.data) {
          const additionalItems = additionalTVShows.data.map(item => ({
            ...item,
            genre: item.genres?.[0] ? { name: item.genres[0] } : undefined,
            content_type: 'tv_show' as const
          }));
          shuffled.push(...additionalItems);
        }
      }

      setRecommendations(shuffled.slice(0, 12));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + 4 >= recommendations.length ? 0 : prev + 4
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev - 4 < 0 ? Math.max(0, recommendations.length - 4) : prev - 4
    );
  };

  if (loading) {
    return (
      <div className="py-8">
        <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-secondary animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  const visibleRecommendations = recommendations.slice(currentIndex, currentIndex + 4);

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">You May Also Like</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevSlide}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={nextSlide}
            disabled={currentIndex + 4 >= recommendations.length}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {visibleRecommendations.map((item) => (
          <div 
            key={item.id} 
            className="group transition-all duration-300 hover:scale-105 hover:z-10"
          >
            <MovieCard
              id={item.id}
              title={item.title}
              year={item.release_date ? new Date(item.release_date).getFullYear() : 2024}
              rating={item.rating ? parseFloat(item.rating) : 0}
              duration={item.duration ? `${item.duration}min` : '120min'}
              price={`₦${item.price}`}
              genre={item.genre?.name || 'Unknown'}
              imageUrl={item.thumbnail_url || '/placeholder.svg'}
              contentType={item.content_type}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationsSection;