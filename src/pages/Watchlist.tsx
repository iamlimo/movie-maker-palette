import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import Header from '@/components/Header';
import MovieCard from '@/components/MovieCard';
import { Button } from '@/components/ui/button';
import { Heart, Film, Tv, Trash2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';

const Watchlist = () => {
  const { user } = useAuth();
  const { favorites, loading, removeFromFavorites, refetch } = useFavorites();
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv_show'>('all');
  const isMobile = useIsMobile();

  const { isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      if (refetch) await refetch();
    },
    enabled: isMobile && !!user,
  });

  const filteredFavorites = favorites?.filter(fav => 
    filter === 'all' || fav.content_type === filter
  ) || [];

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      await removeFromFavorites(favoriteId);
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-md mx-auto">
              <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h1 className="text-2xl font-bold mb-2 text-foreground">Sign In Required</h1>
              <p className="text-muted-foreground mb-6">
                Please sign in to view your watchlist and manage your favorite content.
              </p>
              <Link to="/auth?mode=login">
                <Button className="gradient-accent text-primary-foreground shadow-glow">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Pull-to-refresh indicator */}
      {isRefreshing && isMobile && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Refreshing...</span>
        </div>
      )}
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Heart className="h-8 w-8 text-primary" />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                My Watchlist
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your collection of favorite movies and TV shows
            </p>
          </section>

          {/* Filter Buttons */}
          <div className="flex justify-center gap-2 mb-8">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className="bg-card border-border hover:bg-secondary"
            >
              All ({favorites?.length || 0})
            </Button>
            <Button
              variant={filter === 'movie' ? 'default' : 'outline'}
              onClick={() => setFilter('movie')}
              className="bg-card border-border hover:bg-secondary"
            >
              <Film className="h-4 w-4 mr-2" />
              Movies ({favorites?.filter(f => f.content_type === 'movie').length || 0})
            </Button>
            <Button
              variant={filter === 'tv_show' ? 'default' : 'outline'}
              onClick={() => setFilter('tv_show')}
              className="bg-card border-border hover:bg-secondary"
            >
              <Tv className="h-4 w-4 mr-2" />
              TV Shows ({favorites?.filter(f => f.content_type === 'tv_show').length || 0})
            </Button>
          </div>

          {/* Watchlist Content */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : filteredFavorites.length > 0 ? (
            <>
              <div className="mb-4 text-muted-foreground">
                Showing {filteredFavorites.length} favorites
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredFavorites.map((favorite) => (
                  <div key={favorite.id} className="relative group">
                    <MovieCard
                      id={favorite.content_id}
                      title={favorite.title || 'Unknown Title'}
                      year={2024}
                      rating={0}
                      duration="N/A"
                      price="₦0"
                      genre="Unknown"
                      imageUrl={favorite.thumbnail_url || '/placeholder.svg'}
                      contentType={favorite.content_type as 'movie' | 'tv_show'}
                    />
                    
                    {/* Remove Button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveFavorite(favorite.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {filter === 'all' ? 'Your watchlist is empty' : `No ${filter === 'movie' ? 'movies' : 'TV shows'} in your watchlist`}
              </h3>
              <p className="text-muted-foreground mb-6">
                Start building your watchlist by adding your favorite content
              </p>
              <div className="flex gap-4 justify-center">
                <Link to="/movies">
                  <Button variant="outline" className="bg-card border-border hover:bg-secondary">
                    <Film className="h-4 w-4 mr-2" />
                    Browse Movies
                  </Button>
                </Link>
                <Link to="/genres">
                  <Button className="gradient-accent text-primary-foreground shadow-glow">
                    <Tv className="h-4 w-4 mr-2" />
                    Explore Genres
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Watchlist;