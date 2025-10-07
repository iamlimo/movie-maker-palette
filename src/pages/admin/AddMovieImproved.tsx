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
import ChunkedUpload from "@/components/admin/ChunkedUpload";
import CastCrewManager from "@/components/admin/CastCrewManager";
import NairaInput from "@/components/admin/NairaInput";
import BackblazeUrlInput from "@/components/admin/BackblazeUrlInput";

interface Genre {
  id: string;
  name: string;
}

interface CastCrew {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo_url?: string;
  social_links: Record<string, string>;
}

interface MovieCastAssignment {
  cast_crew_id: string;
  role_type: string;
  character_name?: string;
  credit_order: number;
}

interface FormData {
  title: string;
  description: string;
  genre_id: string;
  release_date: string;
  duration: number;
  language: string;
  rating: string;
  price: number;
  rental_expiry_duration: number;
}

const AddMovieImproved = () => {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    genre_id: "",
    release_date: "",
    duration: 0,
    language: "",
    rating: "",
    price: 0,
    rental_expiry_duration: 48
  });

  const [genres, setGenres] = useState<Genre[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [trailerUrl, setTrailerUrl] = useState<string>("");
  const [selectedCastCrew, setSelectedCastCrew] = useState<CastCrew[]>([]);
  const [castAssignments, setCastAssignments] = useState<MovieCastAssignment[]>([]);
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

  const handleCastCrewSelection = (selected: CastCrew[]) => {
    setSelectedCastCrew(selected);
    
    const newAssignments = selected.map((member, index) => {
      const existing = castAssignments.find(a => a.cast_crew_id === member.id);
      return existing || {
        cast_crew_id: member.id,
        role_type: member.role === 'actor' ? 'main_cast' : member.role,
        character_name: member.role === 'actor' ? '' : undefined,
        credit_order: index + 1
      };
    });
    
    setCastAssignments(newAssignments);
  };

  const updateCastAssignment = (castCrewId: string, field: keyof MovieCastAssignment, value: string | number) => {
    setCastAssignments(prev => 
      prev.map(assignment => 
        assignment.cast_crew_id === castCrewId 
          ? { ...assignment, [field]: value }
          : assignment
      )
    );
  };

  const saveCastAssignments = async (movieId: string) => {
    if (castAssignments.length === 0) return;

    try {
      const { error } = await supabase
        .from('movie_cast')
        .insert(
          castAssignments.map(assignment => ({
            movie_id: movieId,
            ...assignment
          }))
        );

      if (error) throw error;
      console.log('Movie cast assignments saved successfully');
    } catch (error) {
      console.error('Error saving cast assignments:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[AddMovieImproved] Form submission started. Thumbnail URL:', thumbnailUrl, 'Video URL:', videoUrl);
    
    if (!thumbnailUrl) {
      console.error('[AddMovieImproved] No thumbnail URL provided');
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
      console.log('[AddMovieImproved] Starting movie creation process...');

      // Save movie data to database
      const { data, error } = await supabase
        .from('movies')
        .insert([
          {
            title: formData.title,
            description: formData.description || null,
            genre_id: formData.genre_id || null,
            release_date: formData.release_date || null,
            duration: formData.duration || null,
            language: formData.language || null,
            rating: formData.rating || null,
            price: formData.price || 0,
            thumbnail_url: thumbnailUrl,
            video_url: videoUrl || null,
            trailer_url: trailerUrl || null,
            rental_expiry_duration: formData.rental_expiry_duration || 48,
            status: 'approved'
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('[AddMovieImproved] Database error:', error);
        throw error;
      }

      console.log('[AddMovieImproved] Movie saved successfully:', data);

      // Save cast assignments
      if (castAssignments.length > 0) {
        await saveCastAssignments(data.id);
      }

      toast({
        title: "Success",
        description: "Movie created successfully!",
      });

      // Navigate back to movies list
      navigate('/admin/movies');

    } catch (error) {
      console.error('[AddMovieImproved] Error adding movie:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create movie",
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
            onClick={() => navigate('/admin/movies')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Movies
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add New Movie</h1>
            <p className="text-muted-foreground">Upload a new movie to the platform</p>
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
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre *</Label>
                  <Select 
                    value={formData.genre_id} 
                    onValueChange={(value) => handleInputChange('genre_id', value)}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <Label htmlFor="rental_expiry">Rental Expiry (hours)</Label>
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
                      <SelectItem value="720">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <NairaInput
                value={formData.price}
                onChange={(value) => handleInputChange('price', value)}
                label="Movie Price"
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
              <ChunkedUpload
                accept="image/*"
                onUploadComplete={(url, filePath) => {
                  console.log('[AddMovieImproved] Thumbnail upload completed:', { url, filePath });
                  setThumbnailUrl(url);
                }}
                label="Movie Thumbnail"
                description="Upload the movie poster/thumbnail"
                fileType="thumbnail"
                currentUrl={thumbnailUrl}
                maxSize={10}
              />

              <Separator />

              <BackblazeUrlInput
                value={videoUrl}
                onChange={setVideoUrl}
                label="Movie Video URL"
                required={false}
              />

              <Separator />

              <BackblazeUrlInput
                value={trailerUrl}
                onChange={setTrailerUrl}
                label="Movie Trailer URL (Optional)"
                required={false}
              />
            </CardContent>
          </Card>

          {/* Cast & Crew Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Cast & Crew</CardTitle>
            </CardHeader>
            <CardContent>
              <CastCrewManager
                mode="select"
                onSelectionChange={handleCastCrewSelection}
                selectedIds={selectedCastCrew.map(c => c.id)}
              />

              {selectedCastCrew.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold">Configure Cast & Crew Roles</h4>
                  {selectedCastCrew.map((member) => {
                    const assignment = castAssignments.find(a => a.cast_crew_id === member.id);
                    if (!assignment) return null;

                    return (
                      <Card key={member.id} className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                          <div className="flex-1">
                            <Label>Role in Movie</Label>
                            <Select
                              value={assignment.role_type}
                              onValueChange={(value) => updateCastAssignment(member.id, 'role_type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="main_cast">Main Cast</SelectItem>
                                <SelectItem value="supporting_cast">Supporting Cast</SelectItem>
                                <SelectItem value="director">Director</SelectItem>
                                <SelectItem value="producer">Producer</SelectItem>
                                <SelectItem value="writer">Writer</SelectItem>
                                <SelectItem value="cinematographer">Cinematographer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="composer">Composer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {assignment.role_type.includes('cast') && (
                            <div className="flex-1">
                              <Label>Character Name</Label>
                              <Input
                                value={assignment.character_name || ''}
                                onChange={(e) => updateCastAssignment(member.id, 'character_name', e.target.value)}
                                placeholder="Character name"
                              />
                            </div>
                          )}
                          <div className="w-20">
                            <Label>Order</Label>
                            <Input
                              type="number"
                              value={assignment.credit_order}
                              onChange={(e) => updateCastAssignment(member.id, 'credit_order', parseInt(e.target.value) || 1)}
                              min={1}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
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
              disabled={isSubmitting || !thumbnailUrl}
            >
              {isSubmitting ? 'Creating Movie...' : 'Create Movie'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMovieImproved;