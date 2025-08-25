import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Users, Film, Tv, UserCheck, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      color: 'text-blue-500',
    },
    {
      title: 'Producers',
      value: stats.totalProducers.toLocaleString(),
      description: `${stats.pendingProducers} pending approval`,
      icon: UserCheck,
      color: 'text-green-500',
    },
    {
      title: 'Movies',
      value: stats.totalMovies.toLocaleString(),
      description: 'Total movies in catalog',
      icon: Film,
      color: 'text-purple-500',
    },
    {
      title: 'TV Shows',
      value: stats.totalTvShows.toLocaleString(),
      description: 'Total TV shows available',
      icon: Tv,
      color: 'text-orange-500',
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      description: 'All-time revenue',
      icon: DollarSign,
      color: 'text-emerald-500',
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats.monthlyRevenue.toFixed(2)}`,
      description: 'Current month',
      icon: BarChart3,
      color: 'text-yellow-500',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Dashboard Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard Overview</h1>
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => (
          <Card key={card.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={cn("h-5 w-5", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                {card.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-muted-foreground">New user registration</span>
                <span className="text-xs text-muted-foreground ml-auto">2 mins ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-sm text-muted-foreground">Movie uploaded</span>
                <span className="text-xs text-muted-foreground ml-auto">5 mins ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-muted-foreground">Producer application submitted</span>
                <span className="text-xs text-muted-foreground ml-auto">10 mins ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Film className="h-4 w-4 mr-2" />
              Upload New Movie
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <UserCheck className="h-4 w-4 mr-2" />
              Review Producer Applications
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Revenue Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}