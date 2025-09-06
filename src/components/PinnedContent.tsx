import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Pin, 
  PinOff, 
  Search, 
  Filter, 
  Heart,
  Play,
  Clock,
  Star,
  Grid,
  List,
  SortAsc,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PinnedItem {
  id: string;
  content_type: 'movie' | 'tv_show';
  content_id: string;
  title: string;
  thumbnail_url?: string;
  pinned_at: string;
  is_favorite: boolean;
  watch_progress?: number;
  category?: string;
}

export function PinnedContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'type'>('recent');
  const [filterBy, setFilterBy] = useState<'all' | 'movies' | 'tv_shows' | 'favorites'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (user) {
      fetchPinnedContent();
    }
  }, [user]);

  const fetchPinnedContent = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // This would require a pinned_content table in the database
      // For now, we'll simulate pinned content using favorites with additional metadata
      const { data: favorites, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Transform favorites into pinned items format
      const pinned = favorites?.map(fav => ({
        id: fav.id,
        content_type: fav.content_type as 'movie' | 'tv_show',
        content_id: fav.content_id,
        title: 'Content Title',
        thumbnail_url: undefined,
        pinned_at: fav.added_at,
        is_favorite: true,
        category: 'favorites'
      })) || [];

      setPinnedItems(pinned);
    } catch (error) {
      console.error('Error fetching pinned content:', error);
      toast({
        title: "Error",
        description: "Failed to load pinned content",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const unpinItem = async (itemId: string) => {
    try {
      // For now, we'll remove from favorites as a proxy for unpinning
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setPinnedItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: "Success",
        description: "Item unpinned successfully"
      });
    } catch (error) {
      console.error('Error unpinning item:', error);
      toast({
        title: "Error",
        description: "Failed to unpin item",
        variant: "destructive"
      });
    }
  };

  const filteredAndSortedItems = pinnedItems
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = 
        filterBy === 'all' ||
        (filterBy === 'movies' && item.content_type === 'movie') ||
        (filterBy === 'tv_shows' && item.content_type === 'tv_show') ||
        (filterBy === 'favorites' && item.is_favorite);
      
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'type':
          return a.content_type.localeCompare(b.content_type);
        case 'recent':
        default:
          return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
      }
    });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 bg-muted animate-pulse rounded w-32"></div>
          <div className="h-8 bg-muted animate-pulse rounded w-24"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My List</h2>
          <p className="text-muted-foreground">Your pinned favorites and watchlist</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid size={16} />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List size={16} />
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search your list..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content</SelectItem>
                <SelectItem value="movies">Movies</SelectItem>
                <SelectItem value="tv_shows">TV Shows</SelectItem>
                <SelectItem value="favorites">Favorites Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
                <SelectItem value="type">Content Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredAndSortedItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Pin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No pinned content yet</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterBy !== 'all' 
                ? "No items match your current filters" 
                : "Start pinning your favorite movies and shows to see them here"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
        )}>
          {filteredAndSortedItems.map((item) => (
            <Card key={item.id} className="group hover:shadow-lg transition-all duration-200">
              {viewMode === 'grid' ? (
                <div className="relative">
                  <div className="aspect-[3/4] bg-gradient-to-br from-primary/10 to-accent/10 rounded-t-lg flex items-center justify-center">
                    {item.thumbnail_url ? (
                      <img 
                        src={item.thumbnail_url} 
                        alt={item.title}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                    ) : (
                      <Play className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant={item.content_type === 'movie' ? 'default' : 'secondary'}>
                      {item.content_type === 'movie' ? 'Movie' : 'TV Show'}
                    </Badge>
                    {item.is_favorite && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                        <Heart size={12} className="mr-1" />
                        Fav
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate mb-2">{item.title}</h3>
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unpinItem(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <PinOff size={16} className="mr-1" />
                        Unpin
                      </Button>
                      <Button size="sm">
                        <Play size={16} className="mr-1" />
                        Watch
                      </Button>
                    </div>
                  </CardContent>
                </div>
              ) : (
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded flex items-center justify-center flex-shrink-0">
                      {item.thumbnail_url ? (
                        <img 
                          src={item.thumbnail_url} 
                          alt={item.title}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Play className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={item.content_type === 'movie' ? 'default' : 'secondary'} className="text-xs">
                          {item.content_type === 'movie' ? 'Movie' : 'TV Show'}
                        </Badge>
                        {item.is_favorite && (
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/20">
                            <Heart size={10} className="mr-1" />
                            Favorite
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Pinned {new Date(item.pinned_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unpinItem(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                      <Button size="sm">
                        <Play size={16} className="mr-1" />
                        Watch
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}