import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import NairaInput from "@/components/admin/NairaInput";
import { useSections } from "@/hooks/useSections";
import { Checkbox } from "@/components/ui/checkbox";
import BackblazeUrlInput from "@/components/admin/BackblazeUrlInput";
import { Separator } from "@/components/ui/separator";

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
  age_restriction: string;
  content_warnings: string[];
  viewer_discretion: string;
  cast_info: string;
  price: number;
  rental_expiry_duration: string;
  status: string;
  video_url: string;
  trailer_url: string;
  thumbnail_url: string;
  landscape_poster_url: string;
  slider_cover_url: string;
  selectedSections: string[];
  director?: string;
  production_company?: string;
}

const EditMovie = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    genre_id: "",
    release_date: "",
    duration: "",
    language: "",
    rating: "",
    age_restriction: "",
    content_warnings: [],
    viewer_discretion: "",
    cast_info: "",
    price: 0,
    rental_expiry_duration: "48",
    status: "pending",
    video_url: "",
    trailer_url: "",
    thumbnail_url: "",
    landscape_poster_url: "",
    slider_cover_url: "",
    selectedSections: [],
    director: "",
    production_company: ""
  });

  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { sections } = useSections();

  useEffect(() => {
    if (id) {
      fetchMovie(id);
    }
    fetchGenres();
  }, [id]);

  const fetchMovie = async (movieId: string) => {
    try {
      const { data, error } = await supabase
        .from("movies")
        .select("*")
        .eq("id", movieId)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || "",
        description: data.description || "",
        genre_id: data.genre_id || "",
        release_date: data.release_date || "",
        duration: data.duration?.toString() || "",
        language: data.language || "",
        rating: data.rating || "",
        age_restriction: data.age_restriction?.toString() || "",
        content_warnings: data.content_warnings || [],
        viewer_discretion: data.viewer_discretion || "",
        cast_info: data.cast_info || "",
        price: data.price || 0,
        rental_expiry_duration: data.rental_expiry_duration?.toString() || "48",
        status: data.status || "pending",
        video_url: data.video_url || "",
        trailer_url: data.trailer_url || "",
        thumbnail_url: data.thumbnail_url || "",
        landscape_poster_url: data.landscape_poster_url || "",
        slider_cover_url: data.slider_cover_url || "",
        selectedSections: [],
        director: data.director || "",
        production_company: data.production_company || ""
      });

      // Fetch current section assignments
      const { data: contentSections } = await supabase.functions.invoke(
        "content-sections",
        {
          method: "GET",
        }
      );

      if (contentSections) {
        const movieSections = contentSections
          .filter(
            (cs: any) =>
              cs.content_id === movieId && cs.content_type === "movie"
          )
          .map((cs: any) => cs.section_id);

        setFormData((prev) => ({
          ...prev,
          selectedSections: movieSections,
        }));
      }
    } catch (error) {
      console.error("Error fetching movie:", error);
      toast({
        title: "Error",
        description: "Failed to fetch movie details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from("genres")
        .select("*")
        .order("name");

      if (error) throw error;
      setGenres(data || []);
    } catch (error) {
      console.error("Error fetching genres:", error);
    }
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string | number | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      selectedSections: checked
        ? [...prev.selectedSections, sectionId]
        : prev.selectedSections.filter((id) => id !== sectionId),
    }));
  };

  const handleWarningToggle = (warning: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      content_warnings: checked
        ? [...prev.content_warnings, warning]
        : prev.content_warnings.filter((w) => w !== warning),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        genre_id: formData.genre_id,
        release_date: formData.release_date,
        duration: Number(formData.duration) || null,
        language: formData.language,
        rating: formData.rating,
        price: Number(formData.price) || 0,
        rental_expiry_duration: Number(formData.rental_expiry_duration) || 48,
        age_restriction: formData.age_restriction ? Number(formData.age_restriction) : null,
        content_warnings: formData.content_warnings || [],
        viewer_discretion: formData.viewer_discretion || null,
        cast_info: formData.cast_info || null,
        director: formData.director ?? null,
        production_company: formData.production_company ?? null,
        thumbnail_url: formData.thumbnail_url || null,
        landscape_poster_url: formData.landscape_poster_url || null,
        slider_cover_url: formData.slider_cover_url || null,
        video_url: formData.video_url || null,
        trailer_url: formData.trailer_url || null,
      };

      const { data, error } = await supabase
        .from('movies')
        .update(payload)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Update section assignments
      if (formData.selectedSections.length > 0) {
        // First, remove existing assignments
        await supabase.functions.invoke("content-sections", {
          method: "DELETE",
          body: { content_id: id, content_type: "movie" },
        });

        // Then add new assignments
        const contentSectionData = formData.selectedSections.map(
          (sectionId, index) => ({
            content_id: id,
            content_type: "movie",
            section_id: sectionId,
            display_order: index,
          })
        );

        await supabase.functions.invoke("content-sections", {
          method: "POST",
          body: contentSectionData,
        });
      }

      toast({
        title: "Success",
        description: "Movie updated successfully",
      });

      navigate(`/admin/movies/view/${id}`);
    } catch (error) {
      console.error("Error updating movie:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update movie",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading movie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/admin/movies/view/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Movie
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Movie</h1>
          <p className="text-muted-foreground">Update movie information</p>
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
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Enter movie title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="genre">Genre</Label>
                <Select
                  value={formData.genre_id}
                  onValueChange={(value) =>
                    handleInputChange("genre_id", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre" />
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
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
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
                  onChange={(e) =>
                    handleInputChange("release_date", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) =>
                    handleInputChange("duration", e.target.value)
                  }
                  placeholder="120"
                />
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={formData.language}
                  onChange={(e) =>
                    handleInputChange("language", e.target.value)
                  }
                  placeholder="English"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <NairaInput
                  value={formData.price}
                  onChange={(value) => handleInputChange("price", value)}
                  label="Price"
                  placeholder="1,000.00"
                  defaultPriceHint="Platform Default: ₦1,000"
                />
              </div>

              <div>
                <Label htmlFor="rental_expiry">Rental Expiry (hours)</Label>
                <Select
                  value={formData.rental_expiry_duration}
                  onValueChange={(value) =>
                    handleInputChange("rental_expiry_duration", value)
                  }
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

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
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
            </div>
          </CardContent>
        </Card>

        {/* Content Safety & Cast Information */}
        <Card>
          <CardHeader>
            <CardTitle>Content Safety & Cast Information</CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional fields to help viewers make informed decisions
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rating & Age Restriction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rating">Rating (Optional)</Label>
                <Select
                  value={formData.rating}
                  onValueChange={(value) => handleInputChange("rating", value)}
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

              <div>
                <Label htmlFor="age_restriction">
                  Age Restriction (Optional)
                </Label>
                <Select
                  value={formData.age_restriction}
                  onValueChange={(value) =>
                    handleInputChange("age_restriction", value)
                  }
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

            {/* Content Warnings */}
            <div>
              <Label>Content Warnings (Optional)</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
                {["violence", "sex", "drugs", "horror", "language"].map(
                  (warning) => (
                    <div key={warning} className="flex items-center space-x-2">
                      <Checkbox
                        id={`warning-${warning}`}
                        checked={formData.content_warnings?.includes(warning)}
                        onCheckedChange={(checked) =>
                          handleWarningToggle(warning, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`warning-${warning}`}
                        className="capitalize cursor-pointer text-sm"
                      >
                        {warning}
                      </Label>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Viewer Discretion */}
            <div>
              <Label htmlFor="viewer_discretion">
                Viewer Discretion Message (Optional)
              </Label>
              <Textarea
                id="viewer_discretion"
                value={formData.viewer_discretion}
                onChange={(e) =>
                  handleInputChange("viewer_discretion", e.target.value)
                }
                placeholder="Enter custom viewer discretion message (e.g., 'Contains graphic violence and strong language')"
                rows={3}
              />
            </div>

            {/* Cast Info */}
            <div>
              <Label htmlFor="cast_info">Cast Information (Optional)</Label>
              <Textarea
                id="cast_info"
                value={formData.cast_info || ""}
                onChange={(e) => handleInputChange("cast_info", e.target.value)}
                placeholder="Enter cast information (e.g., 'Starring: John Doe, Jane Smith, ...')"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Note: For detailed cast management, use the dedicated cast/crew
                manager
              </p>
            </div>

            {/* Director */}
            <div>
              <Label htmlFor="director">Director (Optional)</Label>
              <Textarea
                id="director"
                value={formData.director ?? ''}
                onChange={(e) => handleInputChange('director', e.target.value)}
                placeholder="Enter director name(s)"
                rows={2}
              />
            </div>

            {/* Production Company */}
            <div>
              <Label htmlFor="production_company">
                Production Company (Optional)
              </Label>
              <Textarea
                id="production_company"
                value={formData.production_company ?? ''}
                onChange={(e) => handleInputChange('production_company', e.target.value)}
                placeholder="Enter production company name"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Banner & Poster Images */}
        <Card>
          <CardHeader>
            <CardTitle>Banner & Poster Images</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload different image formats for various display contexts
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <BackblazeUrlInput
                value={formData.slider_cover_url}
                onChange={(value) => handleInputChange("slider_cover_url", value)}
                label="Slider Cover/Banner (Landscape - 1920x1080)"
                required={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This image will be used in the main hero slider
              </p>
            </div>

            <div>
              <BackblazeUrlInput
                value={formData.landscape_poster_url}
                onChange={(value) => handleInputChange("landscape_poster_url", value)}
                label="Landscape Poster (16:9 format)"
                required={false}
              />
            </div>

            <div>
              <BackblazeUrlInput
                value={formData.thumbnail_url}
                onChange={(value) => handleInputChange("thumbnail_url", value)}
                label="Thumbnail (Portrait - 2:3 format)"
                required={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* Media URLs */}
        <Card>
          <CardHeader>
            <CardTitle>Media URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <BackblazeUrlInput
              value={formData.video_url}
              onChange={(url) => handleInputChange("video_url", url)}
              label="Movie Video URL"
              required={false}
            />

            <Separator />

            <BackblazeUrlInput
              value={formData.trailer_url}
              onChange={(url) => handleInputChange("trailer_url", url)}
              label="Movie Trailer URL"
              required={false}
            />
          </CardContent>
        </Card>

        {/* Section Assignment */}
        {sections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Section Assignment</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose which sections this movie should appear in
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map((section) => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`section-${section.id}`}
                      checked={formData.selectedSections.includes(section.id)}
                      onCheckedChange={(checked) =>
                        handleSectionToggle(section.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`section-${section.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {section.title}
                      {section.subtitle && (
                        <span className="block text-xs text-muted-foreground">
                          {section.subtitle}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/admin/movies/view/${id}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditMovie;
