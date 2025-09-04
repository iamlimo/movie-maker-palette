import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NairaInput from "@/components/admin/NairaInput";

interface TVShow {
  id: string;
  title: string;
  price: number;
}

interface FormData {
  season_number: number;
  description: string;
  price: number;
  rental_expiry_duration: number;
}

const AddSeason = () => {
  const { showId } = useParams<{ showId: string }>();
  const [tvShow, setTvShow] = useState<TVShow | null>(null);
  const [formData, setFormData] = useState<FormData>({
    season_number: 1,
    description: "",
    price: 0,
    rental_expiry_duration: 336 // 14 days default
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (showId) {
      fetchTVShow();
      determineNextSeasonNumber();
    }
  }, [showId]);

  const fetchTVShow = async () => {
    if (!showId) return;

    try {
      const { data, error } = await supabase
        .from('tv_shows')
        .select('*')
        .eq('id', showId)
        .single();

      if (error) throw error;
      setTvShow(data);
      
      // Set default price from TV show
      setFormData(prev => ({
        ...prev,
        price: data.price || 0
      }));
    } catch (error) {
      console.error('Error fetching TV show:', error);
      toast({
        title: "Error",
        description: "Failed to fetch TV show details",
        variant: "destructive",
      });
      navigate('/admin/tv-shows');
    }
  };

  const determineNextSeasonNumber = async () => {
    if (!showId) return;

    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('tv_show_id', showId)
        .order('season_number', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      const nextSeasonNumber = data && data.length > 0 ? data[0].season_number + 1 : 1;
      setFormData(prev => ({
        ...prev,
        season_number: nextSeasonNumber
      }));
    } catch (error) {
      console.error('Error determining season number:', error);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!showId || !tvShow) {
      toast({
        title: "Error",
        description: "TV show information is missing",
        variant: "destructive",
      });
      return;
    }

    if (!formData.season_number) {
      toast({
        title: "Error", 
        description: "Please enter a season number",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Creating season...');

      // Save season data to database
      const { data, error } = await supabase
        .from('seasons')
        .insert([
          {
            tv_show_id: showId,
            season_number: formData.season_number,
            description: formData.description || null,
            price: formData.price || 0,
            rental_expiry_duration: formData.rental_expiry_duration || 336
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Season saved successfully:', data);

      toast({
        title: "Success",
        description: `Season ${formData.season_number} created successfully! You can now add episodes.`,
      });

      // Navigate to add episodes for this season
      navigate(`/admin/tv-shows/${showId}/seasons/${data.id}/add-episode`);

    } catch (error) {
      console.error('Error adding season:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create season",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tvShow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TV show...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin/tv-shows')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TV Shows
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Season to "{tvShow.title}"</h1>
            <p className="text-muted-foreground">Step 2: Create a new season</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Season Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="season_number">Season Number *</Label>
                  <Input
                    id="season_number"
                    type="number"
                    min={1}
                    value={formData.season_number}
                    onChange={(e) => handleInputChange('season_number', parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rental_expiry">Rental Duration</Label>
                  <Select 
                    value={formData.rental_expiry_duration.toString()} 
                    onValueChange={(value) => handleInputChange('rental_expiry_duration', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="336">14 days (default)</SelectItem>
                      <SelectItem value="504">21 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Season Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  placeholder="Brief description of this season..."
                />
              </div>

              <NairaInput
                value={formData.price}
                onChange={(value) => handleInputChange('price', value)}
                label="Season Price"
                placeholder={tvShow.price.toString()}
              />

              <div className="bg-secondary/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Pricing Strategy</h4>
                <p className="text-sm text-muted-foreground">
                  • Season price allows users to rent all episodes in this season<br/>
                  • Individual episodes can have separate pricing<br/>
                  • Season rental is typically more cost-effective than individual episodes
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/admin/tv-shows')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Season...' : 'Create Season & Add Episodes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSeason;