import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Camera, Edit, Save, X, User, Settings, Heart, History } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';

const Profile = () => {
  const { user } = useAuth();
  const { profile, preferences, loading, updateProfile, updatePreferences, uploadProfileImage } = useProfile();
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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen gradient-hero flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="gradient-hero py-20">
          <div className="container mx-auto px-4">
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
                  {profile?.wallet_balance !== undefined && (
                    <Badge className="bg-green-500/20 text-green-300 border-green-300/30">
                      ₦{profile.wallet_balance.toLocaleString()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid grid-cols-4 w-full max-w-md">
              <TabsTrigger value="profile" className="flex items-center space-x-2">
                <User size={16} />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center space-x-2">
                <Settings size={16} />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex items-center space-x-2">
                <Heart size={16} />
                <span className="hidden sm:inline">Favorites</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <History size={16} />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>

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
              <Card>
                <CardHeader>
                  <CardTitle>Favorites & My List</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center py-8">
                    Your favorite content will appear here. Start browsing to add items to your list!
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Watch History</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center py-8">
                    Your watch history will appear here as you start watching content.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Profile;