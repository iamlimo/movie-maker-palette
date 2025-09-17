import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAllContent } from '@/hooks/useMovies';
import Header from '@/components/Header';
import MovieCard from '@/components/MovieCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Film, Tv } from 'lucide-react';

interface Genre {
  id: string;
  name: string;
}

const Genres = () => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [contentFilter, setContentFilter] = useState<'all' | 'movies' | 'tv_shows'>('all');
  const { content, loading } = useAllContent();

  useEffect(() => {
    const fetchGenres = async () => {
      const { data } = await supabase
        .from('genres')
        .select('*')
        .order('name');
      
      if (data) {
        setGenres(data);
      }
    };

    fetchGenres();
  }, []);

  const filteredContent = content
    .filter(item => {
      const genreMatch = selectedGenre === 'all' || item.genre?.id === selectedGenre;
      const typeMatch = contentFilter === 'all' || 
        (contentFilter === 'movies' && item.content_type === 'movie') ||
        (contentFilter === 'tv_shows' && item.content_type === 'tv_show');
      return genreMatch && typeMatch;
    });

  const getContentCounts = (genreId: string) => {
    const genreContent = content.filter(item => 
      genreId === 'all' || item.genre?.id === genreId
    );
    
    return {
      movies: genreContent.filter(item => item.content_type === 'movie').length,
      tvShows: genreContent.filter(item => item.content_type === 'tv_show').length,
      total: genreContent.length
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Browse by Genre
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore our collection organized by your favorite genres
            </p>
          </section>

          {/* Content Type Filter */}
          <div className="flex justify-center gap-2 mb-8">
            <Button
              variant={contentFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setContentFilter('all')}
              className="bg-card border-border hover:bg-secondary"
            >
              All Content
            </Button>
            <Button
              variant={contentFilter === 'movies' ? 'default' : 'outline'}
              onClick={() => setContentFilter('movies')}
              className="bg-card border-border hover:bg-secondary"
            >
              <Film className="h-4 w-4 mr-2" />
              Movies Only
            </Button>
            <Button
              variant={contentFilter === 'tv_shows' ? 'default' : 'outline'}
              onClick={() => setContentFilter('tv_shows')}
              className="bg-card border-border hover:bg-secondary"
            >
              <Tv className="h-4 w-4 mr-2" />
              TV Shows Only
            </Button>
          </div>

          {/* Genre Selection */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Select Genre</h2>
            <div className="flex flex-wrap gap-3">
              <Badge
                variant={selectedGenre === 'all' ? 'default' : 'outline'}
                className={`cursor-pointer px-4 py-2 text-sm transition-smooth ${
                  selectedGenre === 'all' 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-card border-border hover:bg-secondary text-foreground'
                }`}
                onClick={() => setSelectedGenre('all')}
              >
                All Genres ({getContentCounts('all').total})
              </Badge>
              
              {genres.map((genre) => {
                const counts = getContentCounts(genre.id);
                return (
                  <Badge
                    key={genre.id}
                    variant={selectedGenre === genre.id ? 'default' : 'outline'}
                    className={`cursor-pointer px-4 py-2 text-sm transition-smooth ${
                      selectedGenre === genre.id 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                        : 'bg-card border-border hover:bg-secondary text-foreground'
                    }`}
                    onClick={() => setSelectedGenre(genre.id)}
                  >
                    {genre.name} ({counts.total})
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Content Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-4 text-muted-foreground">
                Showing {filteredContent.length} items
                {selectedGenre !== 'all' && ` in ${genres.find(g => g.id === selectedGenre)?.name}`}
                {contentFilter !== 'all' && ` (${contentFilter === 'movies' ? 'Movies' : 'TV Shows'} only)`}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredContent.map((item) => (
                  <MovieCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    year={item.release_date ? new Date(item.release_date).getFullYear() : 2024}
                    rating={parseFloat(item.rating || '0')}
                    duration={(item as any).duration ? `${(item as any).duration}m` : 'N/A'}
                    price={`₦${item.price}`}
                    genre={item.genre?.name || 'Unknown'}
                    imageUrl={item.thumbnail_url || '/placeholder.svg'}
                    contentType={item.content_type}
                  />
                ))}
              </div>

              {filteredContent.length === 0 && (
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold mb-2 text-foreground">No content found</h3>
                  <p className="text-muted-foreground">
                    No content available for the selected genre and type combination
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Genres;