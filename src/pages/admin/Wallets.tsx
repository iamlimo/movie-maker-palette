import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Wallet as WalletIcon, DollarSign, TrendingUp, Users, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import WalletAdjustmentModal from '@/components/admin/WalletAdjustmentModal';
import { formatNaira } from '@/lib/priceUtils';

interface UserWallet {
  user_id: string;
  wallet_id: string;
  balance: number;
  name: string;
  email: string;
  updated_at: string | null;
  has_wallet: boolean;
}

const PAGE_SIZES = [25, 50, 100];

export default function Wallets() {
  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ totalUsers: 0, totalBalance: 0, avgBalance: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Debounce search so typing stays smooth
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('profiles')
        .select('user_id, name, email, created_at, wallets!left(wallet_id, balance, updated_at)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (debouncedSearch) {
        const safe = debouncedSearch.replace(/[%_,()]/g, ' ');
        query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count || 0);

      const rows = (data || []).map((row: any) => {
        const wallet = Array.isArray(row.wallets) ? row.wallets[0] : row.wallets;
        return {
          user_id: row.user_id,
          wallet_id: wallet?.wallet_id || '',
          balance: wallet?.balance ?? 0,
          name: row.name || 'Unknown',
          email: row.email || 'Unknown',
          updated_at: wallet?.updated_at || null,
          has_wallet: !!wallet,
        };
      });

      setWallets(rows);
    } catch (error: any) {
      console.error('Error fetching wallets:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load wallets',
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, toast]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Platform-wide stats: fetched in chunks so every wallet is counted
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if (countError) throw countError;

      let totalBalance = 0;
      const CHUNK = 1000;
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from('wallets')
          .select('balance')
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        totalBalance += data.reduce((sum, w) => sum + (w.balance || 0), 0);
        if (data.length < CHUNK) break;
      }

      const totalUsers = count || 0;
      setStats({
        totalUsers,
        totalBalance,
        avgBalance: totalUsers > 0 ? totalBalance / totalUsers : 0,
      });
    } catch (error: any) {
      console.error('Error fetching wallet stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refreshAll = () => {
    fetchWallets();
    fetchStats();
  };

  // Windowed page numbers: 1 … (p-1) p (p+1) … last
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxButtons = 5;
    if (totalPages <= maxButtons + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const handleAdjustment = (wallet: UserWallet) => {
    setSelectedWallet(wallet);
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustmentSuccess = () => {
    refreshAll();
    setIsAdjustmentModalOpen(false);
    setSelectedWallet(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Wallet Management
          </h1>
          <p className="text-muted-foreground">
            View and manage every user wallet on the platform
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} className="gap-2 self-start">
          <RefreshCw className={`h-4 w-4 ${loading || statsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Platform Balance</CardTitle>
              <div className="text-3xl font-bold text-foreground">
                {statsLoading ? '…' : formatNaira(stats.totalBalance)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Balance</CardTitle>
              <div className="text-3xl font-bold text-foreground">
                {statsLoading ? '…' : formatNaira(stats.avgBalance)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-accent/10">
              <TrendingUp className="h-6 w-6 text-accent" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <div className="text-3xl font-bold text-foreground">
                {statsLoading ? '…' : stats.totalUsers.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/10">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Wallets Table */}
      <Card className="border-0 shadow-card bg-card/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle>User Wallets</CardTitle>
              <CardDescription>
                All {statsLoading ? '' : `${stats.totalUsers.toLocaleString()} `}user wallets, searchable across the full database
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/5">
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell colSpan={5}>
                        <div className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  wallets.map((wallet) => (
                    <TableRow key={wallet.user_id} className="hover:bg-muted/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {wallet.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="font-medium">{wallet.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{wallet.email}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-lg">
                          {wallet.has_wallet ? formatNaira(wallet.balance) : 'No wallet'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {wallet.updated_at ? new Date(wallet.updated_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!wallet.has_wallet}
                          onClick={() => handleAdjustment(wallet)}
                        >
                          <WalletIcon className="h-4 w-4 mr-2" />
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && wallets.length === 0 && (
            <div className="text-center py-12">
              <WalletIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No wallets found</h3>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch ? 'Try adjusting your search criteria' : 'No user wallets available'}
              </p>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  Showing <span className="font-medium text-foreground">{from}</span>–
                  <span className="font-medium text-foreground">{to}</span> of{' '}
                  <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>
                </p>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  aria-label="First page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="mx-2 flex items-center gap-1">
                  {pageNumbers.map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="icon"
                        className={`h-9 w-9 text-sm ${p === page ? 'pointer-events-none' : ''}`}
                        onClick={() => setPage(p)}
                        aria-label={`Page ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                  aria-label="Last page"
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjustment Modal */}
      {selectedWallet && (
        <WalletAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => {
            setIsAdjustmentModalOpen(false);
            setSelectedWallet(null);
          }}
          userId={selectedWallet.user_id}
          userName={selectedWallet.name}
          currentBalance={selectedWallet.balance}
          onSuccess={handleAdjustmentSuccess}
        />
      )}
    </div>
  );
}
