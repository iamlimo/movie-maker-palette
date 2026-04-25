import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ProfileSidebar } from '@/components/ui/sidebar-profile';
import { PinnedContent } from '@/components/PinnedContent';
import { WalletWidget } from '@/components/wallet/WalletWidget';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { ProfileImagePicker } from '@/components/ProfileImagePicker';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlatform } from '@/hooks/usePlatform';
import { 
  CalendarIcon, 
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
  LogOut,
  Eye,
  Star,
  TrendingUp,
  RefreshCw,
  Wallet,
  Menu,
  Shield,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useToast } from '@/hooks/use-toast';
import { useFavorites } from '@/hooks/useFavorites';
import { useRentals } from '@/hooks/useRentals';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import ContentCarousel, { ContentCarouselItem } from '@/components/ContentCarousel';
import WatchProgressCard from '@/components/WatchProgressCard';
import ActiveRentalCard from '@/components/ActiveRentalCard';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { profile, preferences, loading: profileLoading, updateProfile, updatePreferences, uploadProfileImage, refetch: refetchProfile } = useProfile();
  const { continueWatching, completedItems, watchHistory, loading: historyLoading, updateWatchProgress, removeFromHistory, markAsCompleted, refetch: refetchHistory } = useWatchHistory();
  const { favorites, loading: favoritesLoading, refetch: refetchFavorites } = useFavorites();
  const { activeRentals, formatTimeRemaining, fetchRentals } = useRentals();
  const { isIOS } = usePlatform();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      console.error("Sign out failed:", error);
      toast({
        title: "Sign out failed",
        description: "There was an error signing you out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigningOut(false);
    }
  };
  const { isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        refetchProfile?.(),
        refetchHistory?.(),
        refetchFavorites?.(),
        fetchRentals?.(),
      ]);
    },
    enabled: isMobile,
  });
  
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

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    const result = await uploadProfileImage(file);
    setIsUploadingImage(false);
    return result;
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

  const handleContinueWatching = (contentType: 'movie' | 'episode', contentId: string) => {
    navigate(`/watch/${contentType}/${contentId}`);
  };

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
        {/* Pull-to-refresh indicator */}
        {isRefreshing && isMobile && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Refreshing...</span>
          </div>
        )}
        
        {/* Enhanced Header */}
        <div className="gradient-hero py-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-6 lg:space-y-0">
              <div className="flex items-center space-x-6">
                <ProfileImagePicker
                  currentImageUrl={profile?.profile_image_url}
                  userName={profile?.first_name && profile?.last_name 
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile?.name || user?.email}
                  onImageSelected={handleImageUpload}
                  isUploading={isUploadingImage}
                />
                <div className="text-white">
                  <h1 className="text-2xl lg:text-3xl font-bold">
                    {profile?.first_name && profile?.last_name 
                      ? `${profile.first_name} ${profile.last_name}`
                      : profile?.name || user?.email
                    }
                  </h1>
                  <p className="text-white/80 mt-1">{user?.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-white border-white/30 bg-white/10">
                      {profile?.status || 'Active'}
                    </Badge>
                    <Badge variant="outline" className="text-white border-white/30 bg-white/10">
                      Member {stats.joinedDate 
                        ? formatDistanceToNow(stats.joinedDate, { addSuffix: true })
                        : 'Recently'
                      }
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="lg:hidden text-white hover:bg-white/10"
                >
                  <Menu size={18} />
                </Button>
                <div className="hidden lg:block w-72">
                  <WalletWidget />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content with Sidebar */}
        <div className="flex">
          {/* Sidebar */}
          <div className={cn(
            "fixed inset-y-0 left-0 z-50 bg-background border-r border-border transition-transform duration-300 lg:relative lg:translate-x-0",
            sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
          )}>
            <ProfileSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isCollapsed={false}
              onToggleCollapse={() => setSidebarCollapsed(true)}
              className="h-full"
            />
          </div>

          {/* Overlay for mobile */}
          {!sidebarCollapsed && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarCollapsed(true)}
            />
          )}

          {/* Main Content */}
          <div className="flex-1 container mx-auto px-4 py-8" role="main">
            <div className="space-y-6">

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-slide-in-up">
                {/* Minimal Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-6">
                  <div className="flex flex-col items-center p-2 md:p-4">
                    <Eye className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs md:text-sm text-muted-foreground">Watched</span>
                    <span className="font-semibold text-lg md:text-2xl">{stats.totalWatched}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 md:p-4">
                    <Heart className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs md:text-sm text-muted-foreground">Favorites</span>
                    <span className="font-semibold text-lg md:text-2xl">{stats.totalFavorites}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 md:p-4">
                    <Play className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs md:text-sm text-muted-foreground">Continue</span>
                    <span className="font-semibold text-lg md:text-2xl">{stats.continueWatchingCount}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 md:p-4">
                    <Star className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs md:text-sm text-muted-foreground">Watch Time</span>
                    <span className="font-semibold text-lg md:text-2xl">{Math.round(watchHistory.reduce((acc, item) => acc + (item.duration || 0) * (item.progress / 100), 0) / 60)}h</span>
                  </div>
                </div>

                {/* Continue Watching - Responsive Carousel */}
                {continueWatching.length > 0 && (
                  <div>
                    <ContentCarousel 
                      title="Continue Watching" 
                      subtitle="Pick up where you left off"
                      className="mb-2"
                    >
                      {continueWatching.slice(0, 6).map((item) => (
                        <ContentCarouselItem key={item.id} minWidth="220px" className="max-w-xs w-full">
                          <WatchProgressCard
                            item={item}
                            onPlay={() => handleContinueWatching(item.content_type, item.content_id)}
                            onRemove={() => removeFromHistory(item.id)}
                            onMarkCompleted={() => markAsCompleted(item.content_type, item.content_id)}
                          />
                        </ContentCarouselItem>
                      ))}
                    </ContentCarousel>
                  </div>
                )}

                {/* Recent Activity - Minimal */}
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2"><TrendingUp size={18}/>Recent Activity</h3>
                  {continueWatching.length === 0 && completedItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Play size={32} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">No recent activity</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {[...continueWatching.slice(0, 2), ...completedItems.slice(0, 2)].map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded bg-secondary/50">
                          <Play size={14} className="text-muted-foreground" />
                          <span className="truncate flex-1 text-sm">{item.title}</span>
                          <Badge variant={item.completed ? 'default' : 'outline'} className="text-xs">
                            {item.completed ? 'Done' : `${Math.round(item.progress)}%`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Actions - Minimal */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 justify-center"
                    onClick={() => setActiveTab('profile')}
                  >
                    <User size={16} className="mr-2" />
                    Edit Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 justify-center"
                    onClick={() => setActiveTab('favorites')}
                  >
                    <Heart size={16} className="mr-2" />
                    My List
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 justify-center"
                    onClick={() => setActiveTab('history')}
                  >
                    <Clock size={16} className="mr-2" />
                    Watch History
                  </Button>
                  <Link to="/" className="flex-1">
                    <Button className="w-full justify-center">
                      <Play size={16} className="mr-2" />
                      Browse
                    </Button>
                  </Link>
                </div>

                {/* Recommendations - Minimal Placeholder */}
                {preferences?.preferred_genres && preferences.preferred_genres.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2"><Star size={18}/>Recommended for You</h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      Based on your preferences: {preferences.preferred_genres.join(', ')}
                    </p>
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg flex items-center justify-center">
                      <p className="text-muted-foreground text-xs">Recommendations coming soon</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* My Rentals Tab */}
            {activeTab === 'rentals' && (
              <div className="space-y-6 animate-slide-in-up">
                <Card className="card-hover">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Play size={20} />
                      <span>My Rentals</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Manage your active movie and TV show rentals
                    </p>
                  </CardHeader>
                  <CardContent>
                    {activeRentals.length === 0 ? (
                      <div className="text-center py-12">
                        <Play size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No active rentals</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Rent movies and TV shows to see them here
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeRentals.map((rental) => (
                          <ActiveRentalCard
                            key={rental.id}
                            rental={rental}
                            formatTimeRemaining={formatTimeRemaining}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Personal Info Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-slide-in-up">
              <Card className="card-hover">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <User size={20} />
                    <span>Personal Information</span>
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? (
                      <>
                        <X size={16} className="mr-2" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit size={16} className="mr-2" />
                        Edit
                      </>
                    )}
                  </Button>
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
                          placeholder="Enter your first name"
                        />
                      ) : (
                        <p className="text-foreground p-2 bg-secondary/50 rounded">
                          {formData.first_name || 'Not provided'}
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
                          placeholder="Enter your last name"
                        />
                      ) : (
                        <p className="text-foreground p-2 bg-secondary/50 rounded">
                          {formData.last_name || 'Not provided'}
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
                          placeholder="Enter your phone number"
                        />
                      ) : (
                        <p className="text-foreground p-2 bg-secondary/50 rounded">
                          {formData.phone_number || 'Not provided'}
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
                          placeholder="Enter your country"
                        />
                      ) : (
                        <p className="text-foreground p-2 bg-secondary/50 rounded">
                          {formData.country || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
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
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={formData.date_of_birth}
                              onSelect={(date) => setFormData({ ...formData, date_of_birth: date })}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <p className="text-foreground p-2 bg-secondary/50 rounded">
                          {formData.date_of_birth 
                            ? format(formData.date_of_birth, "PPP")
                            : 'Not provided'
                          }
                        </p>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveProfile}>
                        <Save size={16} className="mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-slide-in-up">
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings size={20} />
                    <span>App Preferences</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Preferred Language</Label>
                      <select
                        value={preferencesData.preferred_language}
                        onChange={(e) => setPreferencesData({ ...preferencesData, preferred_language: e.target.value })}
                        className="w-full p-2 border rounded-md bg-background"
                        aria-label="Preferred language"
                        title="Preferred language"
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
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {availableGenres.map((genre) => (
                          <label key={genre} className="flex items-center space-x-2 cursor-pointer">
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
                              className="rounded"
                            />
                            <span className="text-sm">{genre}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-medium">Notification Settings</h4>
                      
                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Email Notifications</span>
                        <input
                          type="checkbox"
                          checked={preferencesData.email_notifications}
                          onChange={(e) => setPreferencesData({ ...preferencesData, email_notifications: e.target.checked })}
                          className="rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Push Notifications</span>
                        <input
                          type="checkbox"
                          checked={preferencesData.push_notifications}
                          onChange={(e) => setPreferencesData({ ...preferencesData, push_notifications: e.target.checked })}
                          className="rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Auto Play</span>
                        <input
                          type="checkbox"
                          checked={preferencesData.auto_play}
                          onChange={(e) => setPreferencesData({ ...preferencesData, auto_play: e.target.checked })}
                          className="rounded"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSavePreferences}>
                      <Save size={16} className="mr-2" />
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
              </div>
            )}

            {/* My Content Tab */}
            {activeTab === 'favorites' && (
              <PinnedContent />
            )}

            {/* Watch History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6 animate-slide-in-up">
              {/* Continue Watching Section */}
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Play size={20} />
                    <span>Continue Watching</span>
                    <Badge variant="secondary">{continueWatching.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {continueWatching.length === 0 ? (
                    <div className="text-center py-8">
                      <Play size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nothing to continue watching</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Start watching content to see your progress here
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {continueWatching.map((item) => (
                        <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative">
                            <Play size={24} className="text-muted-foreground" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <Progress value={item.progress} className="h-1" />
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.round(item.progress)}% complete • {item.content_type}
                            </p>
                            <div className="flex justify-between items-center mt-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => removeFromHistory(item.id)}
                              >
                                Remove
                              </Button>
                              <Button size="sm" onClick={() => handleContinueWatching(item.content_type, item.content_id)}>
                                <Play size={12} className="mr-1" />
                                Continue
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Section */}
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye size={20} />
                    <span>Completed</span>
                    <Badge variant="secondary">{completedItems.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {completedItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Eye size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No completed content yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Finish watching content to see it here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {completedItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors">
                          <div className="w-12 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded flex items-center justify-center">
                            <Eye size={12} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Completed • {item.content_type}
                            </p>
                          </div>
                          <Badge variant="default">
                            <Star size={12} className="mr-1" />
                            Finished
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6 animate-slide-in-up">
                {/* Account Security */}
                <Card className="card-hover">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield size={20} />
                      <span>Account Security</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">Email Address</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                      <Badge variant="outline">Verified</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">Last changed: Unknown</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Change Password
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                      </div>
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Sign Out Section */}
                <Card className="card-hover">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <LogOut size={20} />
                      <span>Sign Out</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">Log out of your account</p>
                        <p className="text-sm text-muted-foreground">You will need to sign in again to access your content.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <LogOut size={16} className="mr-2" />
                        {isSigningOut ? "Signing Out..." : "Sign Out"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {isIOS && (
                  <Card className="card-hover border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-sm">
                        <Info size={16} />
                        <span>About This App</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Video rentals are purchased outside of the iOS app. 
                        This app provides access to content already rented by users.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Danger Zone */}
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-destructive">
                      <AlertTriangle size={20} />
                      <span>Danger Zone</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <h4 className="font-medium text-destructive mb-2">Delete Account</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <DeleteAccountDialog walletBalance={profile?.wallet_balance || 0} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Profile;
