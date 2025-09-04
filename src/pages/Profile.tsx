import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { 
  CalendarIcon, 
  Camera, 
  Edit, 
  Save, 
  X, 
  User, 
  Settings, 
  Heart, 
  History,
  BarChart3,
  Clock,
  Play,
  Eye,
  Star,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useFavorites } from '@/hooks/useFavorites';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import ContentCarousel, { ContentCarouselItem } from '@/components/ContentCarousel';
import WatchProgressCard from '@/components/WatchProgressCard';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user } = useAuth();
  const { profile, preferences, loading: profileLoading, updateProfile, updatePreferences, uploadProfileImage } = useProfile();
  const { continueWatching, completedItems, watchHistory, loading: historyLoading, updateWatchProgress, removeFromHistory, markAsCompleted } = useWatchHistory();
  const { favorites, loading: favoritesLoading } = useFavorites();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    country: '',
    date_of_birth: null as Date | null
  });

  const [preferencesData, setPreferencesData] = useState({
    preferred_language: 'en',
    preferred_genres: [] as string[],
    email_notifications: true,
    push_notifications: true,
    auto_play: true
  });

  React.useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone_number: profile.phone_number || '',
        country: profile.country || '',
        date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth) : null
      });
    }
  }, [profile]);

  React.useEffect(() => {
    if (preferences) {
      setPreferencesData({
        preferred_language: preferences.preferred_language || 'en',
        preferred_genres: preferences.preferred_genres || [],
        email_notifications: preferences.email_notifications ?? true,
        push_notifications: preferences.push_notifications ?? true,
        auto_play: preferences.auto_play ?? true
      });
    }
  }, [preferences]);

  const handleSaveProfile = async () => {
    const success = await updateProfile({
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone_number: formData.phone_number,
      country: formData.country,
      date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null
    });
    
    if (success) {
      setIsEditing(false);
    }
  };

  const handleSavePreferences = async () => {
    await updatePreferences(preferencesData);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploadingImage(true);
      await uploadProfileImage(file);
      setIsUploadingImage(false);
    }
  };

  const getDashboardStats = () => {
    return {
      totalWatched: completedItems.length,
      totalFavorites: favorites.length,
      continueWatchingCount: continueWatching.length,
      joinedDate: profile?.created_at ? new Date(profile.created_at) : null
    };
  };

  const stats = getDashboardStats();

  const availableGenres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 
    'Romance', 'Sci-Fi', 'Thriller', 'Documentary', 'Animation', 'Crime', 'War'
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' }
  ];

  if (profileLoading || historyLoading || favoritesLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen gradient-hero flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your profile...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Enhanced Header */}
        <div className="gradient-hero py-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-6 lg:space-y-0">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-white/20">
                    <AvatarImage src={profile?.profile_image_url} />
                    <AvatarFallback className="text-2xl">
                      {profile?.first_name?.[0] || profile?.name?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2 cursor-pointer transition-colors">
                    <Camera size={16} />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploadingImage}
                    />
                  </label>
                </div>
                <div className="text-white">
                  <h1 className="text-3xl font-bold">
                    {profile?.first_name && profile?.last_name 
                      ? `${profile.first_name} ${profile.last_name}`
                      : profile?.name || user?.email
                    }
                  </h1>
                  <p className="text-white/80 mt-1">{user?.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-white border-white/30">
                      {profile?.status || 'Active'}
                    </Badge>
                    <Badge variant="outline" className="text-white border-white/30">
                      Member {stats.joinedDate 
                        ? formatDistanceToNow(stats.joinedDate, { addSuffix: true })
                        : 'Recently'
                      }
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {profile?.wallet_balance !== undefined && (
                  <Card className="bg-white/10 border-white/20 text-white">
                    <CardContent className="p-4 flex items-center space-x-2">
                      <Wallet size={20} />
                      <div>
                        <p className="text-sm opacity-80">Wallet Balance</p>
                        <p className="font-bold">₦{profile.wallet_balance.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue="overview" className="space-y-6">
            {/* Quick Actions need access to tab state */}
            <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <BarChart3 size={16} />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center space-x-2">
                <User size={16} />
                <span className="hidden sm:inline">Personal Info</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center space-x-2">
                <Settings size={16} />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex items-center space-x-2">
                <Heart size={16} />
                <span className="hidden sm:inline">My Content</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <History size={16} />
                <span className="hidden sm:inline">Watch History</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6 flex items-center space-x-4">
                    <div className="bg-blue-500/10 p-3 rounded-full">
                      <Eye className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Content Watched</p>
                      <p className="text-2xl font-bold">{stats.totalWatched}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 flex items-center space-x-4">
                    <div className="bg-red-500/10 p-3 rounded-full">
                      <Heart className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Favorites</p>
                      <p className="text-2xl font-bold">{stats.totalFavorites}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 flex items-center space-x-4">
                    <div className="bg-green-500/10 p-3 rounded-full">
                      <Play className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Continue Watching</p>
                      <p className="text-2xl font-bold">{stats.continueWatchingCount}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 flex items-center space-x-4">
                    <div className="bg-purple-500/10 p-3 rounded-full">
                      <Star className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Watch Time</p>
                      <p className="text-lg font-bold">
                        {Math.round(watchHistory.reduce((acc, item) => acc + (item.duration || 0) * (item.progress / 100), 0) / 60)}h
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Continue Watching */}
              {continueWatching.length > 0 && (
                <ContentCarousel 
                  title="Continue Watching" 
                  subtitle="Pick up where you left off"
                >
                  {continueWatching.slice(0, 6).map((item) => (
                    <ContentCarouselItem key={item.id} minWidth="320px">
                      <WatchProgressCard
                        item={item}
                        onPlay={() => {
                          console.log('Playing:', item.title);
                        }}
                        onRemove={() => removeFromHistory(item.id)}
                        onMarkCompleted={() => markAsCompleted(item.content_type, item.content_id)}
                      />
                    </ContentCarouselItem>
                  ))}
                </ContentCarousel>
              )}

              {/* Recent Activity & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp size={20} />
                      <span>Recent Activity</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {continueWatching.length === 0 && completedItems.length === 0 ? (
                      <div className="text-center py-8">
                        <Play size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No recent activity</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Start watching content to see your activity here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[...continueWatching.slice(0, 3), ...completedItems.slice(0, 2)].map((item) => (
                          <div key={item.id} className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50">
                            <div className="w-12 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded flex items-center justify-center">
                              <Play size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.completed ? 'Completed' : `${Math.round(item.progress)}% watched`}
                              </p>
                            </div>
                            <Badge variant={item.completed ? 'default' : 'outline'}>
                              {item.completed ? 'Done' : 'In Progress'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        const profileTab = document.querySelector('[value="profile"]') as HTMLButtonElement;
                        profileTab?.click();
                      }}
                    >
                      <User size={16} className="mr-2" />
                      Edit Profile
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        const favoritesTab = document.querySelector('[value="favorites"]') as HTMLButtonElement;
                        favoritesTab?.click();
                      }}
                    >
                      <Heart size={16} className="mr-2" />
                      My List ({stats.totalFavorites})
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        const historyTab = document.querySelector('[value="history"]') as HTMLButtonElement;
                        historyTab?.click();
                      }}
                    >
                      <Clock size={16} className="mr-2" />
                      Watch History
                    </Button>
                    
                    <Link to="/">
                      <Button className="w-full">
                        <Play size={16} className="mr-2" />
                        Browse Content
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations Based on Preferences */}
              {preferences?.preferred_genres && preferences.preferred_genres.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Star size={20} />
                      <span>Recommended for You</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Based on your preferred genres: {preferences.preferred_genres.join(', ')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Personalized recommendations will appear here as content is added to the platform.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Personal Information</CardTitle>
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit size={16} className="mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                      >
                        <X size={16} className="mr-2" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveProfile}
                      >
                        <Save size={16} className="mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      {isEditing ? (
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {profile?.first_name || 'Not set'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      {isEditing ? (
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {profile?.last_name || 'Not set'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone_number">Phone Number</Label>
                      {isEditing ? (
                        <Input
                          id="phone_number"
                          value={formData.phone_number}
                          onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {profile?.phone_number || 'Not set'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      {isEditing ? (
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {profile?.country || 'Not set'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      {isEditing ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !formData.date_of_birth && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.date_of_birth ? format(formData.date_of_birth, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.date_of_birth || undefined}
                              onSelect={(date) => setFormData({ ...formData, date_of_birth: date || null })}
                              disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {profile?.date_of_birth 
                            ? format(new Date(profile.date_of_birth), "PPP")
                            : 'Not set'
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences">
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <select
                      value={preferencesData.preferred_language}
                      onChange={(e) => setPreferencesData({ ...preferencesData, preferred_language: e.target.value })}
                      className="w-full p-2 border rounded-md"
                    >
                      {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Genres</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {availableGenres.map((genre) => (
                        <label key={genre} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={preferencesData.preferred_genres.includes(genre)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPreferencesData({
                                  ...preferencesData,
                                  preferred_genres: [...preferencesData.preferred_genres, genre]
                                });
                              } else {
                                setPreferencesData({
                                  ...preferencesData,
                                  preferred_genres: preferencesData.preferred_genres.filter(g => g !== genre)
                                });
                              }
                            }}
                          />
                          <span className="text-sm">{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label>Notification Settings</Label>
                    
                    <label className="flex items-center justify-between">
                      <span>Email Notifications</span>
                      <input
                        type="checkbox"
                        checked={preferencesData.email_notifications}
                        onChange={(e) => setPreferencesData({ ...preferencesData, email_notifications: e.target.checked })}
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span>Push Notifications</span>
                      <input
                        type="checkbox"
                        checked={preferencesData.push_notifications}
                        onChange={(e) => setPreferencesData({ ...preferencesData, push_notifications: e.target.checked })}
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span>Auto-play next episode</span>
                      <input
                        type="checkbox"
                        checked={preferencesData.auto_play}
                        onChange={(e) => setPreferencesData({ ...preferencesData, auto_play: e.target.checked })}
                      />
                    </label>
                  </div>

                  <Button onClick={handleSavePreferences} className="w-full">
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="favorites">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Heart size={20} />
                      <span>My Favorites ({favorites.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {favorites.length === 0 ? (
                      <div className="text-center py-12">
                        <Heart size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Your favorite content will appear here</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Start adding movies and shows to your favorites to see them here
                        </p>
                        <Link to="/">
                          <Button className="mt-4">
                            Browse Content
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {favorites.map((favorite) => (
                          <Card key={favorite.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                              {favorite.thumbnail_url ? (
                                <img 
                                  src={favorite.thumbnail_url} 
                                  alt={favorite.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play size={32} className="text-white/60" />
                                </div>
                              )}
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold truncate">{favorite.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {favorite.genre || 'No genre'} • {favorite.price ? `₦${favorite.price}` : 'Free'}
                              </p>
                              {favorite.duration && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {Math.round(favorite.duration / 60)} min
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-6">
                {/* Continue Watching Section */}
                {continueWatching.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Play size={20} />
                        <span>Continue Watching ({continueWatching.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {continueWatching.map((item) => (
                          <WatchProgressCard
                            key={item.id}
                            item={item}
                            onPlay={() => console.log('Playing:', item.title)}
                            onRemove={() => removeFromHistory(item.id)}
                            onMarkCompleted={() => markAsCompleted(item.content_type, item.content_id)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Completed Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <History size={20} />
                      <span>Watch History ({completedItems.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {completedItems.length === 0 ? (
                      <div className="text-center py-12">
                        <History size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Your watch history will appear here</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Start watching content to see your viewing history
                        </p>
                        <Link to="/">
                          <Button className="mt-4">
                            Browse Content
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedItems.map((item) => (
                          <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                            <div className="w-16 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded flex items-center justify-center">
                              <Play size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{item.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                Completed • {item.last_watched_at && formatDistanceToNow(new Date(item.last_watched_at), { addSuffix: true })}
                              </p>
                              {item.duration && (
                                <p className="text-xs text-muted-foreground">
                                  {Math.round(item.duration / 60)} minutes
                                </p>
                              )}
                            </div>
                            <Badge variant="default">
                              Completed
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Profile;