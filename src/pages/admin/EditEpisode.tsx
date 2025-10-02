import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Film, Image, CheckCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NairaInput from "@/components/admin/NairaInput";
import ChunkedUpload from "@/components/admin/ChunkedUpload";
import BackblazeUrlInput from "@/components/admin/BackblazeUrlInput";

interface Season {
  id: string;
  season_number: number;
  tv_show_id: string;
  tv_show?: {
    title: string;
  };
}

interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description: string;
  duration: number;
  price: number;
  rental_expiry_duration: number;
  video_url: string;
  thumbnail_url: string;
  trailer_url: string;
  status: 'pending' | 'approved' | 'rejected';
  release_date: string;
}

interface FormData {
  episode_number: number;
  title: string;
  description: string;
  duration: number;
  price: number;
  rental_expiry_duration: number;
  status: 'pending' | 'approved' | 'rejected';
  release_date: string;
}

const EditEpisode = () => {
  const { showId, seasonId, episodeId } = useParams<{ showId: string; seasonId: string; episodeId: string }>();
  const [season, setSeason] = useState<Season | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [formData, setFormData] = useState<FormData>({
    episode_number: 1,
    title: "",
    description: "",
    duration: 0,
    price: 0,
    rental_expiry_duration: 48,
    status: 'pending',
    release_date: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [trailerUrl, setTrailerUrl] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (seasonId && episodeId) {
      fetchData();
    }
  }, [seasonId, episodeId]);

  const fetchData = async () => {
    if (!seasonId || !episodeId) return;

    try {
      // Fetch season with TV show info
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select(`
          *,
          tv_show:tv_shows(title, price)
        `)
        .eq('id', seasonId)
        .single();

      if (seasonError) throw seasonError;
      setSeason(seasonData);

      // Fetch episode
      const { data: episodeData, error: episodeError } = await supabase
        .from('episodes')
        .select('*')
        .eq('id', episodeId)
        .single();

      if (episodeError) throw episodeError;
      setEpisode(episodeData);

      // Populate form with existing data
      setFormData({
        episode_number: episodeData.episode_number,
        title: episodeData.title,
        description: episodeData.description || "",
        duration: episodeData.duration || 0,
        price: episodeData.price || 0,
        rental_expiry_duration: episodeData.rental_expiry_duration || 48,
        status: episodeData.status,
        release_date: episodeData.release_date || ""
      });

      setVideoUrl(episodeData.video_url || "");
      setThumbnailUrl(episodeData.thumbnail_url || "");
      setTrailerUrl(episodeData.trailer_url || "");
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch episode details",
        variant: "destructive",
      });
      navigate('/admin/tv-shows');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!episodeId || !seasonId) {
      toast({
        title: "Error",
        description: "Episode information is missing",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Error", 
        description: "Please enter an episode title",
        variant: "destructive",
      });
      return;
    }

    if (!videoUrl) {
      toast({
        title: "Error",
        description: "Video URL is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update episode data
      const { error } = await supabase
        .from('episodes')
        .update({
          episode_number: formData.episode_number,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          duration: formData.duration || null,
          price: formData.price || 0,
          rental_expiry_duration: formData.rental_expiry_duration || 48,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl || null,
          trailer_url: trailerUrl || null,
          status: formData.status,
          release_date: formData.release_date || null,
          published_at: formData.status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', episodeId);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Episode ${formData.episode_number} updated successfully!`,
      });

      // Navigate back to TV show view
      navigate(`/admin/tv-shows/view/${showId}`);

    } catch (error) {
      console.error('Error updating episode:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update episode",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (!season || !episode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Episode not found</p>
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/admin/tv-shows/view/${showId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TV Show
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Episode</h1>
            <p className="text-muted-foreground">
              Season {season.season_number} - {season.tv_show?.title}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Episode Information */}
          <Card>
            <CardHeader>
              <CardTitle>Episode Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="episode_number">Episode Number *</Label>
                  <Input
                    id="episode_number"
                    type="number"
                    min={1}
                    value={formData.episode_number}
                    onChange={(e) => handleInputChange('episode_number', parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={0}
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                    placeholder="e.g., 45"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="title">Episode Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                  placeholder="Enter episode title"
                />
              </div>

              <div>
                <Label htmlFor="description">Episode Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  placeholder="Brief description of this episode..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="release_date">Release Date</Label>
                  <Input
                    id="release_date"
                    type="date"
                    value={formData.release_date}
                    onChange={(e) => handleInputChange('release_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rental_expiry">Rental Duration</Label>
                  <Select 
                    value={formData.rental_expiry_duration.toString()} 
                    onValueChange={(value) => handleInputChange('rental_expiry_duration', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours (default)</SelectItem>
                      <SelectItem value="72">72 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <NairaInput
                value={formData.price}
                onChange={(value) => handleInputChange('price', value)}
                label="Episode Price"
                placeholder="0.00"
              />
            </CardContent>
          </Card>

          {/* Media Files */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5" />
                Media Files
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Update video content and thumbnail for your episode
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Backblaze Video URL Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Episode Video (Backblaze URL) *
                  </Label>
                  {videoUrl && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      URL Set
                    </Badge>
                  )}
                </div>
                <BackblazeUrlInput
                  value={videoUrl}
                  onChange={setVideoUrl}
                  label=""
                  required={true}
                />
              </div>

              {/* Thumbnail Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Episode Thumbnail
                  </Label>
                  {thumbnailUrl && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </div>
                <ChunkedUpload
                  onUploadComplete={(url) => setThumbnailUrl(url)}
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  maxSize={5}
                  label="Thumbnail Image"
                  description="Supported formats: JPG, PNG, WebP • Recommended: 1920x1080 • Max size: 5MB"
                  fileType="thumbnail"
                  episodeUpload={true}
                  currentUrl={thumbnailUrl}
                />
                {thumbnailUrl && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-medium text-muted-foreground">Current Thumbnail</Label>
                    <div className="mt-2 flex gap-4">
                      <img 
                        src={thumbnailUrl} 
                        alt="Episode thumbnail" 
                        className="w-32 h-20 object-cover rounded-md border shadow-sm" 
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">Thumbnail set</p>
                        <p className="text-xs text-muted-foreground">
                          Upload a new file to replace this thumbnail
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Trailer Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Episode Trailer (Optional)
                  </Label>
                  {trailerUrl && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Set
                    </Badge>
                  )}
                </div>
                <BackblazeUrlInput
                  value={trailerUrl || ''}
                  onChange={setTrailerUrl}
                  label="Episode Trailer URL (Backblaze B2)"
                  required={false}
                />
                {trailerUrl && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-medium text-muted-foreground">Current Trailer</Label>
                    <div className="mt-2 flex gap-4">
                      <div className="w-32 h-20 bg-primary/10 rounded-md border shadow-sm flex items-center justify-center">
                        <PlayCircle className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">Trailer URL set</p>
                        <p className="text-xs text-muted-foreground break-all">
                          {trailerUrl}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Publishing Options */}
          <Card>
            <CardHeader>
              <CardTitle>Publishing Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="publish_now">Published Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Control whether this episode is visible to users
                  </p>
                </div>
                <Switch
                  id="publish_now"
                  checked={formData.status === 'approved'}
                  onCheckedChange={(checked) => 
                    handleInputChange('status', checked ? 'approved' : 'pending')
                  }
                />
              </div>

              {formData.status === 'pending' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    This episode is currently unpublished and won't be visible to users.
                  </p>
                </div>
              )}

              {formData.status === 'approved' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    This episode is published and visible to users.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate(`/admin/tv-shows/view/${showId}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating Episode...' : 'Update Episode'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEpisode;
