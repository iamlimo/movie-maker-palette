import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Plus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";

interface TVShow {
  id: string;
  title: string;
  description?: string;
  genre_id?: string;
  release_date?: string;
  language?: string;
  rating?: string;
  price: number;
  thumbnail_url?: string;
  trailer_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface Season {
  id: string;
  tv_show_id: string;
  season_number: number;
  description?: string;
  price: number;
  rental_expiry_duration: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  duration?: number;
  price: number;
  rental_expiry_duration: number;
  status: 'pending' | 'approved' | 'rejected';
  video_url?: string;
  release_date?: string;
  created_at: string;
}

const ViewTVShow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [tvShow, setTvShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTVShow(id);
      fetchSeasons(id);
    }
  }, [id]);

  const fetchTVShow = async (showId: string) => {
    try {
      const { data, error } = await supabase
        .from('tv_shows')
        .select('*')
        .eq('id', showId)
        .single();

      if (error) throw error;
      setTvShow(data);
    } catch (error) {
      console.error('Error fetching TV show:', error);
      toast({
        title: "Error",
        description: "Failed to fetch TV show details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async (showId: string) => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('tv_show_id', showId)
        .order('season_number');

      if (error) throw error;
      setSeasons(data || []);
      
      // Fetch episodes for each season
      for (const season of data || []) {
        await fetchEpisodes(season.id);
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const fetchEpisodes = async (seasonId: string) => {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('season_id', seasonId)
        .order('episode_number');

      if (error) throw error;
      setEpisodes(prev => ({ ...prev, [seasonId]: data || [] }));
    } catch (error) {
      console.error('Error fetching episodes:', error);
    }
  };

  const handleDeleteEpisode = async (episodeId: string, seasonId: string) => {
    if (!confirm('Delete this episode? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('episodes')
        .delete()
        .eq('id', episodeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Episode deleted successfully",
      });

      // Refresh episodes for this season
      fetchEpisodes(seasonId);
    } catch (error) {
      console.error('Error deleting episode:', error);
      toast({
        title: "Error",
        description: "Failed to delete episode",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "bg-green-500 text-white",
      rejected: "bg-red-500 text-white",
      pending: "bg-yellow-500 text-white"
    };
    return (
      <Badge className={variants[status as keyof typeof variants] || "bg-gray-500 text-white"}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TV show...</p>
        </div>
      </div>
    );
  }

  if (!tvShow) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">TV Show Not Found</h1>
          <Button onClick={() => navigate('/admin/tv-shows')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to TV Shows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/tv-shows')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to TV Shows
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tvShow.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(tvShow.status)}
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{seasons.length} seasons</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate(`/admin/tv-shows/edit/${tvShow.id}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Show
          </Button>
          <Button 
            onClick={() => navigate(`/admin/tv-shows/${tvShow.id}/add-season`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Season
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Show Details */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-6">
                {tvShow.thumbnail_url && (
                  <img
                    src={tvShow.thumbnail_url}
                    alt={tvShow.title}
                    className="w-48 h-72 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Description</h2>
                    <p className="text-muted-foreground">
                      {tvShow.description || 'No description available'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Language</p>
                      <p className="text-muted-foreground">
                        {tvShow.language || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Rating</p>
                      <p className="text-muted-foreground">
                        {tvShow.rating || 'Not rated'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Release Date</p>
                      <p className="text-muted-foreground">
                        {tvShow.release_date 
                          ? new Date(tvShow.release_date).toLocaleDateString()
                          : 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Base Price</p>
                      <div>
                        <p className="font-semibold">{formatNaira(tvShow.price)}</p>
                        <p className="text-xs text-muted-foreground">{tvShow.price} kobo</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seasons & Episodes */}
          {seasons.map((season) => (
            <Card key={season.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>Season {season.season_number}</CardTitle>
                    {getStatusBadge(season.status)}
                    <span className="text-sm text-muted-foreground">{formatNaira(season.price)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/admin/tv-shows/${tvShow.id}/seasons/${season.id}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Season
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => navigate(`/admin/tv-shows/${tvShow.id}/seasons/${season.id}/add-episode`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Episode
                    </Button>
                  </div>
                </div>
                {season.description && (
                  <p className="text-muted-foreground">{season.description}</p>
                )}
              </CardHeader>
              <CardContent>
                {episodes[season.id] && episodes[season.id].length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Episode</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {episodes[season.id].map((episode) => (
                        <TableRow key={episode.id}>
                          <TableCell>{episode.episode_number}</TableCell>
                          <TableCell>{episode.title}</TableCell>
                          <TableCell>
                            {episode.duration ? `${episode.duration} min` : 'N/A'}
                          </TableCell>
                          <TableCell>{getStatusBadge(episode.status)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{formatNaira(episode.price)}</div>
                              <div className="text-xs text-muted-foreground">{episode.price} kobo</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {episode.video_url && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  title="Preview Episode"
                                  onClick={() => window.open(`/tvshow/${tvShow.id}?episode=${episode.id}`, '_blank')}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="ghost"
                                title="Edit Episode"
                                onClick={() => navigate(`/admin/tv-shows/${tvShow.id}/seasons/${season.id}/episodes/${episode.id}/edit`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                title="Delete Episode"
                                onClick={() => handleDeleteEpisode(episode.id, season.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No episodes yet</p>
                    <Button 
                      onClick={() => navigate(`/admin/tv-shows/${tvShow.id}/seasons/${season.id}/add-episode`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Episode
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {seasons.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground mb-4">No seasons yet</p>
                <Button 
                  onClick={() => navigate(`/admin/tv-shows/${tvShow.id}/add-season`)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Season
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Total Seasons</p>
                <p className="text-2xl font-bold">{seasons.length}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">Total Episodes</p>
                <p className="text-2xl font-bold">
                  {Object.values(episodes).reduce((total, eps) => total + eps.length, 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Media Files */}
          {(tvShow.thumbnail_url || tvShow.trailer_url) && (
            <Card>
              <CardHeader>
                <CardTitle>Media Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tvShow.trailer_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Trailer</span>
                    <Button size="sm" variant="outline">
                      <Play className="h-4 w-4 mr-2" />
                      Watch
                    </Button>
                  </div>
                )}
                {tvShow.thumbnail_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Poster</span>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-muted-foreground text-sm">
                  {new Date(tvShow.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-muted-foreground text-sm">
                  {new Date(tvShow.updated_at).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ViewTVShow;