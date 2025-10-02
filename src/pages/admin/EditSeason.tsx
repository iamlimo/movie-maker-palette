import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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

interface Season {
  id: string;
  tv_show_id: string;
  season_number: number;
  description: string;
  price: number;
  rental_expiry_duration: number;
}

interface FormData {
  season_number: number;
  description: string;
  price: number;
  rental_expiry_duration: number;
}

const EditSeason = () => {
  const { showId, seasonId } = useParams<{ showId: string; seasonId: string }>();
  const [tvShow, setTvShow] = useState<TVShow | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [formData, setFormData] = useState<FormData>({
    season_number: 1,
    description: "",
    price: 0,
    rental_expiry_duration: 336
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (showId && seasonId) {
      fetchData();
    }
  }, [showId, seasonId]);

  const fetchData = async () => {
    if (!showId || !seasonId) return;

    try {
      // Fetch TV show
      const { data: showData, error: showError } = await supabase
        .from('tv_shows')
        .select('*')
        .eq('id', showId)
        .single();

      if (showError) throw showError;
      setTvShow(showData);

      // Fetch season
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', seasonId)
        .single();

      if (seasonError) throw seasonError;
      setSeason(seasonData);

      // Populate form with existing data
      setFormData({
        season_number: seasonData.season_number,
        description: seasonData.description || "",
        price: seasonData.price || 0,
        rental_expiry_duration: seasonData.rental_expiry_duration || 336
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch season details",
        variant: "destructive",
      });
      navigate('/admin/tv-shows');
    } finally {
      setLoading(false);
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
    
    if (!seasonId || !showId) {
      toast({
        title: "Error",
        description: "Season information is missing",
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
      // Update season data
      const { error } = await supabase
        .from('seasons')
        .update({
          season_number: formData.season_number,
          description: formData.description || null,
          price: formData.price || 0,
          rental_expiry_duration: formData.rental_expiry_duration || 336
        })
        .eq('id', seasonId);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Season ${formData.season_number} updated successfully!`,
      });

      // Navigate back to TV show view
      navigate(`/admin/tv-shows/view/${showId}`);

    } catch (error) {
      console.error('Error updating season:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update season",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading season...</p>
        </div>
      </div>
    );
  }

  if (!tvShow || !season) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Season not found</p>
          <Button onClick={() => navigate('/admin/tv-shows')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to TV Shows
          </Button>
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
            onClick={() => navigate(`/admin/tv-shows/view/${showId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TV Show
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Season {season.season_number}</h1>
            <p className="text-muted-foreground">{tvShow.title}</p>
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
              onClick={() => navigate(`/admin/tv-shows/view/${showId}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating Season...' : 'Update Season'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSeason;
