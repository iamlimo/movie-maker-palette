import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Users, Film, Tv, UserCheck, DollarSign, TrendingUp, Calendar, Clock, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalProducers: number;
  pendingProducers: number;
  totalMovies: number;
  totalTvShows: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

interface Activity {
  id: string;
  type: 'user' | 'content' | 'producer' | 'payment' | 'rental' | 'system';
  message: string;
  detail: string;
  timestamp: string;
  color: string;
  metadata?: Record<string, any>;
}

// Helper function to convert kobo to naira
const koboToNaira = (kobo: number): number => {
  return kobo / 100;
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to format time difference
const timeAgo = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalProducers: 0,
    pendingProducers: 0,
    totalMovies: 0,
    totalTvShows: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Parallel queries for counts
        const [
          { count: totalUsers },
          { count: totalProducers },
          { count: pendingProducers },
          { count: totalMovies },
          { count: totalTvShows }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('producers').select('*', { count: 'exact', head: true }),
          supabase.from('producers').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('movies').select('*', { count: 'exact', head: true }),
          supabase.from('tv_shows').select('*', { count: 'exact', head: true })
        ]);

        // Fetch revenue data - convert from kobo to naira
        const [
          { data: revenueData, error: revenueError },
          { data: monthlyRevenueData, error: monthlyError }
        ] = await Promise.all([
          supabase
            .from('payments')
            .select('amount')
            .eq('status', 'completed'),
          (() => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            return supabase
              .from('payments')
              .select('amount')
              .eq('status', 'completed')
              .gte('created_at', startOfMonth.toISOString());
          })()
        ]);

        // Convert kobo to naira and sum up
        const totalRevenue = revenueData?.reduce((sum, payment) => {
          const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
          return sum + koboToNaira(amount);
        }, 0) || 0;

        const monthlyRevenue = monthlyRevenueData?.reduce((sum, payment) => {
          const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
          return sum + koboToNaira(amount);
        }, 0) || 0;

        setStats({
          totalUsers: totalUsers || 0,
          activeUsers: totalUsers || 0,
          totalProducers: totalProducers || 0,
          pendingProducers: pendingProducers || 0,
          totalMovies: totalMovies || 0,
          totalTvShows: totalTvShows || 0,
          totalRevenue,
          monthlyRevenue,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Fetch recent activities
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const activitiesList: Activity[] = [];

        // Fetch recent user registrations
        const { data: newUsers } = await supabase
          .from('profiles')
          .select('id, name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        newUsers?.forEach(user => {
          activitiesList.push({
            id: `user-${user.id}`,
            type: 'user',
            message: 'New user registration',
            detail: `${user.name || 'A user'} joined the platform`,
            timestamp: user.created_at,
            color: 'bg-emerald-500',
            metadata: { userId: user.id, userName: user.name }
          });
        });

        // Fetch recent movies/content uploads
        const { data: newMovies } = await supabase
          .from('movies')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        newMovies?.forEach(movie => {
          activitiesList.push({
            id: `movie-${movie.id}`,
            type: 'content',
            message: 'Movie uploaded',
            detail: `"${movie.title}" added to catalog`,
            timestamp: movie.created_at,
            color: 'bg-blue-500',
            metadata: { movieId: movie.id, title: movie.title }
          });
        });

        // Fetch recent TV shows
        const { data: newShows } = await supabase
          .from('tv_shows')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(2);

        newShows?.forEach(show => {
          activitiesList.push({
            id: `show-${show.id}`,
            type: 'content',
            message: 'TV show published',
            detail: `"${show.title}" went live`,
            timestamp: show.created_at,
            color: 'bg-indigo-500',
            metadata: { showId: show.id, title: show.title }
          });
        });

        // Fetch recent payments
        const { data: recentPayments } = await supabase
          .from('payments')
          .select('id, amount, payment_method, created_at, user_id')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(3);

        recentPayments?.forEach(payment => {
          const nairaAmount = koboToNaira(typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount);
          activitiesList.push({
            id: `payment-${payment.id}`,
            type: 'payment',
            message: 'Payment processed',
            detail: `${formatCurrency(nairaAmount)} payment via ${payment.payment_method || 'unknown method'}`,
            timestamp: payment.created_at,
            color: 'bg-purple-500',
            metadata: { amount: nairaAmount, method: payment.payment_method }
          });
        });

        // Fetch pending producer applications
        const { data: pendingProducers } = await supabase
          .from('producers')
          .select('id, full_name, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(2);

        pendingProducers?.forEach(producer => {
          activitiesList.push({
            id: `producer-${producer.id}`,
            type: 'producer',
            message: 'Producer application',
            detail: `${producer.full_name} submitted a producer application`,
            timestamp: producer.created_at,
            color: 'bg-amber-500',
            metadata: { producerId: producer.id, name: producer.full_name }
          });
        });

        // Sort by timestamp (most recent first) and limit to 10
        activitiesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivities(activitiesList.slice(0, 10));
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();

    // Auto-refresh activities every 30 seconds
    const interval = setInterval(fetchActivities, 30000);

    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      description: `${stats.activeUsers} active users`,
      icon: Users,
      gradient: 'gradient-accent',
      trend: '+12%'
    },
    {
      title: 'Producers',
      value: stats.totalProducers.toLocaleString(),
      description: `${stats.pendingProducers} pending approval`,
      icon: UserCheck,
      gradient: 'gradient-card',
      trend: '+8%'
    },
    {
      title: 'Movies',
      value: stats.totalMovies.toLocaleString(),
      description: 'Total movies in catalog',
      icon: Film,
      gradient: 'gradient-accent',
      trend: '+24%'
    },
    {
      title: 'TV Shows',
      value: stats.totalTvShows.toLocaleString(),
      description: 'Total TV shows available',
      icon: Tv,
      gradient: 'gradient-card',
      trend: '+16%'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      description: 'All-time revenue (in Naira)',
      icon: DollarSign,
      gradient: 'gradient-accent',
      trend: '+18%'
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(stats.monthlyRevenue),
      description: 'Current month (in Naira)',
      icon: TrendingUp,
      gradient: 'gradient-card',
      trend: '+25%'
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-1 flex-col space-y-8 p-4 sm:p-6 lg:p-8 min-h-screen gradient-hero">
        <div className="space-y-4">
          <div className="h-12 bg-muted/20 rounded-xl w-1/3 animate-pulse"></div>
          <div className="h-6 bg-muted/20 rounded-lg w-1/2 animate-pulse"></div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-card bg-card/50 backdrop-blur-sm">
              <CardHeader className="space-y-0 pb-3">
                <div className="h-5 bg-muted/30 rounded w-1/2"></div>
                <div className="h-10 bg-muted/30 rounded w-3/4 mt-3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-5 bg-muted/30 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-8 p-4 sm:p-6 lg:p-8 min-h-screen gradient-hero">
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Welcome back, {profile?.name || 'Admin'}!
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your streaming platform with precision and style
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center p-4 rounded-xl bg-card/50 backdrop-blur-sm border shadow-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last updated
            </div>
            <div className="text-sm font-medium">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card, index) => (
          <Card key={card.title} className={cn(
            "group relative overflow-hidden border-0 shadow-card hover:shadow-premium transition-all duration-300 hover:scale-105",
            "bg-card/50 backdrop-blur-sm",
            index % 2 === 0 ? card.gradient : 'bg-card'
          )}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-foreground">{card.value}</div>
                  <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {card.trend}
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <card.icon className="h-6 w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {card.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="lg:col-span-4 border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
                <CardDescription>Latest platform events and updates</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingActivities ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start space-x-4 p-3 rounded-lg animate-pulse">
                    <div className="w-3 h-3 rounded-full mt-1.5 bg-muted/30"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/30 rounded w-1/3"></div>
                      <div className="h-3 bg-muted/30 rounded w-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-lg hover:bg-muted/10 transition-colors">
                    <div className={cn("w-3 h-3 rounded-full mt-1.5", activity.color)} />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.message}</p>
                      <p className="text-sm text-muted-foreground">{activity.detail}</p>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full whitespace-nowrap">
                      {timeAgo(activity.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-full bg-muted/20 mb-4">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-3 border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
                <CardDescription>Essential administrative tasks</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/movies/add" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Film className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Upload New Movie</div>
                  <div className="text-sm text-muted-foreground">Add content to catalog</div>
                </div>
              </NavLink>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-accent/10 to-primary/10 hover:from-accent/20 hover:to-primary/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/tv-shows/add" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Tv className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Create TV Show</div>
                  <div className="text-sm text-muted-foreground">Add series to platform</div>
                </div>
              </NavLink>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-accent/10 to-primary/10 hover:from-accent/20 hover:to-primary/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/submissions" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <UserCheck className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Review Applications</div>
                  <div className="text-sm text-muted-foreground">Manage producer requests</div>
                </div>
              </NavLink>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/finance" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Revenue Report</div>
                  <div className="text-sm text-muted-foreground">View financial analytics</div>
                </div>
              </NavLink>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-accent/10 to-primary/10 hover:from-accent/20 hover:to-primary/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/movies" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Film className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Manage Movies</div>
                  <div className="text-sm text-muted-foreground">View and edit movies</div>
                </div>
              </NavLink>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/tv-shows" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Tv className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Manage TV Shows</div>
                  <div className="text-sm text-muted-foreground">View all series & episodes</div>
                </div>
              </NavLink>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-accent/10 to-primary/10 hover:from-accent/20 hover:to-primary/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/movies" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Film className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Manage Movies</div>
                  <div className="text-sm text-muted-foreground">View all movies</div>
                </div>
              </NavLink>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4 border-0 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all duration-300" 
              asChild
            >
              <NavLink to="/admin/users" className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Manage Users</div>
                  <div className="text-sm text-muted-foreground">Handle roles & permissions</div>
                </div>
              </NavLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}