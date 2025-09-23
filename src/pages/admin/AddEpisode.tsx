import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Season {
  id: string;
  season_number: number;
  tv_show_id: string;
  tv_show?: {
    title: string;
  };
}

interface FormData {
  episode_number: number;
  title: string;
  description: string;
  duration: number;
  price: number;
  rental_expiry_duration: number;
  video_file: File | null;
  thumbnail_file: File | null;
  status: 'pending' | 'approved';
  release_date: string;
}

const AddEpisode = () => {
  const { showId, seasonId } = useParams<{ showId: string; seasonId: string }>();
  const [season, setSeason] = useState<Season | null>(null);
  const [formData, setFormData] = useState<FormData>({
    episode_number: 1,
    title: "",
    description: "",
    duration: 0,
    price: 0,
    rental_expiry_duration: 48,
    video_file: null,
    thumbnail_file: null,
    status: 'pending',
    release_date: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (seasonId) {
      fetchSeasonData();
      determineNextEpisodeNumber();
    }
  }, [seasonId]);

  const fetchSeasonData = async () => {
    if (!seasonId) return;

    try {
      const { data, error } = await supabase
        .from('seasons')
        .select(`
          *,
          tv_show:tv_shows(title, price)
        `)
        .eq('id', seasonId)
        .single();

      if (error) throw error;
      setSeason(data);
      
      // Set default price from season or TV show
      setFormData(prev => ({
        ...prev,
        price: data.price || data.tv_show?.price || 0
      }));
    } catch (error) {
      console.error('Error fetching season:', error);
      toast({
        title: "Error",
        description: "Failed to fetch season details",
        variant: "destructive",
      });
      navigate('/admin/tv-shows');
    }
  };

  const determineNextEpisodeNumber = async () => {
    if (!seasonId) return;

    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('episode_number')
        .eq('season_id', seasonId)
        .order('episode_number', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      const nextEpisodeNumber = data && data.length > 0 ? data[0].episode_number + 1 : 1;
      setFormData(prev => ({
        ...prev,
        episode_number: nextEpisodeNumber
      }));
    } catch (error) {
      console.error('Error determining episode number:', error);
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
    
    if (!seasonId || !season) {
      toast({
        title: "Error",
        description: "Season information is missing",
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
        description: "Please upload a video file",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save episode data to database
      const { data, error } = await supabase
        .from('episodes')
        .insert([
          {
            season_id: seasonId,
            episode_number: formData.episode_number,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            duration: formData.duration || null,
            price: formData.price || 0,
            rental_expiry_duration: formData.rental_expiry_duration || 48,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl || null,
            status: formData.status,
            release_date: formData.release_date || null,
            published_at: formData.status === 'approved' ? new Date().toISOString() : null
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Episode ${formData.episode_number} created successfully!`,
      });

      // Navigate back to TV shows list
      navigate('/admin/tv-shows');

    } catch (error) {
      console.error('Error adding episode:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create episode",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!season) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading season...</p>
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
            onClick={() => navigate('/admin/tv-shows')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TV Shows
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Episode</h1>
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
              <CardTitle>Media Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Video File *</Label>
                <ChunkedUpload
                  onUploadComplete={(url) => setVideoUrl(url)}
                  accept="video/*"
                  maxSize={500}
                  label="Upload Episode Video"
                  description="Upload the main video file for this episode"
                  fileType="video"
                  episodeUpload={true}
                />
                {videoUrl && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    ✓ Video uploaded successfully
                  </div>
                )}
              </div>

              <div>
                <Label>Episode Thumbnail</Label>
                <ChunkedUpload
                  onUploadComplete={(url) => setThumbnailUrl(url)}
                  accept="image/*"
                  maxSize={5}
                  label="Upload Thumbnail"
                  description="Upload a thumbnail image for this episode"
                  fileType="thumbnail"
                  episodeUpload={true}
                />
                {thumbnailUrl && (
                  <div className="mt-2">
                    <img src={thumbnailUrl} alt="Thumbnail preview" className="w-32 h-20 object-cover rounded" />
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
                  <Label htmlFor="publish_now">Publish Immediately</Label>
                  <p className="text-sm text-muted-foreground">
                    Make this episode available to users right away
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
                    This episode will be saved as a draft and won't be visible to users until published.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/admin/tv-shows')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !videoUrl}
            >
              {isSubmitting ? 'Creating Episode...' : 'Create Episode'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEpisode;