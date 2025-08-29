import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Users, Film, Tv, UserCheck, DollarSign, TrendingUp, Calendar, Clock, Eye } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch users stats
        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch producers stats
        const { count: totalProducers } = await supabase
          .from('producers')
          .select('*', { count: 'exact', head: true });

        const { count: pendingProducers } = await supabase
          .from('producers')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch content stats
        const { count: totalMovies } = await supabase
          .from('movies')
          .select('*', { count: 'exact', head: true });

        const { count: totalTvShows } = await supabase
          .from('tv_shows')
          .select('*', { count: 'exact', head: true });

        // Fetch revenue stats
        const { data: revenueData } = await supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed');

        const totalRevenue = revenueData?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;

        // Monthly revenue (current month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: monthlyRevenueData } = await supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed')
          .gte('transaction_date', startOfMonth.toISOString());

        const monthlyRevenue = monthlyRevenueData?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;

        setStats({
          totalUsers: totalUsers || 0,
          activeUsers: totalUsers || 0, // For now, consider all users as active
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
      value: `$${stats.totalRevenue.toFixed(2)}`,
      description: 'All-time revenue',
      icon: DollarSign,
      gradient: 'gradient-accent',
      trend: '+18%'
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats.monthlyRevenue.toFixed(2)}`,
      description: 'Current month',
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
            <div className="space-y-4">
              {[
                { type: 'user', message: 'New user registration', detail: 'A new user joined the platform', time: '2m ago', color: 'bg-emerald-500' },
                { type: 'content', message: 'Movie uploaded', detail: 'New movie added to catalog', time: '5m ago', color: 'bg-blue-500' },
                { type: 'producer', message: 'Producer application', detail: 'New producer submission pending review', time: '10m ago', color: 'bg-amber-500' },
                { type: 'payment', message: 'Payment processed', detail: 'Rental payment completed successfully', time: '15m ago', color: 'bg-purple-500' },
                { type: 'content', message: 'TV show approved', detail: 'Season 2 of "Drama Series" went live', time: '1h ago', color: 'bg-indigo-500' }
              ].map((activity, index) => (
                <div key={index} className="flex items-start space-x-4 p-3 rounded-lg hover:bg-muted/10 transition-colors">
                  <div className={cn("w-3 h-3 rounded-full mt-1.5", activity.color)} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.message}</p>
                    <p className="text-sm text-muted-foreground">{activity.detail}</p>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full">
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
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
                  <Tv className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Manage Content</div>
                  <div className="text-sm text-muted-foreground">View all movies & shows</div>
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