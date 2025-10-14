import { useState } from 'react';
import { useTVShows } from '@/hooks/useMovies';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Filter, Grid, List } from 'lucide-react';
import MovieCard from '@/components/MovieCard';
import Header from '@/components/Header';

const TVShows = () => {
  const { tvShows, loading } = useTVShows();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTVShows = tvShows
    ?.filter(show => 
      show.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      show.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    ?.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        default:
          return 0;
      }
    }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              TV Shows Collection
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover and rent from our extensive collection of premium TV shows
            </p>
          </section>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 p-6 bg-card rounded-lg border border-border">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search TV shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48 bg-background border-border">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-lg border border-border">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* TV Shows Grid/List */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-4 text-muted-foreground">
                Showing {filteredTVShows.length} TV shows
              </div>
              
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6" 
                : "space-y-4"
              }>
                {filteredTVShows.map((show) => (
                  <MovieCard
                    key={show.id}
                    id={show.id}
                    title={show.title}
                    year={show.release_date ? new Date(show.release_date).getFullYear() : 2024}
                    rating={parseFloat(show.rating || '0')}
                    duration=""
                    price={`₦${show.price}`}
                    genre={show.genre?.name || 'Unknown'}
                    imageUrl={show.thumbnail_url || '/placeholder.svg'}
                    contentType="tv_show"
                  />
                ))}
              </div>

              {filteredTVShows.length === 0 && (
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold mb-2 text-foreground">No TV shows found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? `No TV shows match "${searchQuery}"` : 'No TV shows available at the moment'}
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

export default TVShows;
