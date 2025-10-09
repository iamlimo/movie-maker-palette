import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSections } from "@/hooks/useSections";
import { Checkbox } from "@/components/ui/checkbox";
import { UnifiedContentUploader } from "@/components/admin/UnifiedContentUploader";
import { useContentManager, ContentFormData } from "@/hooks/useContentManager";
import BackblazeUrlInput from "@/components/admin/BackblazeUrlInput";
import NairaInput from "@/components/admin/NairaInput";

interface Genre {
  id: string;
  name: string;
}

const AddMovie = () => {
  const [formData, setFormData] = useState<ContentFormData>({
    title: "",
    description: "",
    genre_id: "",
    release_date: "",
    duration: "",
    language: "",
    rating: "",
    price: "", // Will be converted to kobo by NairaInput
    rental_expiry_duration: "48"
  });
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sections } = useSections();
  const { createContent } = useContentManager('movie');

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
      toast({
        title: "Error",
        description: "Failed to fetch genres",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof ContentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    setSelectedSections(prev => 
      checked 
        ? [...prev, sectionId]
        : prev.filter(id => id !== sectionId)
    );
  };

  const handleMediaUpload = (field: keyof ContentFormData) => (url: string, filePath: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.price) {
      toast({
        title: "Error",
        description: "Title and price are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the movie using the unified content manager
      const createdMovie = await createContent(formData);

      if (!createdMovie) {
        throw new Error('Failed to create movie');
      }

      // Assign movie to selected sections
      if (selectedSections.length > 0) {
        const contentSectionData = selectedSections.map((sectionId, index) => ({
          content_id: createdMovie.id,
          content_type: 'movie',
          section_id: sectionId,
          display_order: index
        }));

        const { error: sectionsError } = await supabase.functions.invoke('content-sections', {
          method: 'POST',
          body: contentSectionData
        });

        if (sectionsError) {
          console.warn('Section assignment failed:', sectionsError);
          toast({
            title: "Warning",
            description: "Movie created but section assignment failed",
            variant: "destructive",
          });
        }
      }

      navigate('/admin/movies');
    } catch (error) {
      console.error('Error adding movie:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add movie",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/admin/movies')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Movies
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Movie</h1>
          <p className="text-muted-foreground">Upload a new movie to the platform</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter movie title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="genre">Genre</Label>
                <Select onValueChange={(value) => handleInputChange('genre_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map(genre => (
                      <SelectItem key={genre.id} value={genre.id}>
                        {genre.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter movie description"
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
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  placeholder="120"
                />
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={formData.language}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                  placeholder="English"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rating">Rating</Label>
                <Select onValueChange={(value) => handleInputChange('rating', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="G">G</SelectItem>
                    <SelectItem value="PG">PG</SelectItem>
                    <SelectItem value="PG-13">PG-13</SelectItem>
                    <SelectItem value="R">R</SelectItem>
                    <SelectItem value="NC-17">NC-17</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <NairaInput
                  value={parseFloat(formData.price) || 0}
                  onChange={(value) => handleInputChange('price', value.toString())}
                  label="Price *"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rental_expiry">Rental Expiry (hours)</Label>
                <Select 
                  value={formData.rental_expiry_duration}
                  onValueChange={(value) => handleInputChange('rental_expiry_duration', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours (default)</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Media Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>Media Uploads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Thumbnail Upload */}
            <UnifiedContentUploader
              mediaType="thumbnail"
              label="Thumbnail Image"
              description="Upload a thumbnail image for the movie (recommended: 400x600px)"
              onUploadComplete={handleMediaUpload('thumbnail_url')}
              required
            />

            {/* Landscape Poster Upload */}
            <UnifiedContentUploader
              mediaType="landscape_poster"
              label="Landscape Poster"
              description="Upload a landscape poster for featured content (recommended: 1920x1080px)"
              onUploadComplete={handleMediaUpload('landscape_poster_url')}
            />

            {/* Slider Cover Upload */}
            <UnifiedContentUploader
              mediaType="slider_cover"
              label="Slider Cover"
              description="Upload a cover image for hero sliders (recommended: 1600x900px)"
              onUploadComplete={handleMediaUpload('slider_cover_url')}
            />

            {/* Backblaze Video URL Input */}
            <BackblazeUrlInput
              value={formData.video_url || ''}
              onChange={(url) => handleInputChange('video_url', url)}
              label="Main Video (Backblaze URL)"
              required={false}
            />
            
            {/* Trailer */}
            <BackblazeUrlInput
              value={formData.trailer_url || ''}
              onChange={(url) => handleInputChange('trailer_url', url)}
              label="Trailer (Backblaze URL)"
              required={false}
            />
          </CardContent>
        </Card>

        {/* Section Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Section Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Assign to Sections (Optional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sections.map(section => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={section.id}
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={(checked) => 
                        handleSectionToggle(section.id, checked as boolean)
                      }
                    />
                    <Label htmlFor={section.id} className="text-sm font-medium">
                      {section.title}
                      {section.subtitle && (
                        <span className="text-muted-foreground ml-1">
                          - {section.subtitle}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
              {sections.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No sections available. Create sections in the admin dashboard first.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/movies')}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="min-w-32"
          >
            {isSubmitting ? 'Adding Movie...' : 'Add Movie'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddMovie;