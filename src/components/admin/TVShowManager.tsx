import React, { useState, useEffect } from 'react';
import { Plus, Upload, Play, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TVShow {
  id: string;
  title: string;
  description?: string;
  genres: string[];
  thumbnail_url?: string;
  trailer_url?: string;
  price: number;
  status: string;
}

interface Season {
  id: string;
  tv_show_id: string;
  season_number: number;
  description?: string;
  price: number;
}

interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description?: string;
  duration?: number;
  price: number;
  thumbnail_url?: string;
  video_url?: string;
}

export const TVShowManager: React.FC = () => {
  const { user } = useAuth();
  const [tvShows, setTVShows] = useState<TVShow[]>([]);
  const [seasons, setSeasons] = useState<Record<string, Season[]>>({});
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState<string | null>(null);
  const [showEpisodeForm, setShowEpisodeForm] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre_id: '',
    language: '',
    rating: '',
    price: 0
  });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [trailerFile, setTrailerFile] = useState<File | null>(null);

  const [seasonData, setSeasonData] = useState({
    season_number: 1,
    description: '',
    price: 0
  });

  const [episodeData, setEpisodeData] = useState({
    episode_number: 1,
    title: '',
    description: '',
    duration: 0,
    price: 0
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTVShows();
  }, []);

  const fetchTVShows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tv_shows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTVShows(data || []);
    } catch (error) {
      console.error('Error fetching TV shows:', error);
      toast.error('Failed to load TV shows');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async (tvShowId: string) => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('tv_show_id', tvShowId)
        .order('season_number');

      if (error) throw error;
      setSeasons(prev => ({ ...prev, [tvShowId]: data || [] }));
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

  const handleCreateTVShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posterFile) {
      toast.error('Poster image is required');
      return;
    }

    const submitData = new FormData();
    submitData.append('title', formData.title);
    submitData.append('description', formData.description);
    submitData.append('genres', JSON.stringify([]));
    submitData.append('genre_id', formData.genre_id);
    submitData.append('language', formData.language);
    submitData.append('rating', formData.rating);
    submitData.append('price', formData.price.toString());
    submitData.append('poster', posterFile);
    if (trailerFile) {
      submitData.append('trailer', trailerFile);
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-tv-show', {
        body: submitData
      });

      if (error) throw error;

      toast.success('TV show created successfully');
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        genre_id: '',
        language: '',
        rating: '',
        price: 0
      });
      setPosterFile(null);
      setTrailerFile(null);
      fetchTVShows();
    } catch (error) {
      console.error('Error creating TV show:', error);
      toast.error('Failed to create TV show');
    }
  };

  const handleCreateSeason = async (tvShowId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-season', {
        body: {
          tv_show_id: tvShowId,
          season_number: seasonData.season_number,
          description: seasonData.description,
          price: seasonData.price
        }
      });

      if (error) throw error;

      toast.success('Season created successfully');
      setShowSeasonForm(null);
      setSeasonData({
        season_number: 1,
        description: '',
        price: 0
      });
      fetchSeasons(tvShowId);
    } catch (error) {
      console.error('Error creating season:', error);
      toast.error('Failed to create season');
    }
  };

  const handleUploadEpisode = async (seasonId: string) => {
    if (!videoFile || !thumbnailFile) {
      toast.error('Video and thumbnail files are required');
      return;
    }

    const submitData = new FormData();
    submitData.append('season_id', seasonId);
    submitData.append('episode_number', episodeData.episode_number.toString());
    submitData.append('title', episodeData.title);
    submitData.append('description', episodeData.description);
    submitData.append('duration', episodeData.duration.toString());
    submitData.append('price', episodeData.price.toString());
    submitData.append('video', videoFile);
    submitData.append('thumbnail', thumbnailFile);

    try {
      const { data, error } = await supabase.functions.invoke('upload-episode', {
        body: submitData
      });

      if (error) throw error;

      toast.success('Episode uploaded successfully');
      setShowEpisodeForm(null);
      setEpisodeData({
        episode_number: 1,
        title: '',
        description: '',
        duration: 0,
        price: 0
      });
      setVideoFile(null);
      setThumbnailFile(null);
      fetchEpisodes(seasonId);
    } catch (error) {
      console.error('Error uploading episode:', error);
      toast.error('Failed to upload episode');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading TV shows...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">TV Show Manager</h1>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create TV Show
        </Button>
      </div>

      {/* Create TV Show Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New TV Show</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTVShow} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price (₦)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    value={formData.language}
                    onChange={(e) => setFormData({...formData, language: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="rating">Rating</Label>
                  <Input
                    id="rating"
                    value={formData.rating}
                    onChange={(e) => setFormData({...formData, rating: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="poster">Poster Image *</Label>
                  <Input
                    id="poster"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trailer">Trailer Video (Optional)</Label>
                  <Input
                    id="trailer"
                    type="file"
                    accept="video/*"
                    onChange={(e) => setTrailerFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create TV Show</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TV Shows List */}
      <div className="grid gap-6">
        {tvShows.map((show) => (
          <Card key={show.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {show.title}
                    <Badge variant={show.status === 'approved' ? 'default' : 'secondary'}>
                      {show.status}
                    </Badge>
                  </CardTitle>
                  <p className="text-muted-foreground">{show.description}</p>
                  <p className="text-sm font-medium">₦{show.price.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {show.trailer_url && (
                    <Button size="sm" variant="outline">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowSeasonForm(show.id);
                      fetchSeasons(show.id);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Season
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Season Form */}
              {showSeasonForm === show.id && (
                <div className="mb-4 p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Add New Season</h4>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <Input
                      placeholder="Season number"
                      type="number"
                      value={seasonData.season_number}
                      onChange={(e) => setSeasonData({...seasonData, season_number: parseInt(e.target.value)})}
                    />
                    <Input
                      placeholder="Price (₦)"
                      type="number"
                      value={seasonData.price}
                      onChange={(e) => setSeasonData({...seasonData, price: parseFloat(e.target.value)})}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => handleCreateSeason(show.id)}>
                        Create
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowSeasonForm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Season description"
                    value={seasonData.description}
                    onChange={(e) => setSeasonData({...seasonData, description: e.target.value})}
                    className="mb-2"
                  />
                </div>
              )}

              {/* Seasons */}
              {seasons[show.id]?.map((season) => (
                <div key={season.id} className="border rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Season {season.season_number}</h4>
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowEpisodeForm(season.id);
                        fetchEpisodes(season.id);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Add Episode
                    </Button>
                  </div>
                  
                  {/* Episode Form */}
                  {showEpisodeForm === season.id && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <h5 className="font-medium mb-2">Upload New Episode</h5>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Input
                          placeholder="Episode number"
                          type="number"
                          value={episodeData.episode_number}
                          onChange={(e) => setEpisodeData({...episodeData, episode_number: parseInt(e.target.value)})}
                        />
                        <Input
                          placeholder="Episode title"
                          value={episodeData.title}
                          onChange={(e) => setEpisodeData({...episodeData, title: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <Input
                          placeholder="Duration (minutes)"
                          type="number"
                          value={episodeData.duration}
                          onChange={(e) => setEpisodeData({...episodeData, duration: parseInt(e.target.value)})}
                        />
                        <Input
                          placeholder="Price (₦)"
                          type="number"
                          value={episodeData.price}
                          onChange={(e) => setEpisodeData({...episodeData, price: parseFloat(e.target.value)})}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleUploadEpisode(season.id)}>
                            Upload
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowEpisodeForm(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Episode description"
                        value={episodeData.description}
                        onChange={(e) => setEpisodeData({...episodeData, description: e.target.value})}
                        className="mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Video File *</Label>
                          <Input
                            type="file"
                            accept="video/*"
                            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                          />
                        </div>
                        <div>
                          <Label>Thumbnail *</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Episodes */}
                  <div className="space-y-2">
                    {episodes[season.id]?.map((episode) => (
                      <div key={episode.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">
                            Episode {episode.episode_number}: {episode.title}
                          </span>
                          {episode.duration && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({episode.duration} min)
                            </span>
                          )}
                          <span className="text-sm text-muted-foreground ml-2">
                            ₦{episode.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};