import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const AddMovie = () => {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    genre_id: "",
    release_date: "",
    duration: "",
    language: "",
    rating: "",
    price: "",
    rental_expiry_duration: "48"
  });
  const [genres, setGenres] = useState<Genre[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
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

  const uploadToB2 = async (file: File, fileName: string, retries = 3): Promise<string> => {
    console.log('Frontend Upload - Starting upload for:', fileName, 'Size:', file.size, 'Type:', file.type);
    
    // Validate file size on frontend (100MB limit)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      throw new Error(`File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`);
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    formData.append('bucketType', 'movies');

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Frontend Upload - Attempt ${attempt}/${retries}`);
        
        const { data, error } = await supabase.functions.invoke('b2-upload', {
          body: formData
        });

        if (error) {
          console.error('Frontend Upload - Supabase function error:', error);
          
          // If it's a timeout error and we have retries left, try again
          if (error.message?.includes('timeout') && attempt < retries) {
            console.log(`Frontend Upload - Retrying after timeout (attempt ${attempt}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            continue;
          }
          
          throw new Error(error.message || 'Upload failed');
        }

        if (!data?.success) {
          console.error('Frontend Upload - Upload unsuccessful:', data);
          throw new Error(data?.error || 'Upload failed');
        }

        console.log('Frontend Upload - Upload successful:', data.downloadUrl);
        return data.downloadUrl;
      } catch (error) {
        console.error(`Frontend Upload - Attempt ${attempt} failed:`, error);
        
        // If it's the last attempt or not a network error, throw immediately
        if (attempt === retries || !(error instanceof Error) || 
            (!error.message.includes('timeout') && !error.message.includes('network') && !error.message.includes('Failed to send'))) {
          throw error instanceof Error ? error : new Error('Upload failed: Unknown error');
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
    
    throw new Error('Upload failed after all retries');
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

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let thumbnailUrl = "";
      let videoUrl = "";

      // Upload thumbnail if provided
      if (thumbnailFile) {
        setUploadProgress(25);
        const thumbnailFileName = `thumbnails/${Date.now()}_${thumbnailFile.name}`;
        thumbnailUrl = await uploadToB2(thumbnailFile, thumbnailFileName);
      }

      // Upload video if provided
      if (videoFile) {
        setUploadProgress(50);
        const videoFileName = `videos/${Date.now()}_${videoFile.name}`;
        videoUrl = await uploadToB2(videoFile, videoFileName);
      }

      setUploadProgress(75);

      // Save to database
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
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { error } = await supabase
        .from('movies')
        .insert([movieData]);

      if (error) throw error;

      setUploadProgress(100);

      toast({
        title: "Success",
        description: "Movie added successfully",
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
      setIsUploading(false);
      setUploadProgress(0);
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
                <Label htmlFor="price">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="9.99"
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

        {/* File Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>File Uploads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Thumbnail Upload */}
            <div>
              <Label htmlFor="thumbnail">Thumbnail Image</Label>
              <div className="mt-2">
                <input
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  {thumbnailFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">{thumbnailFile.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setThumbnailFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Click to upload thumbnail image
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('thumbnail')?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video Upload */}
            <div>
              <Label htmlFor="video">Video File</Label>
              <div className="mt-2">
                <input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  {videoFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">{videoFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setVideoFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Click to upload video file
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('video')?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
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
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isUploading}>
            {isUploading ? 'Adding Movie...' : 'Add Movie'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddMovie;