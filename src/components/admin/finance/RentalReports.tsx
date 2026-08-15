import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  Film,
  Tv,
  TrendingUp,
  Users,
  RefreshCw,
  Download,
  Clock,
  Percent,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatNaira } from '@/lib/priceUtils';

interface RentalMetrics {
  totalRentals: number;
  totalRentalRevenue: number;
  averageRentalPrice: number;
  movieRentals: number;
  tvRentals: number;
  activeRentals: number;
  expiredRentals: number;
  rentalSuccessRate: number;
}

interface ContentRental {
  contentId: string;
  contentTitle: string;
  contentType: 'movie' | 'tv';
  rentalCount: number;
  totalRevenue: number;
  averagePrice: number;
}

interface RentalTrendData {
  date: string;
  rentals: number;
  revenue: number;
}

interface PaymentMethodData {
  name: string;
  value: number;
  count: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4de6c'];

export const RentalReports = () => {
  const [metrics, setMetrics] = useState<RentalMetrics>({
    totalRentals: 0,
    totalRentalRevenue: 0,
    averageRentalPrice: 0,
    movieRentals: 0,
    tvRentals: 0,
    activeRentals: 0,
    expiredRentals: 0,
    rentalSuccessRate: 0,
  });
  const [contentRentals, setContentRentals] = useState<ContentRental[]>([]);
  const [rentalTrends, setRentalTrends] = useState<RentalTrendData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  const fetchRentalMetrics = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const startDate = new Date();
      if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
      else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
      else if (timeRange === '90d') startDate.setDate(now.getDate() - 90);
      else startDate.setFullYear(now.getFullYear() - 1);

      // Canonical rental source: rental_intents + rental_access + titles
      const { data, error } = await supabase
        .from('v_admin_rental_records' as never)
        .select(
          'intent_id, content_id, content_type, content_title, amount, payment_method, payment_status, created_at, rental_status',
        )
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      const rows = ((data as unknown as any[]) || []).map((r) => ({
        intentId: r.intent_id as string,
        contentId: r.content_id as string,
        contentType: (r.content_type as string) || 'movie',
        title: (r.content_title as string) || 'Untitled',
        amount: Number(r.amount) || 0,
        method: (r.payment_method as string) || 'unknown',
        paymentStatus: (r.payment_status as string) || 'pending',
        rentalStatus: (r.rental_status as string) || 'none',
        createdAt: r.created_at as string,
      }));

      const paid = rows.filter((r) => r.paymentStatus === 'paid');
      const totalRevenue = paid.reduce((sum, r) => sum + r.amount, 0);
      const movieRentals = paid.filter((r) => r.contentType === 'movie').length;
      const tvRentals = paid.filter((r) => r.contentType === 'season' || r.contentType === 'episode').length;
      const activeRentals = paid.filter((r) => r.rentalStatus === 'active').length;
      const expiredRentals = paid.filter((r) => r.rentalStatus === 'expired').length;
      const successRate = rows.length > 0 ? (paid.length / rows.length) * 100 : 0;

      setMetrics({
        totalRentals: paid.length,
        totalRentalRevenue: totalRevenue,
        averageRentalPrice: paid.length > 0 ? totalRevenue / paid.length : 0,
        movieRentals,
        tvRentals,
        activeRentals,
        expiredRentals,
        rentalSuccessRate: Math.min(successRate, 100),
      });

      // Top rented content
      const contentMap = new Map<string, { title: string; type: 'movie' | 'tv'; count: number; revenue: number }>();
      for (const r of paid) {
        const type: 'movie' | 'tv' = r.contentType === 'movie' ? 'movie' : 'tv';
        const key = `${r.contentId}-${r.contentType}`;
        const existing = contentMap.get(key) || { title: r.title, type, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += r.amount;
        contentMap.set(key, existing);
      }

      setContentRentals(
        Array.from(contentMap.values())
          .map((d) => ({
            contentId: '',
            contentTitle: d.title,
            contentType: d.type,
            rentalCount: d.count,
            totalRevenue: d.revenue,
            averagePrice: d.revenue / d.count,
          }))
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 10),
      );

      // Trends
      const trendMap = new Map<string, { rentals: number; revenue: number }>();
      const dateRange = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86400000));
      for (let i = 0; i < dateRange; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        trendMap.set(date.toISOString().split('T')[0], { rentals: 0, revenue: 0 });
      }
      for (const r of paid) {
        const dateStr = r.createdAt.split('T')[0];
        const existing = trendMap.get(dateStr) || { rentals: 0, revenue: 0 };
        existing.rentals += 1;
        existing.revenue += r.amount;
        trendMap.set(dateStr, existing);
      }
      setRentalTrends(
        Array.from(trendMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rentals: d.rentals,
            revenue: d.revenue,
          })),
      );

      // Payment method breakdown
      const methodMap = new Map<string, { count: number; revenue: number }>();
      for (const r of paid) {
        const existing = methodMap.get(r.method) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += r.amount;
        methodMap.set(r.method, existing);
      }
      setPaymentMethods(
        Array.from(methodMap.entries()).map(([name, d]) => ({ name, value: d.revenue, count: d.count })),
      );
    } catch (error) {
      console.error('Error fetching rental metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rental data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRentalMetrics();
  }, [timeRange]);

  const exportReport = () => {
    const csv = [
      ['Rental Reports', new Date().toLocaleDateString()],
      [],
      ['Summary Metrics'],
      ['Total Rentals', metrics.totalRentals],
      ['Total Revenue', formatNaira(metrics.totalRentalRevenue)],
      ['Average Price', formatNaira(metrics.averageRentalPrice)],
      ['Movie Rentals', metrics.movieRentals],
      ['TV Rentals', metrics.tvRentals],
      ['Active Rentals', metrics.activeRentals],
      ['Expired Rentals', metrics.expiredRentals],
      ['Success Rate', `${metrics.rentalSuccessRate.toFixed(2)}%`],
      [],
      ['Top Rented Content'],
      ['Content Title', 'Type', 'Rental Count', 'Total Revenue', 'Avg Price'],
      ...contentRentals.map(c => [c.contentTitle, c.contentType, c.rentalCount, formatNaira(c.totalRevenue), formatNaira(c.averagePrice)]),
    ];

    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rental-reports-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Rental Reports</h2>
          <p className="text-muted-foreground">Comprehensive rental analytics and revenue tracking</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={fetchRentalMetrics} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Rentals
              <Film className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRentals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeRentals} active, {metrics.expiredRentals} expired
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Revenue
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNaira(metrics.totalRentalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatNaira(metrics.averageRentalPrice)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Content Types
              <Tv className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.movieRentals + metrics.tvRentals}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.movieRentals} movies, {metrics.tvRentals} TV
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Success Rate
              <Percent className="h-4 w-4 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.rentalSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(metrics.rentalSuccessRate * metrics.totalRentals / 100)} successful
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rental Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rental Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rentalTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="rentals"
                  stroke="#8884d8"
                  name="Rentals"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#82ca9d"
                  name="Revenue (₦)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Methods Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethods.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNaira(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Rented Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top 10 Rented Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rental Count</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentRentals.map((content, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{content.contentTitle}</TableCell>
                    <TableCell>
                      <Badge variant={content.contentType === 'movie' ? 'default' : 'secondary'}>
                        {content.contentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{content.rentalCount}</TableCell>
                    <TableCell className="text-right">
                      {formatNaira(content.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNaira(content.averagePrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
