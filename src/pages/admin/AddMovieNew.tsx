import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MediaUploadManager } from '@/components/admin/MediaUploadManager';
import CastCrewManager from '@/components/admin/CastCrewManager';

interface Genre {
  id: string;
  name: string;
}

interface FormData {
  title: string;
  description: string;
  genre_id: string;
  release_date: string;
  duration: string;
  language: string;
  rating: string;
  price: string;
  rental_expiry_duration: string;
}

interface CastCrew {
  id: string;
  name: string;
  role: string;
  photo_url?: string;
}

interface MovieCastAssignment {
  cast_crew_id: string;
  role_type: 'actor' | 'director' | 'producer' | 'writer';
  character_name?: string;
  credit_order: number;
}

const AddMovieNew = () => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    genre_id: '',
    release_date: '',
    duration: '',
    language: '',
    rating: '',
    price: '',
    rental_expiry_duration: '48'
  });
  
  const [genres, setGenres] = useState<Genre[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCastCrew, setSelectedCastCrew] = useState<CastCrew[]>([]);
  const [castAssignments, setCastAssignments] = useState<MovieCastAssignment[]>([]);
  
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
      toast({
        title: "Error",
        description: "Failed to fetch genres",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCastCrewSelection = (castCrew: CastCrew[]) => {
    setSelectedCastCrew(castCrew);
    
    // Initialize assignments for new cast/crew members
    const newAssignments = castCrew.map(person => {
      const existing = castAssignments.find(a => a.cast_crew_id === person.id);
      return existing || {
        cast_crew_id: person.id,
        role_type: 'actor' as const,
        character_name: '',
        credit_order: castAssignments.length + 1
      };
    });
    
    setCastAssignments(newAssignments);
  };

  const updateCastAssignment = (castCrewId: string, updates: Partial<MovieCastAssignment>) => {
    setCastAssignments(prev => 
      prev.map(assignment => 
        assignment.cast_crew_id === castCrewId 
          ? { ...assignment, ...updates }
          : assignment
      )
    );
  };

  const saveCastAssignments = async (movieId: string) => {
    if (castAssignments.length === 0) return;

    try {
      const assignmentsToInsert = castAssignments.map(assignment => ({
        movie_id: movieId,
        cast_crew_id: assignment.cast_crew_id,
        role_type: assignment.role_type,
        character_name: assignment.character_name || null,
        credit_order: assignment.credit_order
      }));

      const { error } = await supabase
        .from('movie_cast')
        .insert(assignmentsToInsert);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving cast assignments:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.price) {
      toast({
        title: "Validation Error",
        description: "Title and price are required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }

      // Prepare movie data
      const movieData = {
        title: formData.title,
        description: formData.description || null,
        genre_id: formData.genre_id || null,
        release_date: formData.release_date || null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        language: formData.language || null,
        rating: formData.rating || null,
        price: parseFloat(formData.price),
        thumbnail_url: thumbnailUrl || null,
        video_url: videoUrl || null,
        status: 'approved' as const,
        rental_expiry_duration: parseInt(formData.rental_expiry_duration),
        uploaded_by: user.id
      };

      console.log('Inserting movie data:', movieData);

      // Insert movie
      const { data: movie, error: movieError } = await supabase
        .from('movies')
        .insert([movieData])
        .select()
        .single();

      if (movieError) throw movieError;

      console.log('Movie created successfully:', movie);

      // Save cast and crew assignments
      await saveCastAssignments(movie.id);

      toast({
        title: "Success",
        description: "Movie added successfully with cast and crew",
      });

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

  const isFormValid = formData.title && formData.price;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin/movies')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Movies
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add New Movie</h1>
            <p className="text-muted-foreground">Create a new movie entry with media and cast information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                Basic Information
                {!isFormValid && (
                  <Badge variant="destructive" className="text-xs">
                    Required fields missing
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title and Genre */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-foreground">
                    Movie Title *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter the movie title"
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="genre" className="text-foreground">Genre</Label>
                  <Select onValueChange={(value) => handleInputChange('genre_id', value)}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Select a genre" />
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

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter movie description..."
                  rows={4}
                  className="bg-input border-border text-foreground resize-none"
                />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="release_date" className="text-foreground">Release Date</Label>
                  <Input
                    id="release_date"
                    type="date"
                    value={formData.release_date}
                    onChange={(e) => handleInputChange('release_date', e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-foreground">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    placeholder="120"
                    className="bg-input border-border text-foreground"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-foreground">Language</Label>
                  <Input
                    id="language"
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    placeholder="English"
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </div>

              {/* Pricing and Rating */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rating" className="text-foreground">Rating</Label>
                  <Select onValueChange={(value) => handleInputChange('rating', value)}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="G">G - General Audiences</SelectItem>
                      <SelectItem value="PG">PG - Parental Guidance</SelectItem>
                      <SelectItem value="PG-13">PG-13 - Parents Strongly Cautioned</SelectItem>
                      <SelectItem value="R">R - Restricted</SelectItem>
                      <SelectItem value="NC-17">NC-17 - Adults Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-foreground">
                    Price ($) *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    placeholder="9.99"
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rental_expiry" className="text-foreground">Rental Duration</Label>
                  <Select 
                    value={formData.rental_expiry_duration}
                    onValueChange={(value) => handleInputChange('rental_expiry_duration', value)}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
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

          {/* Media Files */}
          <Card className="gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="text-foreground">Media Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <MediaUploadManager
                  onUploadComplete={(url, filePath) => setThumbnailUrl(filePath)}
                  accept="image/*"
                  maxSize={10 * 1024 * 1024} // 10MB
                  label="Movie Thumbnail"
                  description="Upload a thumbnail image for the movie"
                  fileType="thumbnail"
                  currentUrl={thumbnailUrl}
                />

                <MediaUploadManager
                  onUploadComplete={(url, filePath) => setVideoUrl(filePath)}
                  accept="video/*"
                  maxSize={1024 * 1024 * 1024} // 1GB
                  label="Movie Video"
                  description="Upload the main movie video file"
                  fileType="video"
                  currentUrl={videoUrl}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cast and Crew */}
          <Card className="gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="text-foreground">Cast & Crew</CardTitle>
            </CardHeader>
            <CardContent>
              <CastCrewManager
                mode="select"
                onSelectionChange={handleCastCrewSelection}
                selectedIds={selectedCastCrew.map(c => c.id)}
              />

              {selectedCastCrew.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-foreground">Configure Cast & Crew Roles</h4>
                  {selectedCastCrew.map((member) => {
                    const assignment = castAssignments.find(a => a.cast_crew_id === member.id);
                    if (!assignment) return null;

                    return (
                      <Card key={member.id} className="p-4 bg-muted">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                          <div className="flex-1">
                            <Label className="text-foreground">Role in Movie</Label>
                            <Select
                              value={assignment.role_type}
                              onValueChange={(value) => updateCastAssignment(member.id, { role_type: value as any })}
                            >
                              <SelectTrigger className="bg-input border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="actor">Actor</SelectItem>
                                <SelectItem value="director">Director</SelectItem>
                                <SelectItem value="producer">Producer</SelectItem>
                                <SelectItem value="writer">Writer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {assignment.role_type === 'actor' && (
                            <div className="flex-1">
                              <Label className="text-foreground">Character Name</Label>
                              <Input
                                value={assignment.character_name || ''}
                                onChange={(e) => updateCastAssignment(member.id, { character_name: e.target.value })}
                                placeholder="Character name"
                                className="bg-input border-border"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-between p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {!isFormValid && (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>Please fill in all required fields</span>
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/movies')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="gradient-accent text-primary-foreground"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Creating Movie...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Movie
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMovieNew;