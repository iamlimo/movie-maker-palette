import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Play, Heart, Star, Clock, Calendar, Globe } from "lucide-react";
import Header from "@/components/Header";
import TrailerPlayer from "@/components/TrailerPlayer";
import ContentHero from "@/components/ContentHero";
import RecommendationsSection from "@/components/RecommendationsSection";
import RentalButton from "@/components/RentalButton";
import VideoPlayerWithValidation from "@/components/VideoPlayerWithValidation";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";

interface Movie {
  id: string;
  title: string;
  description: string;
  genre_id: string;
  genre?: { name: string };
  release_date: string;
  duration: number;
  price: number;
  rating: string;
  language: string;
  thumbnail_url: string;
  video_url: string;
  trailer_url: string;
  status: string;
  cast_crew?: any[];
}

const MoviePreview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, toggleFavorite, loading: favoritesLoading } = useFavorites();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFavorite = movie ? favorites.some(fav => fav.content_id === movie.id && fav.content_type === 'movie') : false;

  useEffect(() => {
    if (id) {
      fetchMovie(id);
    }
  }, [id]);

  const fetchMovie = async (movieId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('movies')
        .select(`
          *,
          genre:genres(name),
          thumbnail_url,
          video_url,
          trailer_url,
          landscape_poster_url,
          slider_cover_url
        `)
        .eq('id', movieId)
        .eq('status', 'approved')
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Movie not found');
      }

      setMovie(data);
    } catch (error: any) {
      console.error('Error fetching movie:', error);
      setError(error.message || 'Failed to load movie');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!movie || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add movies to your watchlist.",
        variant: "destructive",
      });
      return;
    }

    try {
      await toggleFavorite('movie', movie.id);
      toast({
        title: isFavorite ? "Removed from Watchlist" : "Added to Watchlist",
        description: isFavorite 
          ? `${movie.title} has been removed from your watchlist.`
          : `${movie.title} has been added to your watchlist.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update watchlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Movie Not Found</h1>
            <p className="text-muted-foreground mb-6">
              {error || "The movie you're looking for doesn't exist or is not available."}
            </p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Content Hero Section */}
      <ContentHero
        title={movie.title}
        description={movie.description || ''}
        imageUrl={movie.thumbnail_url || ''}
        trailerUrl={movie.trailer_url || undefined}
        rating={movie.rating || undefined}
        duration={movie.duration || undefined}
        year={movie.release_date ? new Date(movie.release_date).getFullYear() : undefined}
        genre={movie.genre?.name}
        price={movie.price / 100} // Convert kobo to Naira for display
        language={movie.language || undefined}
        onBack={() => navigate('/')}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Movie Details */}
            <div>
              <h2 className="text-2xl font-bold mb-4">About This Movie</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {movie.description}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Release Year</p>
                  <p className="font-semibold">
                    {movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Runtime</p>
                  <p className="font-semibold">{movie.duration} minutes</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Language</p>
                  <p className="font-semibold">{movie.language || 'English'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="font-semibold">{movie.rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cast & Crew */}
            {movie.cast_crew && movie.cast_crew.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Cast & Crew</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {movie.cast_crew.slice(0, 8).map((member: any, index: number) => (
                    <div key={index} className="text-center">
                      <div className="w-20 h-20 rounded-full bg-secondary mx-auto mb-2 flex items-center justify-center">
                        {member.photo_url ? (
                          <img 
                            src={member.photo_url} 
                            alt={member.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-muted-foreground">
                            {member.name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rental Actions */}
            <RentalButton
              contentId={movie.id}
              contentType="movie"
              price={movie.price}
              title={movie.title}
            />

            {/* Watchlist Action */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleFavorite}
                disabled={favoritesLoading}
              >
                <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                {isFavorite ? 'Remove from Watchlist' : 'Add to Watchlist'}
              </Button>
            </div>

            {/* Movie Info */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <h3 className="font-semibold mb-4">Movie Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Released {movie.release_date ? new Date(movie.release_date).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{movie.duration} minutes</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{movie.language || 'English'}</span>
                </div>
                {movie.genre?.name && (
                  <div className="pt-2">
                    <Badge variant="outline">{movie.genre.name}</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="container mx-auto px-4 pb-12">
        <RecommendationsSection
          currentContentId={movie.id}
          contentType="movie"
          genreId={movie.genre_id}
        />
      </div>
    </div>
  );
};

export default MoviePreview;