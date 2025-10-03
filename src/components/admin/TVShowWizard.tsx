import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TVShowUploader } from './TVShowUploader';
import { BulkEpisodeUploader } from './BulkEpisodeUploader';
import NairaInput from './NairaInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Circle, 
  Play,
  Plus,
  Trash2
} from 'lucide-react';

interface Genre {
  id: string;
  name: string;
}

interface TVShowData {
  title: string;
  description: string;
  genre_id: string;
  release_date: string;
  language: string;
  rating: string;
  price: number;
  thumbnail_url: string;
  trailer_url: string;
}

interface SeasonData {
  season_number: number;
  description: string;
  price: number;
  rental_expiry_duration: number;
}

interface EpisodeData {
  title: string;
  episode_number: number;
  duration: number;
  price: number;
  rental_expiry_duration: number;
  video_url: string;
  release_date: string;
}

const steps = [
  { id: 1, title: 'TV Show Details', description: 'Basic information and media' },
  { id: 2, title: 'Season Setup', description: 'Configure seasons' },
  { id: 3, title: 'Episodes', description: 'Add episodes to seasons' },
  { id: 4, title: 'Review & Publish', description: 'Final review and publish' }
];

export const TVShowWizard = () => {
  const navigate = useNavigate();
  const { showId } = useParams();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);

  // Form data states
  const [tvShowData, setTvShowData] = useState<TVShowData>({
    title: '',
    description: '',
    genre_id: '',
    release_date: '',
    language: '',
    rating: '',
    price: 0,
    thumbnail_url: '',
    trailer_url: ''
  });

  const [seasons, setSeasons] = useState<SeasonData[]>([{
    season_number: 1,
    description: '',
    price: 0,
    rental_expiry_duration: 336
  }]);

  const [episodes, setEpisodes] = useState<Record<number, EpisodeData[]>>({
    1: []
  });

  const [createdTVShowId, setCreatedTVShowId] = useState<string | null>(showId || null);

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

  const updateTVShowData = (field: keyof TVShowData, value: string | number) => {
    setTvShowData(prev => ({ ...prev, [field]: value }));
  };

  const addSeason = () => {
    const newSeasonNumber = Math.max(...seasons.map(s => s.season_number)) + 1;
    setSeasons(prev => [...prev, {
      season_number: newSeasonNumber,
      description: '',
      price: tvShowData.price,
      rental_expiry_duration: 336
    }]);
    setEpisodes(prev => ({ ...prev, [newSeasonNumber]: [] }));
  };

  const removeSeason = (seasonNumber: number) => {
    if (seasons.length <= 1) return;
    setSeasons(prev => prev.filter(s => s.season_number !== seasonNumber));
    setEpisodes(prev => {
      const newEpisodes = { ...prev };
      delete newEpisodes[seasonNumber];
      return newEpisodes;
    });
  };

  const updateSeason = (seasonNumber: number, field: keyof SeasonData, value: string | number) => {
    setSeasons(prev => prev.map(season => 
      season.season_number === seasonNumber 
        ? { ...season, [field]: value }
        : season
    ));
  };

  const addEpisode = (seasonNumber: number) => {
    const currentEpisodes = episodes[seasonNumber] || [];
    const newEpisodeNumber = currentEpisodes.length + 1;
    
    setEpisodes(prev => ({
      ...prev,
      [seasonNumber]: [...currentEpisodes, {
        title: `Episode ${newEpisodeNumber}`,
        episode_number: newEpisodeNumber,
        duration: 0,
        price: 0,
        rental_expiry_duration: 48,
        video_url: '',
        release_date: ''
      }]
    }));
  };

  const removeEpisode = (seasonNumber: number, episodeIndex: number) => {
    setEpisodes(prev => ({
      ...prev,
      [seasonNumber]: prev[seasonNumber].filter((_, index) => index !== episodeIndex)
    }));
  };

  const updateEpisode = (seasonNumber: number, episodeIndex: number, field: keyof EpisodeData, value: string | number) => {
    setEpisodes(prev => ({
      ...prev,
      [seasonNumber]: prev[seasonNumber].map((episode, index) => 
        index === episodeIndex 
          ? { ...episode, [field]: value }
          : episode
      )
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(tvShowData.title && tvShowData.genre_id && tvShowData.thumbnail_url);
      case 2:
        return seasons.every(season => season.season_number > 0);
      case 3:
        return Object.values(episodes).every(seasonEpisodes => 
          seasonEpisodes.every(episode => episode.title && episode.episode_number > 0)
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      toast({
        title: 'Incomplete Step',
        description: 'Please complete all required fields before proceeding.',
        variant: 'destructive'
      });
      return;
    }

    if (currentStep === 1) {
      // Create TV show
      await saveTVShow();
    } else if (currentStep === 2) {
      // Create seasons
      await saveSeasons();
    } else if (currentStep === 3) {
      // Create episodes
      await saveEpisodes();
    }

    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const saveTVShow = async () => {
    if (createdTVShowId) return; // Already created

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('tv_shows')
        .insert([{
          ...tvShowData,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      setCreatedTVShowId(data.id);
      
      toast({
        title: 'Success',
        description: 'TV show created successfully!'
      });
    } catch (error) {
      console.error('Error creating TV show:', error);
      toast({
        title: 'Error',
        description: 'Failed to create TV show',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveSeasons = async () => {
    if (!createdTVShowId) return;

    setIsSubmitting(true);
    try {
      const seasonInserts = seasons.map(season => ({
        tv_show_id: createdTVShowId,
        ...season
      }));

      const { error } = await supabase
        .from('seasons')
        .insert(seasonInserts);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Seasons created successfully!'
      });
    } catch (error) {
      console.error('Error creating seasons:', error);
      toast({
        title: 'Error',
        description: 'Failed to create seasons',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveEpisodes = async () => {
    if (!createdTVShowId) return;

    setIsSubmitting(true);
    try {
      // Get created seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('id, season_number')
        .eq('tv_show_id', createdTVShowId);

      if (seasonsError) throw seasonsError;

      // Create episodes for each season
      for (const season of seasonsData) {
        const seasonEpisodes = episodes[season.season_number] || [];
        if (seasonEpisodes.length === 0) continue;

        const episodeInserts = seasonEpisodes.map(episode => ({
          season_id: season.id,
          ...episode,
          status: 'pending' as const
        }));

        const { error: episodeError } = await supabase
          .from('episodes')
          .insert(episodeInserts);

        if (episodeError) throw episodeError;
      }
      
      toast({
        title: 'Success',
        description: 'Episodes created successfully!'
      });
    } catch (error) {
      console.error('Error creating episodes:', error);
      toast({
        title: 'Error',
        description: 'Failed to create episodes',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    toast({
      title: 'TV Show Created!',
      description: 'Your TV show has been successfully created and is pending approval.'
    });
    navigate('/admin/tv-shows');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
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
                      value={tvShowData.title}
                      onChange={(e) => updateTVShowData('title', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="genre">Genre *</Label>
                    <Select value={tvShowData.genre_id} onValueChange={(value) => updateTVShowData('genre_id', value)}>
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
                    value={tvShowData.description}
                    onChange={(e) => updateTVShowData('description', e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="release_date">Release Date</Label>
                    <Input
                      id="release_date"
                      type="date"
                      value={tvShowData.release_date}
                      onChange={(e) => updateTVShowData('release_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      value={tvShowData.language}
                      onChange={(e) => updateTVShowData('language', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rating">Rating</Label>
                    <Select value={tvShowData.rating} onValueChange={(value) => updateTVShowData('rating', value)}>
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
                </div>

                <NairaInput
                  value={tvShowData.price}
                  onChange={(value) => updateTVShowData('price', value)}
                  label="Base Season Price"
                  placeholder="0.00"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Media Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <TVShowUploader
                  accept="image/*"
                  onUploadComplete={(filePath) => updateTVShowData('thumbnail_url', filePath)}
                  label="TV Show Poster"
                  description="Upload the main poster for the TV show"
                  contentType="poster"
                  currentUrl={tvShowData.thumbnail_url}
                  maxSize={10 * 1024 * 1024}
                  required={true}
                  autoUpload={true}
                />

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="trailer_url">TV Show Trailer URL (Optional)</Label>
                  <Input
                    id="trailer_url"
                    type="text"
                    placeholder="Paste Backblaze B2 file URL or path (e.g., trailers/show-trailer.mp4)"
                    value={tvShowData.trailer_url}
                    onChange={(e) => updateTVShowData('trailer_url', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the Backblaze B2 file path or full URL for the trailer video
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Season Configuration
                  <Button onClick={addSeason} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Season
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {seasons.map((season, index) => (
                  <Card key={season.season_number} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Season {season.season_number}</h4>
                      {seasons.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSeason(season.season_number)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Season Number</Label>
                        <Input
                          type="number"
                          min={1}
                          value={season.season_number}
                          onChange={(e) => updateSeason(season.season_number, 'season_number', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label>Rental Duration</Label>
                        <Select 
                          value={season.rental_expiry_duration.toString()} 
                          onValueChange={(value) => updateSeason(season.season_number, 'rental_expiry_duration', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="168">7 days</SelectItem>
                            <SelectItem value="336">14 days</SelectItem>
                            <SelectItem value="504">21 days</SelectItem>
                            <SelectItem value="720">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label>Season Description</Label>
                      <Textarea
                        value={season.description}
                        onChange={(e) => updateSeason(season.season_number, 'description', e.target.value)}
                        rows={3}
                        placeholder="Brief description of this season..."
                      />
                    </div>

                    <div className="mt-4">
                      <NairaInput
                        value={season.price}
                        onChange={(value) => updateSeason(season.season_number, 'price', value)}
                        label="Season Price"
                        placeholder={tvShowData.price.toString()}
                      />
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {seasons.map((season) => (
              <Card key={season.season_number}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Season {season.season_number} Episodes
                    <Button
                      onClick={() => addEpisode(season.season_number)}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Episode
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(episodes[season.season_number] || []).map((episode, episodeIndex) => (
                    <Card key={episodeIndex} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium">Episode {episode.episode_number}</h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEpisode(season.season_number, episodeIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Episode Title</Label>
                          <Input
                            value={episode.title}
                            onChange={(e) => updateEpisode(season.season_number, episodeIndex, 'title', e.target.value)}
                            placeholder="Episode title"
                          />
                        </div>
                        <div>
                          <Label>Episode Number</Label>
                          <Input
                            type="number"
                            min={1}
                            value={episode.episode_number}
                            onChange={(e) => updateEpisode(season.season_number, episodeIndex, 'episode_number', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div>
                          <Label>Duration (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={episode.duration}
                            onChange={(e) => updateEpisode(season.season_number, episodeIndex, 'duration', parseInt(e.target.value) || 0)}
                            placeholder="45"
                          />
                        </div>
                        <div>
                          <Label>Release Date</Label>
                          <Input
                            type="date"
                            value={episode.release_date}
                            onChange={(e) => updateEpisode(season.season_number, episodeIndex, 'release_date', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <NairaInput
                          value={episode.price}
                          onChange={(value) => updateEpisode(season.season_number, episodeIndex, 'price', value)}
                          label="Episode Price"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="mt-4">
                        <TVShowUploader
                          accept="video/*"
                          onUploadComplete={(filePath) => updateEpisode(season.season_number, episodeIndex, 'video_url', filePath)}
                          label="Episode Video"
                          description="Upload the episode video file"
                          contentType="episode"
                          currentUrl={episode.video_url}
                          maxSize={2 * 1024 * 1024 * 1024}
                          required={false}
                          autoUpload={true}
                        />
                      </div>
                    </Card>
                  ))}
                  
                  {(episodes[season.season_number] || []).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No episodes added yet. Click "Add Episode" to get started.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Your TV Show</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">TV Show Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Title:</span> {tvShowData.title}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Base Price:</span> ₦{tvShowData.price}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description:</span> {tvShowData.description || 'No description'}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Seasons ({seasons.length})</h4>
                  {seasons.map((season) => (
                    <div key={season.season_number} className="mb-4 p-3 border rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Season {season.season_number}</span>
                        <span className="text-sm text-muted-foreground">₦{season.price}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Episodes: {(episodes[season.season_number] || []).length}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-2">Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{seasons.length}</div>
                      <div className="text-sm text-muted-foreground">Seasons</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {Object.values(episodes).reduce((total, seasonEpisodes) => total + seasonEpisodes.length, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Episodes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {Object.values(episodes).reduce((total, seasonEpisodes) => 
                          total + seasonEpisodes.filter(ep => ep.video_url).length, 0
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">Videos Uploaded</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
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
            <h1 className="text-3xl font-bold">TV Show Creation Wizard</h1>
            <p className="text-muted-foreground">Create your TV show step by step</p>
          </div>
        </div>

        {/* Progress Steps */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Progress</h3>
              <span className="text-sm text-muted-foreground">
                Step {currentStep} of {steps.length}
              </span>
            </div>
            
            <Progress value={(currentStep / steps.length) * 100} className="mb-4" />
            
            <div className="flex items-center justify-between">
              {steps.map((step) => (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-2 text-sm ${
                    step.id === currentStep 
                      ? 'text-primary font-medium' 
                      : step.id < currentStep 
                      ? 'text-green-600' 
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  <div>
                    <div>{step.title}</div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1 || isSubmitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {currentStep < steps.length ? (
                <Button
                  onClick={handleNext}
                  disabled={!validateStep(currentStep) || isSubmitting}
                >
                  {isSubmitting ? (
                    <>Loading...</>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={isSubmitting}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finish & Publish
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};