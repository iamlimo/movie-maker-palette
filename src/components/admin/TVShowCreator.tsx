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
import { TVShowUploader } from './TVShowUploader';
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
  poster_url: string;
  banner_url: string;
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
    poster_url: '',
    banner_url: '',
    trailer_url: ''
  });
  
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const ageRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
  const categories = ['Drama', 'Comedy', 'Action', 'Horror', 'Sci-Fi', 'Documentary', 'Romance', 'Thriller'];

  const handleInputChange = (field: keyof TVShowFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field: 'poster_url' | 'banner_url' | 'trailer_url') => (filePath: string, publicUrl: string) => {
    setFormData(prev => ({ ...prev, [field]: publicUrl }));
    toast({
      title: "Upload Successful",
      description: `${field.replace('_', ' ')} uploaded successfully`,
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
    if (!formData.title || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tv-show', {
        body: {
          title: formData.title,
          description: formData.description,
          release_date: formData.release_date || null,
          age_rating: formData.age_rating,
          category: formData.category,
          tags: formData.tags,
          poster_url: formData.poster_url,
          banner_url: formData.banner_url,
          trailer_url: formData.trailer_url
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create TV show');
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
        poster_url: '',
        banner_url: '',
        trailer_url: ''
      });

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
            <TVShowUploader
              onUploadComplete={handleFileUpload('poster_url')}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              label="Poster Image"
              description="Upload the main poster for this TV show"
              contentType="poster"
              currentUrl={formData.poster_url}
              required
            />

            <TVShowUploader
              onUploadComplete={handleFileUpload('banner_url')}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              label="Banner Image"
              description="Upload a banner/landscape image for this TV show"
              contentType="poster"
              currentUrl={formData.banner_url}
            />

            <TVShowUploader
              onUploadComplete={handleFileUpload('trailer_url')}
              accept="video/*"
              maxSize={100 * 1024 * 1024} // 100MB
              label="Trailer Video"
              description="Upload a trailer/preview video for this TV show"
              contentType="trailer"
              currentUrl={formData.trailer_url}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={saving || !formData.title || !formData.description}
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