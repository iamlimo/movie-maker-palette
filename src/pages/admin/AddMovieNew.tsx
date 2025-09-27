import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { OptimizedContentUploader } from '@/components/admin/OptimizedContentUploader';
import { useOptimizedMovieUpload, type MovieFormData, type MovieCastAssignment } from '@/hooks/useOptimizedMovieUpload';
import CastCrewManager from '@/components/admin/CastCrewManager';
import NairaInput from '@/components/admin/NairaInput';

interface Genre {
  id: string;
  name: string;
}

interface CastCrew {
  id: string;
  name: string;
  role: string;
  photo_url?: string;
}

const AddMovieNew = () => {
  const [formData, setFormData] = useState<MovieFormData>({
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
  const [selectedCastCrew, setSelectedCastCrew] = useState<CastCrew[]>([]);
  const [castAssignments, setCastAssignments] = useState<MovieCastAssignment[]>([]);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    stagedFiles,
    uploadProgress,
    isSubmitting,
    isUploading,
    stageFile,
    removeFile,
    createMovie,
    retryFailedUploads,
    getFileByType,
    getProgressByType,
    clearAllFiles
  } = useOptimizedMovieUpload();

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

  const handleInputChange = (field: keyof MovieFormData, value: string) => {
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

  // Use the validation from the optimized hook
  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.price || parseFloat(formData.price) <= 0) errors.push("Valid price is required");
    if (!formData.description?.trim()) errors.push("Description is required");
    if (!formData.genre_id) errors.push("Genre is required");
    
    // Check if at least one media file is staged
    const hasVideo = getFileByType('video');
    const hasThumbnail = getFileByType('thumbnail');
    
    if (!hasVideo) errors.push("Video file is required");
    if (!hasThumbnail) errors.push("Thumbnail is required");
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    try {
      // Use the optimized movie creation hook
      const movie = await createMovie(formData, castAssignments);
      
      console.log('[AddMovie] Movie created successfully:', movie.id);
      
      // Navigate to movies list
      navigate('/admin/movies');
    } catch (error) {
      // Error handling is already done in the hook
      console.error('[AddMovie] Submit failed:', error);
    }
  };

  const handleRetryFailedUploads = async () => {
    try {
      await retryFailedUploads();
    } catch (error) {
      console.error('[AddMovie] Retry failed:', error);
    }
  };

  const isFormValid = () => {
    const errors = validateForm();
    return errors.length === 0;
  };

  const getOverallProgress = () => {
    if (uploadProgress.length === 0) return 0;
    const totalProgress = uploadProgress.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(totalProgress / uploadProgress.length);
  };

  const hasFailedUploads = uploadProgress.some(p => p.status === 'error');

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
                {!isFormValid() && (
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
                  <Label htmlFor="genre" className="text-foreground">Genre *</Label>
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
                <Label htmlFor="description" className="text-foreground">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter movie description..."
                  rows={4}
                  className="bg-input border-border text-foreground resize-none"
                  required
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
                  <NairaInput
                    label="Price ₦ *"
                    value={parseFloat(formData.price) || 0}
                    onChange={(value) => handleInputChange('price', value.toString())}
                    placeholder="0.00"
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
          <OptimizedContentUploader
            stagedFiles={stagedFiles}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onFileStaged={stageFile}
            onFileRemoved={removeFile}
            onRetryFailedUploads={retryFailedUploads}
            getFileByType={getFileByType}
            getProgressByType={getProgressByType}
          />

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

          {/* Submit Section */}
          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/movies')}
              disabled={isSubmitting || isUploading}
              className="px-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid() || isSubmitting || isUploading}
              className="px-8 gradient-accent text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Creating Movie...
                </>
              ) : isUploading ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Uploading Files...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Movie
                </>
              )}
            </Button>
          </div>

          {/* Validation Summary */}
          {!isFormValid() && (
            <Card className="p-4 bg-destructive/5 border-destructive/20">
              <div className="flex items-start gap-3">
                <Save className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-destructive mb-2">Please complete the following:</h4>
                  <ul className="text-sm text-destructive space-y-1">
                    {validateForm().map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddMovieNew;