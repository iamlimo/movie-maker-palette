import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Film,
  Tv,
  DollarSign,
  User,
  Calendar,
  RefreshCw,
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  SendIcon,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatNaira } from '@/lib/priceUtils';
import { useRole } from '@/hooks/useRole';
import { Navigate } from 'react-router-dom';

interface RentalRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  content_id: string;
  content_title: string;
  content_type: 'movie' | 'tv' | 'episode' | 'season';
  amount: number; // Amount in lowest denomination (kobo)
  status: 'active' | 'expired';
  created_at: string;
  expires_at: string;
  // Payment tracking fields
  payment_status?: 'pending' | 'completed' | 'failed' | 'disputed' | 'amount_mismatch';
  payment_channel?: string; // 'card', 'bank_transfer', 'ussd'
  paystack_reference?: string;
}

const statusConfig = {
  active: { label: 'Active', color: 'bg-green-100', textColor: 'text-green-800', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-gray-100', textColor: 'text-gray-800', icon: AlertCircle },
};

const paymentStatusConfig = {
  pending: { label: 'Pending', color: 'bg-blue-100', textColor: 'text-blue-800', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-100', textColor: 'text-green-800', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100', textColor: 'text-red-800', icon: XCircle },
  disputed: { label: 'Disputed', color: 'bg-orange-100', textColor: 'text-orange-800', icon: AlertCircle },
  amount_mismatch: { label: 'Amount Mismatch', color: 'bg-orange-100', textColor: 'text-orange-800', icon: AlertCircle },
};

const paymentMethodConfig = {
  wallet: { label: 'Wallet', badge: 'default' },
  paystack: { label: 'Paystack', badge: 'secondary' },
};

const paymentChannelConfig: Record<string, { label: string; icon: any }> = {
  card: { label: 'Debit/Credit Card', icon: '💳' },
  bank_transfer: { label: 'Bank Transfer', icon: '🏧' },
  ussd: { label: 'USSD', icon: '📱' },
};

export default function Rentals() {
  const { isSuperAdmin } = useRole();
  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [filteredRentals, setFilteredRentals] = useState<RentalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isSuperAdmin()) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const fetchRentals = async () => {
    setIsLoading(true);
    try {
      // Fetch rentals first (without relationship select)
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select('*')
        .order('created_at', { ascending: false });

      if (rentalsError) throw rentalsError;
      if (!rentalsData || rentalsData.length === 0) {
        setRentals([]);
        setFilteredRentals([]);
        setIsLoading(false);
        return;
      }

      // Extract unique user IDs and rental IDs
      const userIds = [...new Set(rentalsData.map(r => r.user_id))];
      const rentalIds = rentalsData.map(r => r.id);

      // Try to fetch payment data for all rentals (may not exist yet)
      let paymentMap = new Map();
      try {
        const { data: paymentData, error: paymentError } = await supabase
          .from('rental_payments')
          .select('rental_id, payment_status, payment_channel, paystack_reference, metadata')
          .in('rental_id', rentalIds);

        // If rental_payments table doesn't exist, continue without payment data
        if (paymentData) {
          paymentMap = new Map(
            paymentData.map(p => [p.rental_id, p])
          );
        } else if (paymentError) {
          // Log warning but continue - table may not be deployed yet
          console.warn('Notice: Payment data not available (rental_payments table may not be deployed yet)', paymentError?.message);
        }
      } catch (paymentError) {
        // Silently continue if payment fetch fails - table doesn't exist yet
        console.warn('Notice: Skipping payment data (rental_payments table not deployed yet)');
      }

      // Fetch profiles for all users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id -> profile for quick lookup
      const profileMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      const data = rentalsData;
      if (data && data.length > 0) {
        const movieIds = data
          .filter(r => r.content_type === 'movie')
          .map(r => r.content_id);
        const tvIds = data
          .filter(r => r.content_type === 'tv')
          .map(r => r.content_id);
        const episodeIds = data
          .filter(r => r.content_type === 'episode')
          .map(r => r.content_id);

        const [moviesData, tvShowsData, episodesData] = await Promise.all([
          movieIds.length > 0
            ? supabase
                .from('movies')
                .select('id, title')
                .in('id', movieIds)
            : Promise.resolve({ data: [] }),
          tvIds.length > 0
            ? supabase
                .from('tv_shows')
                .select('id, title')
                .in('id', tvIds)
            : Promise.resolve({ data: [] }),
          episodeIds.length > 0
            ? supabase
                .from('episodes')
                .select('id, title, season:season_id (tv_show:tv_show_id (title))')
                .in('id', episodeIds)
            : Promise.resolve({ data: [] }),
        ]);

        const titleMap = new Map<string, string>();

        moviesData.data?.forEach(m => {
          titleMap.set(`movie-${m.id}`, m.title);
        });

        tvShowsData.data?.forEach(tv => {
          titleMap.set(`tv-${tv.id}`, tv.title);
        });

        episodesData.data?.forEach(ep => {
          const seasonData = ep.season as any;
          const showData = seasonData?.tv_show as any;
          const showTitle = showData?.title || 'Unknown';
          titleMap.set(`episode-${ep.id}`, `${showTitle} - ${ep.title}`);
        });

        const formattedRentals: RentalRecord[] = data.map(rental => {
          // Get payment info from payment map (separate query result)
          const payment = paymentMap.get(rental.id);
          
          // Get user profile info from the map
          const userProfile = profileMap.get(rental.user_id);
          
          return {
            id: rental.id,
            user_id: rental.user_id,
            user_email: userProfile?.email || 'Unknown User',
            user_name: userProfile?.name || 'Unknown User',
            content_id: rental.content_id,
            content_title:
              titleMap.get(`${rental.content_type}-${rental.content_id}`) ||
              'Unknown Content',
            content_type: rental.content_type,
            amount: rental.amount || 0,
            status: rental.status,
            created_at: rental.created_at,
            expires_at: rental.expires_at,
            // Payment tracking fields
            payment_status: payment?.payment_status,
            payment_channel: payment?.payment_channel,
            paystack_reference: payment?.paystack_reference,
          };
        });

        setRentals(formattedRentals);
        setFilteredRentals(formattedRentals);
      }
    } catch (error) {
      console.error('Error fetching rentals:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rental data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncPaystackPayments = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-paystack-payments', {
        body: { action: 'sync_all' },
      });

      if (error) throw error;

      const { synced, anomalies_detected } = data;
      toast({
        title: 'Sync Complete',
        description: `${synced} payments synced. ${anomalies_detected} anomalies detected.`,
      });

      // Refresh the rentals data after sync
      await fetchRentals();
    } catch (error) {
      console.error('Error syncing payments:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync payments with Paystack',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchRentals();

    // Set up real-time subscription for rentals table changes
    const subscription = supabase
      .channel('rentals-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Subscribe to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'rentals',
        },
        payload => {
          console.log('Rental change detected:', payload);
          // Refresh the rentals data when changes occur
          fetchRentals();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let filtered = rentals;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.user_email.toLowerCase().includes(query) ||
          r.user_name.toLowerCase().includes(query) ||
          r.content_title.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Content type filter
    if (contentTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.content_type === contentTypeFilter);
    }

    // Payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(r => r.payment_status === paymentStatusFilter);
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(r => new Date(r.created_at) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.created_at) <= end);
    }

    setFilteredRentals(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, statusFilter, contentTypeFilter, paymentStatusFilter, startDate, endDate, rentals]);

  const calculateStats = () => {
    const total = rentals.length;
    const totalRevenue = rentals.reduce((sum, r) => sum + (r.amount || 0), 0);
    const active = rentals.filter(r => r.status === 'active').length;
    const expired = rentals.filter(r => r.status === 'expired').length;

    return {
      total,
      totalRevenue,
      active,
      expired,
      averagePrice: total > 0 ? totalRevenue / total : 0,
    };
  };

  const stats = calculateStats();

  const exportReport = () => {
    const csv = [
      ['Rental Tracking Report', new Date().toLocaleDateString()],
      [],
      ['Summary'],
      ['Total Rentals', stats.total],
      ['Total Revenue', formatNaira(stats.totalRevenue)],
      ['Expired Rentals', stats.expired],
      ['Active Rentals', stats.active],
      ['Average Price', formatNaira(stats.averagePrice)],
      [],
      ['Detailed Rentals'],
      [
        'User Name',
        'Email',
        'Content',
        'Type',
        'Status',
        'Payment Status',
        'Payment Channel',
        'Paystack Reference',
        'Amount',
        'Created',
        'Expires',
      ],
      ...filteredRentals.map(r => [
        r.user_name,
        r.user_email,
        r.content_title,
        r.content_type,
        r.status,
        r.payment_status || 'N/A',
        r.payment_channel || 'N/A',
        r.paystack_reference || 'N/A',
        formatNaira(r.amount || 0),
        new Date(r.created_at).toLocaleDateString(),
        new Date(r.expires_at).toLocaleDateString(),
      ]),
    ];

    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rental-tracking-${new Date().toISOString().split('T')[0]}.csv`;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rental Tracking</h1>
          <p className="text-muted-foreground">
            Monitor all rental transactions with detailed user and payment information
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Super Admin Only
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rentals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNaira(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">From all rentals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Active Rentals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNaira(stats.averagePrice)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per rental</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, email, or content..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="tv">TV Show</SelectItem>
                <SelectItem value="episode">Episode</SelectItem>
                <SelectItem value="season">Season</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Status</SelectItem>
                <SelectItem value="pending">Payment Pending</SelectItem>
                <SelectItem value="completed">Payment Completed</SelectItem>
                <SelectItem value="failed">Payment Failed</SelectItem>
                <SelectItem value="disputed">Payment Disputed</SelectItem>
                <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={fetchRentals}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Page Size</label>
              <Select value={pageSize.toString()} onValueChange={val => setPageSize(parseInt(val))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                variant="outline"
                className="w-full"
              >
                Clear Dates
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button 
              onClick={syncPaystackPayments}
              disabled={isSyncing}
              variant="secondary"
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <SendIcon className="h-4 w-4" />
                  Sync with Paystack
                </>
              )}
            </Button>
            <Button onClick={exportReport} variant="secondary">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rentals Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Rental Records ({filteredRentals.length} / {rentals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Payment Channel</TableHead>
                  <TableHead>Rental Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals.length > 0 ? (
                  filteredRentals
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map(rental => {
                    const statusInfo = statusConfig[rental.status] || statusConfig['pending'];
                    const StatusIcon = statusInfo?.icon || Clock;
                    const paymentStatusInfo = paymentStatusConfig[rental.payment_status || 'pending'] || paymentStatusConfig['pending'];
                    const PaymentStatusIcon = paymentStatusInfo?.icon || Clock;
                    const paymentChannelInfo = paymentChannelConfig[rental.payment_channel || ''] || null;

                    return (
                      <TableRow key={rental.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{rental.user_name}</span>
                            <span className="text-sm text-muted-foreground">
                              {rental.user_email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-start gap-2">
                            {rental.content_type === 'movie' ? (
                              <Film className="h-4 w-4 mt-1 flex-shrink-0" />
                            ) : (
                              <Tv className="h-4 w-4 mt-1 flex-shrink-0" />
                            )}
                            <span className="break-words">{rental.content_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rental.content_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatNaira(rental.amount || 0)}
                        </TableCell>
                        <TableCell>
                          {rental.payment_status ? (
                            <Badge
                              className={`${paymentStatusInfo.color} ${paymentStatusInfo.textColor} flex items-center gap-1 w-fit`}
                            >
                              <PaymentStatusIcon className="h-3 w-3" />
                              {paymentStatusInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {paymentChannelInfo ? (
                            <Badge variant="secondary">
                              {paymentChannelInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusInfo.color} ${statusInfo.textColor} flex items-center gap-1 w-fit`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(rental.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(rental.expires_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No rental records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filteredRentals.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredRentals.length)} to{' '}
                {Math.min(currentPage * pageSize, filteredRentals.length)} of {filteredRentals.length}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.ceil(filteredRentals.length / pageSize) })
                  .map((_, i) => i + 1)
                  .filter(page => {
                    const diff = Math.abs(page - currentPage);
                    return diff === 0 || diff === 1 || page === 1 || page === Math.ceil(filteredRentals.length / pageSize);
                  })
                  .map((page, idx, arr) => (
                    <div key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-2">...</span>}
                      <Button
                        onClick={() => setCurrentPage(page)}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                      >
                        {page}
                      </Button>
                    </div>
                  ))}
                <Button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRentals.length / pageSize), p + 1))}
                  disabled={currentPage === Math.ceil(filteredRentals.length / pageSize)}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
