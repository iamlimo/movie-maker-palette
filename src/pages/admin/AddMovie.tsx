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

  const uploadToB2 = async (file: File, fileName: string): Promise<string> => {
    console.log('Frontend Upload - Starting upload for:', fileName, 'Size:', file.size, 'Type:', file.type);
    
    // Step 1: Get upload info (determine if direct or chunked upload)
    const { data: uploadInfo, error: infoError } = await supabase.functions.invoke('b2-upload', {
      body: {
        action: 'get_upload_info',
        fileName,
        fileSize: file.size,
        fileType: file.type
      }
    });

    if (infoError || !uploadInfo?.success) {
      throw new Error(infoError?.message || uploadInfo?.error || 'Failed to get upload info');
    }

    console.log('Upload strategy:', uploadInfo.uploadType);

    if (uploadInfo.uploadType === 'direct') {
      // Direct upload for small files
      return await uploadDirectToB2(file, fileName, uploadInfo);
    } else {
      // Chunked upload for large files
      return await uploadChunkedToB2(file, fileName, uploadInfo);
    }
  };

  const uploadDirectToB2 = async (file: File, fileName: string, uploadInfo: any): Promise<string> => {
    console.log('Direct upload to B2...');
    
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    
    const uploadResponse = await fetch(uploadInfo.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadInfo.authorizationToken,
        'X-Bz-File-Name': fileName,
        'Content-Type': file.type || 'application/octet-stream',
        'X-Bz-Content-Sha1': 'unverified'
      },
      body: fileBytes
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Direct upload failed: ${error}`);
    }

    const uploadData = await uploadResponse.json();
    const bucketName = 'your-bucket-name'; // This should come from the backend
    return `https://f002.backblazeb2.com/file/${bucketName}/${uploadData.fileName}`;
  };

  const uploadChunkedToB2 = async (file: File, fileName: string, uploadInfo: any): Promise<string> => {
    console.log('Chunked upload to B2...');
    
    const chunkSize = uploadInfo.chunkSize; // 10MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    const partSha1Array: string[] = [];
    
    console.log(`Uploading ${totalChunks} chunks of ${chunkSize / (1024 * 1024)}MB each`);

    // Upload each chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;
      
      console.log(`Uploading chunk ${partNumber}/${totalChunks} (${start}-${end})`);
      
      // Get upload URL for this part
      const { data: partInfo, error: partError } = await supabase.functions.invoke('b2-upload', {
        body: {
          action: 'get_upload_part_url',
          fileId: uploadInfo.fileId,
          partNumber
        }
      });

      if (partError || !partInfo?.success) {
        throw new Error(`Failed to get part URL for chunk ${partNumber}: ${partError?.message || partInfo?.error}`);
      }

      // Upload the chunk
      const chunkBytes = new Uint8Array(await chunk.arrayBuffer());
      
      const chunkResponse = await fetch(partInfo.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': partInfo.authorizationToken,
          'X-Bz-Part-Number': partNumber.toString(),
          'Content-Length': chunkBytes.length.toString(),
          'X-Bz-Content-Sha1': 'unverified'
        },
        body: chunkBytes
      });

      if (!chunkResponse.ok) {
        const error = await chunkResponse.text();
        throw new Error(`Failed to upload chunk ${partNumber}: ${error}`);
      }

      const chunkData = await chunkResponse.json();
      partSha1Array.push(chunkData.contentSha1);
      
      // Update progress
      const progress = Math.round((partNumber / totalChunks) * 100);
      setUploadProgress(progress);
      
      console.log(`Chunk ${partNumber}/${totalChunks} uploaded successfully`);
    }

    // Finalize the large file
    console.log('Finalizing large file upload...');
    const { data: finishData, error: finishError } = await supabase.functions.invoke('b2-upload', {
      body: {
        action: 'finish_large_file',
        fileId: uploadInfo.fileId,
        partSha1Array
      }
    });

    if (finishError || !finishData?.success) {
      throw new Error(`Failed to finalize upload: ${finishError?.message || finishData?.error}`);
    }

    console.log('Large file upload completed successfully');
    return finishData.downloadUrl;
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