import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, X } from 'lucide-react';
import { useSections } from '@/hooks/useSections';
import BackblazeUrlInput from '@/components/admin/BackblazeUrlInput';
import TrailerPlayer from '@/components/TrailerPlayer';
import NairaInput from '@/components/admin/NairaInput';
import { DEFAULT_PRICES_NAIRA } from '@/lib/priceUtils';
import { UnifiedContentUploader } from '@/components/admin/UnifiedContentUploader';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface Genre {
  id: string;
  name: string;
}

interface TVShowData {
  title: string;
  description: string;
  language: string;
  rating: string;
  age_restriction: string;
  content_warnings: string[];
  viewer_discretion: string;
  cast_info: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected';
  release_date: string;
  trailer_url: string;
  thumbnail_url: string;
  landscape_poster_url: string;
  slider_cover_url: string;
  genres: string[];
  genre_id: string | null;
  director?: string;               // added
  production_company?: string;     // added
}

export default function EditTVShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sections, loading: sectionsLoading } = useSections();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<Genre[]>([]);
  const [formData, setFormData] = useState<TVShowData>({
    title: '',
    description: '',
    language: '',
    rating: '',
    age_restriction: '',
    content_warnings: [],
    viewer_discretion: '',
    cast_info: '',
    price: 0,
    status: 'pending',
    release_date: '',
    trailer_url: '',
    thumbnail_url: '',
    landscape_poster_url: '',
    slider_cover_url: '',
    genres: [],
    genre_id: null,
    director: '',                   // added
    production_company: ''          // added
  });

  useEffect(() => {
    fetchGenres();
    if (id) {
      fetchTVShow();
      fetchAssignedSections();
    }
  }, [id]);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableGenres(data || []);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  const fetchTVShow = async () => {
    try {
      const { data, error } = await supabase
        .from('tv_shows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || '',
        description: data.description || '',
        language: data.language || '',
        rating: data.rating || '',
        age_restriction: data.age_restriction?.toString() || '',
        content_warnings: data.content_warnings || [],
        viewer_discretion: data.viewer_discretion || '',
        cast_info: data.cast_info || '',
        price: data.price || 0,
        status: data.status || 'pending',
        release_date: data.release_date || '',
        trailer_url: data.trailer_url || '',
        thumbnail_url: data.thumbnail_url || '',
        landscape_poster_url: data.landscape_poster_url || '',
        slider_cover_url: data.slider_cover_url || '',
        genres: data.genres || [],
        genre_id: data.genre_id || null,
        director: data.director || '',                   // added
        production_company: data.production_company || ''// added
      });
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

  const fetchAssignedSections = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('content_sections')
        .select('section_id')
        .eq('content_id', id)
        .eq('content_type', 'tv_show');

      if (error) throw error;
      setAssignedSections((data || []).map(d => d.section_id));
    } catch (error) {
      console.error('Error fetching assigned sections:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tv_shows')
        .update({
          title: formData.title,
          description: formData.description,
          language: formData.language,
          rating: formData.rating,
          age_restriction: formData.age_restriction ? parseInt(formData.age_restriction) : null,
          content_warnings: formData.content_warnings.length > 0 ? formData.content_warnings : null,
          viewer_discretion: formData.viewer_discretion || null,
          cast_info: formData.cast_info || null,
          price: formData.price,
          status: formData.status,
          release_date: formData.release_date || null,
          trailer_url: formData.trailer_url || null,
          thumbnail_url: formData.thumbnail_url || null,
          landscape_poster_url: formData.landscape_poster_url || null,
          slider_cover_url: formData.slider_cover_url || null,
          genres: formData.genres,
          genre_id: formData.genre_id || null,
          director: formData.director || null,               // added
          production_company: formData.production_company || null, // added
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "TV show updated successfully",
      });

      navigate('/admin/tv-shows');
    } catch (error) {
      console.error('Error updating TV show:', error);
      toast({
        title: "Error",
        description: "Failed to update TV show",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof TVShowData, value: string | number | string[] | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSectionToggle = async (sectionId: string, checked: boolean) => {
    if (!id) return;

    try {
      if (checked) {
        const { error } = await supabase
          .from('content_sections')
          .insert({
            content_id: id,
            content_type: 'tv_show',
            section_id: sectionId,
            display_order: 0
          });

        if (error) throw error;
        setAssignedSections(prev => [...prev, sectionId]);
        
        toast({
          title: "Success",
          description: "Section assigned successfully",
        });
      } else {
        const { error } = await supabase
          .from('content_sections')
          .delete()
          .eq('content_id', id)
          .eq('section_id', sectionId)
          .eq('content_type', 'tv_show');

        if (error) throw error;
        setAssignedSections(prev => prev.filter(s => s !== sectionId));
        
        toast({
          title: "Success",
          description: "Section removed successfully",
        });
      }
    } catch (error) {
      console.error('Error toggling section:', error);
      toast({
        title: "Error",
        description: "Failed to update section assignment",
        variant: "destructive",
      });
    }
  };

  const isSectionAssigned = (sectionId: string) => {
    return assignedSections.includes(sectionId);
  };

  const handleWarningToggle = (warning: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      content_warnings: checked
        ? [...prev.content_warnings, warning]
        : prev.content_warnings.filter(w => w !== warning)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TV show details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/admin/tv-shows')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to TV Shows
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit TV Show</h1>
          <p className="text-muted-foreground">Update TV show details</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>TV Show Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => handleInputChange('language', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Yoruba">Yoruba</SelectItem>
                  <SelectItem value="Igbo">Igbo</SelectItem>
                  <SelectItem value="Hausa">Hausa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre">Primary Category/Genre</Label>
              <Select
                value={formData.genre_id || 'none'}
                onValueChange={(value) => handleInputChange('genre_id', value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableGenres.map((genre) => (
                    <SelectItem key={genre.id} value={genre.id}>
                      {genre.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This will be the main category displayed on the TV show card
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NairaInput
                label="Base Price"
                value={formData.price}
                onChange={(koboValue) => handleInputChange('price', koboValue)}
                defaultPriceHint={`Default: ₦${DEFAULT_PRICES_NAIRA.SEASON.toLocaleString()}`}
                placeholder="3000.00"
              />

              <div className="space-y-2">
                <Label htmlFor="release_date">Release Date</Label>
                <Input
                  id="release_date"
                  type="date"
                  value={formData.release_date}
                  onChange={(e) => handleInputChange('release_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Content Safety & Cast</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rating">Rating (Optional)</Label>
                  <Select
                    value={formData.rating}
                    onValueChange={(value) => handleInputChange('rating', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="G">G - General Audiences</SelectItem>
                      <SelectItem value="PG">PG - Parental Guidance</SelectItem>
                      <SelectItem value="16+">16+ - Ages 16 and Over</SelectItem>
                      <SelectItem value="18+">18+ - Adults Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="age_restriction">Age Restriction (Optional)</Label>
                  <Select
                    value={formData.age_restriction}
                    onValueChange={(value) => handleInputChange('age_restriction', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select age restriction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - All Ages</SelectItem>
                      <SelectItem value="13">13+</SelectItem>
                      <SelectItem value="16">16+</SelectItem>
                      <SelectItem value="18">18+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Content Warnings (Optional)</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['violence', 'sex', 'drugs', 'horror', 'language'].map(warning => (
                    <div key={warning} className="flex items-center space-x-2">
                      <Checkbox
                        id={`warning-${warning}`}
                        checked={formData.content_warnings?.includes(warning)}
                        onCheckedChange={(checked) => handleWarningToggle(warning, checked as boolean)}
                      />
                      <Label htmlFor={`warning-${warning}`} className="capitalize cursor-pointer text-sm">
                        {warning}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="viewer_discretion">Viewer Discretion Message (Optional)</Label>
                <Textarea
                  id="viewer_discretion"
                  value={formData.viewer_discretion}
                  onChange={(e) => handleInputChange('viewer_discretion', e.target.value)}
                  placeholder="Enter custom viewer discretion message"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cast_info">Cast Information (Optional)</Label>
                <Textarea
                  id="cast_info"
                  value={formData.cast_info}
                  onChange={(e) => handleInputChange('cast_info', e.target.value)}
                  placeholder="Enter cast information (e.g., 'Starring: John Doe, Jane Smith, ...')"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Note: For detailed cast management, use the dedicated cast/crew manager
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="director">Director (Optional)</Label>
                <Textarea
                  id="director"
                  value={formData.director ?? ''}
                  onChange={(e) => handleInputChange('director', e.target.value)}
                  placeholder="Enter director name(s)"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="production_company">Production Company (Optional)</Label>
                <Textarea
                  id="production_company"
                  value={formData.production_company ?? ''}
                  onChange={(e) => handleInputChange('production_company', e.target.value)}
                  placeholder="Enter production company name"
                  rows={2}
                />
              </div>
            </div>

            <Separator className="my-6" />

            <BackblazeUrlInput
              value={formData.trailer_url}
              onChange={(url) => handleInputChange('trailer_url', url)}
              label="Trailer Video URL"
              required={false}
            />
            
            {formData.trailer_url && (
              <div className="mt-4 p-4 border border-border rounded-lg bg-card">
                <Label className="mb-2 block">Current Trailer</Label>
                <div className="aspect-video rounded-lg overflow-hidden bg-secondary">
                  <TrailerPlayer 
                    trailerUrl={formData.trailer_url}
                    title={formData.title}
                    controls
                  />
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/tv-shows')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Media & Posters */}
      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Media & Posters</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload or update images for this TV show
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Portrait Thumbnail */}
          <div className="space-y-2">
            <Label>Portrait Poster (Thumbnail)</Label>
            <p className="text-xs text-muted-foreground">
              Recommended: 300x450px, vertical orientation
            </p>
            <UnifiedContentUploader
              mediaType="thumbnail"
              label="Portrait Poster"
              description="Upload vertical poster image"
              currentUrl={formData.thumbnail_url}
              onUploadComplete={(url) => handleInputChange('thumbnail_url', url)}
            />
            {formData.thumbnail_url && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Current Image:</Label>
                <img 
                  src={formData.thumbnail_url} 
                  alt="Thumbnail preview" 
                  className="mt-1 rounded-lg max-h-40 object-cover"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Landscape Poster */}
          <div className="space-y-2">
            <Label>Landscape Poster</Label>
            <p className="text-xs text-muted-foreground">
              Recommended: 1920x1080px, horizontal orientation
            </p>
            <UnifiedContentUploader
              mediaType="landscape_poster"
              label="Landscape Poster"
              description="Upload horizontal poster image"
              currentUrl={formData.landscape_poster_url}
              onUploadComplete={(url) => handleInputChange('landscape_poster_url', url)}
            />
            {formData.landscape_poster_url && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Current Image:</Label>
                <img 
                  src={formData.landscape_poster_url} 
                  alt="Landscape poster preview" 
                  className="mt-1 rounded-lg max-h-40 object-cover"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Banner & Poster Images */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Banner & Poster Images</h3>
            <p className="text-xs text-muted-foreground">
              Upload different image formats for various display contexts
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="slider_cover_url">Slider Cover/Banner (Landscape - 1920x1080)</Label>
              <BackblazeUrlInput
                value={formData.slider_cover_url}
                onChange={(url) => handleInputChange('slider_cover_url', url)}
                label=""
                required={false}
              />
              <p className="text-xs text-muted-foreground">
                This image will be used in the main hero slider
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="landscape_poster_url">Landscape Poster (16:9 format)</Label>
              <BackblazeUrlInput
                value={formData.landscape_poster_url}
                onChange={(url) => handleInputChange('landscape_poster_url', url)}
                label=""
                required={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">Thumbnail (Portrait - 2:3 format)</Label>
              <BackblazeUrlInput
                value={formData.thumbnail_url}
                onChange={(url) => handleInputChange('thumbnail_url', url)}
                label=""
                required={false}
              />
            </div>
          </div>

          <Separator />

          {/* Hero Banner/Slider Cover */}
          <div className="space-y-2">
            <Label>Hero Banner (Slider Cover)</Label>
            <p className="text-xs text-muted-foreground">
              Recommended: 2560x1440px, ultra-wide format
            </p>
            <UnifiedContentUploader
              mediaType="slider_cover"
              label="Hero Banner"
              description="Upload hero slider image"
              currentUrl={formData.slider_cover_url}
              onUploadComplete={(url) => handleInputChange('slider_cover_url', url)}
            />
            {formData.slider_cover_url && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Current Image:</Label>
                <img 
                  src={formData.slider_cover_url} 
                  alt="Slider cover preview" 
                  className="mt-1 rounded-lg max-h-40 object-cover"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags & Categories */}
      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Tags & Categories</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add tags to help users discover this TV show
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="genres">Genres/Tags</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Enter comma-separated tags (e.g., Drama, Action, Thriller)
            </p>
            <Input
              id="genres"
              value={formData.genres.join(', ')}
              onChange={(e) => {
                const tags = e.target.value
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(tag => tag.length > 0);
                handleInputChange('genres', tags);
              }}
              placeholder="Drama, Action, Thriller"
            />
            {/* Display current tags as badges */}
            {formData.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.genres.map((genre, index) => (
                  <Badge key={index} variant="secondary">
                    {genre}
                    <X 
                      className="h-3 w-3 ml-1 cursor-pointer" 
                      onClick={() => {
                        const newGenres = formData.genres.filter((_, i) => i !== index);
                        handleInputChange('genres', newGenres);
                      }}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section Assignment */}
      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Section Assignment</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose which sections this TV show should appear in on the homepage
          </p>
        </CardHeader>
        <CardContent>
          {sectionsLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Loading sections...</p>
            </div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections available</p>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`section-${section.id}`}
                    checked={isSectionAssigned(section.id)}
                    onCheckedChange={(checked) => 
                      handleSectionToggle(section.id, checked as boolean)
                    }
                  />
                  <Label 
                    htmlFor={`section-${section.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{section.title}</p>
                      {section.subtitle && (
                        <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}