import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Heart, Star, Clock, Calendar, Globe, Play, Lock } from "lucide-react";
import Header from "@/components/Header";
import ContentHero from "@/components/ContentHero";
import RecommendationsSection from "@/components/RecommendationsSection";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useRentals } from "@/hooks/useRentals";
import { toast } from "@/hooks/use-toast";
import EpisodePlayer from "@/components/EpisodePlayer";
import RentalButton from "@/components/RentalButton";

interface TVShow {
  id: string;
  title: string;
  description: string;
  genre_id: string;
  genre?: { name: string };
  genres?: string[];
  release_date: string;
  price: number;
  rating: string;
  language: string;
  thumbnail_url: string;
  landscape_poster_url?: string;
  slider_cover_url?: string;
  trailer_url?: string;
  status: string;
}

interface Season {
  id: string;
  season_number: number;
  description: string;
  price: number;
  rental_expiry_duration: number;
  cover_image_url?: string;
  status: string;
}

interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description?: string;
  duration: number;
  price: number;
  video_url: string;
  thumbnail_url?: string;
  status: string;
}

const TVShowPreview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, toggleFavorite, loading: favoritesLoading } = useFavorites();
  const { checkAccess } = useRentals();
  const [tvShow, setTVShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<{ [seasonId: string]: Episode[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [seasonAccess, setSeasonAccess] = useState<{ [seasonId: string]: boolean }>({});
  const [episodeAccess, setEpisodeAccess] = useState<{ [episodeId: string]: boolean }>({});

  const isFavorite = tvShow ? favorites.some(fav => fav.content_id === tvShow.id && fav.content_type === 'tv_show') : false;

  useEffect(() => {
    if (id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchTVShowData(id);
    }
  }, [id]);

  const fetchTVShowData = async (showId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch TV show details
      const { data: showData, error: showError } = await supabase
        .from('tv_shows')
        .select(`
          *,
          genre:genres(name),
          thumbnail_url,
          landscape_poster_url,
          slider_cover_url,
          trailer_url
        `)
        .eq('id', showId)
        .eq('status', 'approved')
        .single();

      if (showError) throw showError;
      if (!showData) throw new Error('TV show not found');

      setTVShow(showData);

      // Fetch seasons (only approved ones for users)
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .eq('tv_show_id', showId)
        .eq('status', 'approved')
        .order('season_number');

      if (seasonsError) throw seasonsError;
      setSeasons(seasonsData || []);

      // Fetch episodes for all seasons
      if (seasonsData && seasonsData.length > 0) {
        const episodesPromises = seasonsData.map(season =>
          supabase
            .from('episodes')
            .select(`
              *,
              thumbnail_url,
              video_url
            `)
            .eq('season_id', season.id)
            .eq('status', 'approved')
            .order('episode_number')
        );

        const episodesResults = await Promise.all(episodesPromises);
        const episodesMap: { [seasonId: string]: Episode[] } = {};

        seasonsData.forEach((season, index) => {
          episodesMap[season.id] = episodesResults[index].data || [];
        });

        setEpisodes(episodesMap);
        
        // Check access for seasons and episodes if user is logged in
        if (user) {
          await checkSeasonAndEpisodeAccess(seasonsData, episodesMap);
        }
      }

    } catch (error: any) {
      console.error('Error fetching TV show:', error);
      setError(error.message || 'Failed to load TV show');
    } finally {
      setLoading(false);
    }
  };

  const checkSeasonAndEpisodeAccess = async (seasonsData: Season[], episodesMap: { [seasonId: string]: Episode[] }) => {
    if (!user) return;

    try {
      // Check season access
      const newSeasonAccess: { [seasonId: string]: boolean } = {};
      seasonsData.forEach(season => {
        newSeasonAccess[season.id] = checkAccess(season.id, 'season');
      });

      // Check episode access
      const newEpisodeAccess: { [episodeId: string]: boolean } = {};
      Object.values(episodesMap).flat().forEach(episode => {
        newEpisodeAccess[episode.id] = checkAccess(episode.id, 'episode');
      });

      setSeasonAccess(newSeasonAccess);
      setEpisodeAccess(newEpisodeAccess);
    } catch (error) {
      console.error('Error checking access:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!tvShow || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add shows to your watchlist.",
        variant: "destructive",
      });
      return;
    }

    try {
      await toggleFavorite('tv_show', tvShow.id);
      toast({
        title: isFavorite ? "Removed from Watchlist" : "Added to Watchlist",
        description: isFavorite 
          ? `${tvShow.title} has been removed from your watchlist.`
          : `${tvShow.title} has been added to your watchlist.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update watchlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !tvShow) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">TV Show Not Found</h1>
            <p className="text-muted-foreground mb-6">
              {error || "The TV show you're looking for doesn't exist or is not available."}
            </p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentSeason = seasons.find(s => s.season_number === selectedSeason);
  const currentEpisodes = currentSeason ? episodes[currentSeason.id] || [] : [];

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Content Hero Section */}
      <ContentHero
        title={tvShow.title}
        description={tvShow.description || ''}
        imageUrl={tvShow.landscape_poster_url || tvShow.slider_cover_url || tvShow.thumbnail_url || ''}
        trailerUrl={tvShow.trailer_url || undefined}
        rating={tvShow.rating || undefined}
        year={tvShow.release_date ? new Date(tvShow.release_date).getFullYear() : undefined}
        genre={tvShow.genre?.name}
        price={tvShow.price}
        language={tvShow.language || undefined}
        onBack={() => navigate('/')}
        contentType="tv_show"
      />

      {/* Pricing Options Section */}
      {currentSeason && (
        <div className="container mx-auto px-4 py-8 border-y border-border/50">
          <h2 className="text-2xl font-bold mb-6">Rental Options</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Season Rental */}
            <div className="p-6 rounded-xl border-2 border-primary/50 bg-primary/5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default" className="bg-primary">Best Value</Badge>
              </div>
              <h3 className="text-xl font-bold mb-2">Rent Entire Season</h3>
              <div className="text-3xl font-bold text-primary mb-2">
                ₦{currentSeason.price}
              </div>
              <ul className="space-y-2 mb-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary"></div>
                  {currentEpisodes.length} episodes included
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary"></div>
                  {currentSeason.rental_expiry_duration} hours access
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary"></div>
                  Watch anytime during rental period
                </li>
              </ul>
              <RentalButton
                contentId={currentSeason.id}
                contentType="season"
                price={currentSeason.price}
                title={`${tvShow.title} - Season ${selectedSeason}`}
              />
            </div>

            {/* Episode Rental */}
            <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-2">Rent Individual Episodes</h3>
              <div className="text-3xl font-bold mb-2">
                From ₦{currentEpisodes.length > 0 ? Math.min(...currentEpisodes.map(e => e.price)) : 0}
              </div>
              <ul className="space-y-2 mb-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-foreground"></div>
                  Choose specific episodes
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-foreground"></div>
                  48-hour rental per episode
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-foreground"></div>
                  Flexible pricing
                </li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => document.getElementById('episodes-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Browse Episodes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Show Details */}
            <div>
              <h2 className="text-2xl font-bold mb-4">About This Show</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {tvShow.description}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">First Aired</p>
                  <p className="font-semibold">
                    {tvShow.release_date ? new Date(tvShow.release_date).getFullYear() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seasons</p>
                  <p className="font-semibold">{seasons.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="font-semibold">{tvShow.rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seasons & Episodes */}
            {seasons.length > 0 && (
              <div id="episodes-section">
                <h2 className="text-2xl font-bold mb-4">Seasons & Episodes</h2>
                <Tabs value={selectedSeason.toString()} onValueChange={(value) => setSelectedSeason(parseInt(value))}>
                  <TabsList className="grid w-full grid-cols-auto">
                    {seasons.map((season) => {
                      const seasonEpisodes = episodes[season.id] || [];
                      return (
                        <TabsTrigger key={season.id} value={season.season_number.toString()}>
                          <div className="flex flex-col items-start">
                            <span>Season {season.season_number}</span>
                            <span className="text-xs text-muted-foreground">
                              {seasonEpisodes.length} episodes • ₦{season.price}
                            </span>
                          </div>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {seasons.map((season) => (
                    <TabsContent key={season.id} value={season.season_number.toString()}>
                      <div className="space-y-4">
                        {season.description && (
                          <p className="text-muted-foreground">{season.description}</p>
                        )}
                        
                        <div className="space-y-3">
                          {currentEpisodes.map((episode, index) => {
                            const hasEpisodeAccess = episodeAccess[episode.id];
                            const hasSeasonAccess = seasonAccess[currentSeason?.id || ''];
                            const hasAnyAccess = hasEpisodeAccess || hasSeasonAccess;
                            const nextEpisode = currentEpisodes[index + 1];

                            return (
                                <div key={episode.id} className="space-y-3">
                                 <div className="group p-4 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-300 hover:scale-[1.01]">
                                   <div className="flex flex-col sm:flex-row gap-4">
                                    {/* Episode Thumbnail */}
                                     {episode.thumbnail_url && (
                                      <div className="relative w-full sm:w-32 h-48 sm:h-20 rounded overflow-hidden flex-shrink-0">
                                        <img 
                                          src={episode.thumbnail_url} 
                                          alt={episode.title}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.src = '/placeholder.svg';
                                          }}
                                        />
                                        {!hasAnyAccess && (
                                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <Lock className="h-6 w-6 text-white" />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Episode Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <h4 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                            {episode.episode_number}. {episode.title}
                                          </h4>
                                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              <span>{episode.duration} min</span>
                                            </div>
                                            <span>•</span>
                                            <span className="font-semibold text-foreground">₦{episode.price}</span>
                                            {hasAnyAccess && (
                                              <>
                                                <span>•</span>
                                                <Badge variant="outline" className="text-green-600 border-green-600">
                                                  ✓ Unlocked
                                                </Badge>
                                              </>
                                            )}
                                           </div>
                                          {episode.description && (
                                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                              {episode.description}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* Action Button */}
                                        <div className="flex-shrink-0">
                                          {hasAnyAccess ? (
                                            <Button 
                                              variant="default" 
                                              size="sm"
                                              onClick={() => setSelectedEpisode(episode)}
                                              className="shadow-glow"
                                            >
                                              <Play className="h-4 w-4 mr-1" />
                                              Watch
                                            </Button>
                                          ) : (
                                            <RentalButton
                                              contentId={episode.id}
                                              contentType="episode"
                                              price={episode.price}
                                              title={`Episode ${episode.episode_number}: ${episode.title}`}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Episode Player */}
                                {selectedEpisode?.id === episode.id && (
                                  <div className="mt-4">
                                    <EpisodePlayer
                                      episodeId={episode.id}
                                      seasonId={currentSeason?.id || ''}
                                      title={episode.title}
                                      price={episode.price}
                                      posterUrl={episode.thumbnail_url}
                                      nextEpisodeId={nextEpisode?.id}
                                      autoPlay={true}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          
                          {currentEpisodes.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              No episodes available for this season.
                            </p>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Watchlist Action */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleFavorite}
                disabled={favoritesLoading}
              >
                <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                {isFavorite ? 'Remove from Watchlist' : 'Add to Watchlist'}
              </Button>
            </div>

            {/* Show Info */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <h3 className="font-semibold mb-4">Show Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    First aired {tvShow.release_date ? new Date(tvShow.release_date).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{tvShow.language || 'English'}</span>
                </div>
                {tvShow.genre?.name && (
                  <div className="pt-2">
                    <Badge variant="outline">{tvShow.genre.name}</Badge>
                  </div>
                )}
                {tvShow.genres && tvShow.genres.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {tvShow.genres.map((genre, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {tvShow.rating && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Content Rating</p>
                    <Badge variant="outline" className="font-semibold">
                      {tvShow.rating}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Season Info */}
            {currentSeason && (
              <div className="p-6 rounded-xl border border-border bg-card">
                <h3 className="font-semibold mb-4">Season {currentSeason.season_number}</h3>
                <div className="space-y-3">
                  {seasonAccess[currentSeason.id] && (
                    <div className="mb-4">
                      <Badge variant="default" className="bg-green-600">
                        Season Pass Active
                      </Badge>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Episodes</p>
                    <p className="font-semibold">{currentEpisodes.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Season Rental</p>
                    <p className="font-semibold text-primary">₦{currentSeason.price}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rental Duration</p>
                    <p className="font-semibold">{currentSeason.rental_expiry_duration} hours</p>
                  </div>
                  
                  {/* Season Rental Option */}
                  {user && !seasonAccess[currentSeason.id] && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-3">Unlock all episodes in this season:</p>
                      <RentalButton
                        contentId={currentSeason.id}
                        contentType="season"
                        price={currentSeason.price}
                        title={`Season ${currentSeason.season_number}`}
                      />
                    </div>
                  )}
                  
                  {seasonAccess[currentSeason.id] && (
                    <div className="pt-4 border-t">
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Season Unlocked
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="container mx-auto px-4 pb-12">
        <RecommendationsSection
          currentContentId={tvShow.id}
          contentType="tv_show"
          genreId={tvShow.genre_id}
        />
      </div>
    </div>
  );
};

export default TVShowPreview;