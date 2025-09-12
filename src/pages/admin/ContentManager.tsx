import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Film, Tv, Search, Filter, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnifiedContentManager, ContentType } from '@/hooks/useContentManager';
import { UnifiedContentUploader } from '@/components/admin/UnifiedContentUploader';

const ContentManager = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { allContent, movies, tvShows, loading } = useUnifiedContentManager(false);

  // Filter content based on search and status
  const filteredContent = allContent.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const ContentCard = ({ item }: { item: any }) => (
    <Card className="hover:shadow-lg transition-all duration-300 border-border bg-card">
      <div className="aspect-video relative overflow-hidden rounded-t-lg">
        {item.thumbnail_url ? (
          <img 
            src={item.thumbnail_url} 
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            {item.content_type === 'movie' ? 
              <Film className="h-12 w-12 text-muted-foreground" /> :
              <Tv className="h-12 w-12 text-muted-foreground" />
            }
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            item.status === 'approved' ? 'bg-green-500/20 text-green-700' :
            item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700' :
            'bg-red-500/20 text-red-700'
          }`}>
            {item.status}
          </span>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-foreground line-clamp-1">{item.title}</h3>
          <span className="text-xs text-muted-foreground ml-2">
            {item.content_type === 'movie' ? 'Movie' : 'TV Show'}
          </span>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {item.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">${item.price}</span>
            {item.genre?.name && (
              <span className="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                {item.genre.name}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/admin/${item.content_type === 'movie' ? 'movies' : 'tv-shows'}/${item.id}`)}
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ContentList = ({ item }: { item: any }) => (
    <Card className="mb-4 border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-12 rounded-lg overflow-hidden flex-shrink-0">
            {item.thumbnail_url ? (
              <img 
                src={item.thumbnail_url} 
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                {item.content_type === 'movie' ? 
                  <Film className="h-4 w-4 text-muted-foreground" /> :
                  <Tv className="h-4 w-4 text-muted-foreground" />
                }
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <span className="text-xs text-muted-foreground">
                {item.content_type === 'movie' ? 'Movie' : 'TV Show'}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.status === 'approved' ? 'bg-green-500/20 text-green-700' :
                item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700' :
                'bg-red-500/20 text-red-700'
              }`}>
                {item.status}
              </span>
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-medium text-primary">${item.price}</div>
              {item.genre?.name && (
                <div className="text-xs text-muted-foreground">{item.genre.name}</div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/admin/${item.content_type === 'movie' ? 'movies' : 'tv-shows'}/${item.id}`)}
            >
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Content Manager</h1>
          <p className="text-muted-foreground">Manage all movies and TV shows in one place</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/admin/add-movie')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Movie
          </Button>
          <Button onClick={() => navigate('/admin/add-tv-show')}>
            <Plus className="h-4 w-4 mr-2" />
            Add TV Show
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6 border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-lg">
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
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Content ({allContent.length})</TabsTrigger>
          <TabsTrigger value="movies">Movies ({movies.length})</TabsTrigger>
          <TabsTrigger value="tv-shows">TV Shows ({tvShows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading content...</div>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">No content found</div>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate('/admin/add-movie')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Movie
                </Button>
                <Button onClick={() => navigate('/admin/add-tv-show')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add TV Show
                </Button>
              </div>
            </div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
            }>
              {filteredContent.map((item) => (
                <div key={item.id}>
                  {viewMode === 'grid' ? <ContentCard item={item} /> : <ContentList item={item} />}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movies" className="mt-6">
          {/* Similar content display for movies only */}
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
          }>
            {movies.filter(movie => {
              const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = statusFilter === 'all' || movie.status === statusFilter;
              return matchesSearch && matchesStatus;
            }).map((item) => (
              <div key={item.id}>
                {viewMode === 'grid' ? <ContentCard item={item} /> : <ContentList item={item} />}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tv-shows" className="mt-6">
          {/* Similar content display for TV shows only */}
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
          }>
            {tvShows.filter(show => {
              const matchesSearch = show.title.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = statusFilter === 'all' || show.status === statusFilter;
              return matchesSearch && matchesStatus;
            }).map((item) => (
              <div key={item.id}>
                {viewMode === 'grid' ? <ContentCard item={item} /> : <ContentList item={item} />}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentManager;