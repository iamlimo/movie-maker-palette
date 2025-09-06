import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MediaUploadManager } from "@/components/admin/MediaUploadManager";
import NairaInput from "@/components/admin/NairaInput";

interface Genre {
  id: string;
  name: string;
}

interface FormData {
  title: string;
  description: string;
  genre_id: string;
  release_date: string;
  language: string;
  rating: string;
  price: number;
}

const AddTVShow = () => {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    genre_id: "",
    release_date: "",
    language: "",
    rating: "",
    price: 0
  });

  const [genres, setGenres] = useState<Genre[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [trailerUrl, setTrailerUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');

      if (error) throw error;
      setGenres(data || []);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[AddTVShow] Form submission started. Thumbnail URL:', thumbnailUrl);
    
    if (!thumbnailUrl) {
      console.error('[AddTVShow] No thumbnail URL provided');
      toast({
        title: "Error",
        description: "Please upload a thumbnail",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title || !formData.genre_id) {
      toast({
        title: "Error", 
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Starting TV show creation process...');

      // Save TV show data to database
      const { data, error } = await supabase
        .from('tv_shows')
        .insert([
          {
            title: formData.title,
            description: formData.description || null,
            genre_id: formData.genre_id || null,
            release_date: formData.release_date || null,
            language: formData.language || null,
            rating: formData.rating || null,
            price: formData.price || 0,
            thumbnail_url: thumbnailUrl,
            trailer_url: trailerUrl || null,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('TV show saved successfully:', data);

      toast({
        title: "Success",
        description: "TV show created successfully! You can now add seasons.",
      });

      // Navigate to add season for this show
      navigate(`/admin/tv-shows/${data.id}/add-season`);

    } catch (error) {
      console.error('Error adding TV show:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create TV show",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <h1 className="text-3xl font-bold">Create New TV Show</h1>
            <p className="text-muted-foreground">Step 1: Basic TV show information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                    className={!formData.title ? "border-destructive/50" : ""}
                  />
                  {!formData.title && (
                    <p className="text-xs text-destructive mt-1">Title is required</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="genre">
                    Genre <span className="text-destructive">*</span>
                  </Label>
                  <Select 
                    value={formData.genre_id} 
                    onValueChange={(value) => handleInputChange('genre_id', value)}
                  >
                    <SelectTrigger className={!formData.genre_id ? "border-destructive/50" : ""}>
                      <SelectValue placeholder="Select a genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id}>
                          {genre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!formData.genre_id && (
                    <p className="text-xs text-destructive mt-1">Genre is required</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rating">Rating</Label>
                  <Select 
                    value={formData.rating} 
                    onValueChange={(value) => handleInputChange('rating', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="G">G - General Audience</SelectItem>
                      <SelectItem value="PG">PG - Parental Guidance</SelectItem>
                      <SelectItem value="PG-13">PG-13 - Parents Strongly Cautioned</SelectItem>
                      <SelectItem value="R">R - Restricted</SelectItem>
                      <SelectItem value="NC-17">NC-17 - Adults Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <NairaInput
                value={formData.price}
                onChange={(value) => handleInputChange('price', value)}
                label="Season Price (Base Price)"
                placeholder="0.00"
              />
            </CardContent>
          </Card>

          {/* Media Files */}
          <Card>
            <CardHeader>
              <CardTitle>Media Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <MediaUploadManager
                accept="image/*"
                onUploadComplete={(url, filePath) => {
                  console.log('[AddTVShow] Thumbnail upload completed:', { url, filePath });
                  setThumbnailUrl(filePath);
                }}
                label="TV Show Poster"
                description="Upload the main poster for the TV show"
                fileType="thumbnail"
                currentUrl={thumbnailUrl}
                maxSize={10 * 1024 * 1024} // 10MB
                required={true}
                autoUpload={true}
              />

              <Separator />

              <MediaUploadManager
                accept="video/*"
                onUploadComplete={(url, filePath) => {
                  console.log('[AddTVShow] Trailer upload completed:', { url, filePath });
                  setTrailerUrl(filePath);
                }}
                label="TV Show Trailer"
                description="Upload a trailer or preview video for the show (optional)"
                fileType="trailer"
                currentUrl={trailerUrl}
                maxSize={500 * 1024 * 1024} // 500MB limit for trailers
                required={false}
                autoUpload={true}
              />
            </CardContent>
          </Card>


          {/* Form Status */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">Form Status</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete required fields to proceed
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className={`flex items-center gap-2 ${formData.title ? 'text-green-600' : 'text-destructive'}`}>
                    <div className={`w-2 h-2 rounded-full ${formData.title ? 'bg-green-500' : 'bg-destructive'}`} />
                    Title
                  </div>
                  <div className={`flex items-center gap-2 ${formData.genre_id ? 'text-green-600' : 'text-destructive'}`}>
                    <div className={`w-2 h-2 rounded-full ${formData.genre_id ? 'bg-green-500' : 'bg-destructive'}`} />
                    Genre
                  </div>
                  <div className={`flex items-center gap-2 ${thumbnailUrl ? 'text-green-600' : 'text-destructive'}`}>
                    <div className={`w-2 h-2 rounded-full ${thumbnailUrl ? 'bg-green-500' : 'bg-destructive'}`} />
                    Poster
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
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
              disabled={isSubmitting || !thumbnailUrl || !formData.title || !formData.genre_id}
              className="min-w-[200px]"
            >
              {isSubmitting ? (
                'Creating TV Show...'
              ) : !thumbnailUrl ? (
                'Upload Poster Required'
              ) : !formData.title || !formData.genre_id ? (
                'Complete Required Fields'
              ) : (
                'Create TV Show & Add Seasons'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTVShow;