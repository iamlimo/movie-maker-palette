import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Clock, 
  Heart, 
  Play, 
  Calendar,
  Wallet,
  TrendingUp,
  Eye,
  Star
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useFavorites } from '@/hooks/useFavorites';
import ProtectedRoute from '@/components/ProtectedRoute';
import ContentCarousel, { ContentCarouselItem } from '@/components/ContentCarousel';
import WatchProgressCard from '@/components/WatchProgressCard';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();
  const { profile, preferences, loading: profileLoading } = useProfile();
  const { continueWatching, completedItems, loading: historyLoading, updateWatchProgress, removeFromHistory, markAsCompleted } = useWatchHistory();
  const { favorites, loading: favoritesLoading } = useFavorites();

  const getDashboardStats = () => {
    return {
      totalWatched: completedItems.length,
      totalFavorites: favorites.length,
      continueWatchingCount: continueWatching.length,
      joinedDate: profile?.created_at ? new Date(profile.created_at) : null
    };
  };

  const stats = getDashboardStats();

  if (profileLoading || historyLoading || favoritesLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen gradient-hero flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="gradient-hero py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16 border-2 border-white/20">
                  <AvatarImage src={profile?.profile_image_url} />
                  <AvatarFallback className="text-lg">
                    {profile?.first_name?.[0] || profile?.name?.[0] || user?.email?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-white">
                  <h1 className="text-2xl font-bold">
                    Welcome back, {profile?.first_name || profile?.name?.split(' ')[0] || 'User'}!
                  </h1>
                  <p className="text-white/80 mt-1">Ready to continue your journey?</p>
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

        {/* Dashboard Content */}
        <div className="container mx-auto px-4 py-8 space-y-8">
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
                  <Calendar className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">
                    {stats.joinedDate 
                      ? formatDistanceToNow(stats.joinedDate, { addSuffix: true })
                      : 'Recently'
                    }
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
                      // Handle play logic here
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
                <Link to="/profile">
                  <Button variant="outline" className="w-full justify-start">
                    <User size={16} className="mr-2" />
                    Edit Profile
                  </Button>
                </Link>
                
                <Link to="/my-list">
                  <Button variant="outline" className="w-full justify-start">
                    <Heart size={16} className="mr-2" />
                    My List ({stats.totalFavorites})
                  </Button>
                </Link>
                
                <Link to="/watch-history">
                  <Button variant="outline" className="w-full justify-start">
                    <Clock size={16} className="mr-2" />
                    Watch History
                  </Button>
                </Link>
                
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
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Dashboard;