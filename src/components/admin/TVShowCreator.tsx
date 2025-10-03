import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedTVShowUploader } from './UnifiedTVShowUploader';
import BackblazeUrlInput from './BackblazeUrlInput';
import { 
  Tv, 
  Plus, 
  Calendar, 
  Tag,
  Save,
  Loader2
} from 'lucide-react';

interface TVShowFormData {
  title: string;
  description: string;
  release_date: string;
  age_rating: string;
  category: string;
  tags: string[];
  poster_file: File | null;
  banner_file: File | null;
  trailer_url: string;
}

export const TVShowCreator = () => {
  const [formData, setFormData] = useState<TVShowFormData>({
    title: '',
    description: '',
    release_date: '',
    age_rating: 'PG',
    category: 'Drama',
    tags: [],
    poster_file: null,
    banner_file: null,
    trailer_url: ''
  });
  
  const [uploadedUrls, setUploadedUrls] = useState<{
    poster?: string;
    banner?: string;
  }>({});
  
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const ageRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
  const categories = ['Drama', 'Comedy', 'Action', 'Horror', 'Sci-Fi', 'Documentary', 'Romance', 'Thriller'];

  const handleInputChange = (field: keyof TVShowFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (field: 'poster_file' | 'banner_file') => (file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
    // Clear uploaded URL when new file is selected
    const urlField = field.replace('_file', '') as 'poster' | 'banner';
    setUploadedUrls(prev => ({ ...prev, [urlField]: undefined }));
    
    if (file) {
      toast({
        title: "File Selected",
        description: `${field.replace('_file', '')} file selected: ${file.name}`,
      });
    }
  };

  const handleUploadComplete = (field: 'poster' | 'banner') => (filePath: string, publicUrl: string) => {
    setUploadedUrls(prev => ({ ...prev, [field]: publicUrl }));
    toast({
      title: "Upload Complete",
      description: `${field.charAt(0).toUpperCase() + field.slice(1)} uploaded successfully`,
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || (!formData.poster_file && !uploadedUrls.poster)) {
      toast({
        title: "Validation Error",
        description: "Title, description, and poster are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Create FormData to send files and URLs
      const submitFormData = new FormData();
      submitFormData.append('title', formData.title);
      submitFormData.append('description', formData.description);
      submitFormData.append('rating', formData.age_rating);
      submitFormData.append('genres', JSON.stringify(formData.tags));
      submitFormData.append('language', 'en');
      submitFormData.append('price', '0');
      
      if (formData.release_date) {
        submitFormData.append('release_date', formData.release_date);
      }
      
      // Add files if they haven't been uploaded yet, or URLs if they have
      if (uploadedUrls.poster) {
        submitFormData.append('poster_url', uploadedUrls.poster);
      } else if (formData.poster_file) {
        submitFormData.append('poster', formData.poster_file);
      }
      
      if (uploadedUrls.banner) {
        submitFormData.append('banner_url', uploadedUrls.banner);
      } else if (formData.banner_file) {
        submitFormData.append('banner', formData.banner_file);
      }
      
      if (formData.trailer_url) {
        submitFormData.append('trailer_url', formData.trailer_url);
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Make direct fetch request to edge function
      const response = await fetch(`https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/create-tv-show`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: submitFormData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      toast({
        title: "Success",
        description: "TV Show created successfully!",
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        release_date: '',
        age_rating: 'PG',
        category: 'Drama',
        tags: [],
        poster_file: null,
        banner_file: null,
        trailer_url: ''
      });
      setUploadedUrls({});

    } catch (error) {
      console.error('TV Show creation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create TV show',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5" />
            Create New TV Show
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter TV show title"
              />
            </div>
            
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
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter TV show description"
              rows={4}
            />
          </div>

          {/* Categories and Ratings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="age_rating">Age Rating</Label>
              <Select value={formData.age_rating} onValueChange={(value) => handleInputChange('age_rating', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select age rating" />
                </SelectTrigger>
                <SelectContent>
                  {ageRatings.map(rating => (
                    <SelectItem key={rating} value={rating}>
                      {rating}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    <Tag className="h-3 w-3 mr-1" />
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* File Uploads */}
          <div className="space-y-6">
            <UnifiedTVShowUploader
              onFileSelect={handleFileSelect('poster_file')}
              onUploadComplete={handleUploadComplete('poster')}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              label="Poster Image"
              description="Upload the main poster for this TV show"
              contentType="poster"
              selectedFile={formData.poster_file}
              currentUrl={uploadedUrls.poster}
              required
              autoUpload={true}
            />

            <UnifiedTVShowUploader
              onFileSelect={handleFileSelect('banner_file')}
              onUploadComplete={handleUploadComplete('banner')}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              label="Banner Image"
              description="Upload a banner/landscape image for this TV show"
              contentType="banner"
              selectedFile={formData.banner_file}
              currentUrl={uploadedUrls.banner}
              autoUpload={true}
            />

            <div className="space-y-2">
              <BackblazeUrlInput
                value={formData.trailer_url}
                onChange={(url) => handleInputChange('trailer_url', url)}
                label="Trailer Video URL"
                required={false}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={saving || !formData.title || !formData.description || (!formData.poster_file && !uploadedUrls.poster)}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating TV Show...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create TV Show
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};