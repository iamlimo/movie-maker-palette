import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatNaira } from '@/lib/priceUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Clock3, Gift, RefreshCw, Search, Users, WalletCards } from 'lucide-react';

type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string;
  code: string;
  status: string;
  qualifying_intent_id: string | null;
  referrer_reward: number;
  referred_reward: number;
  qualified_at: string | null;
  created_at: string;
};

type ProfileRow = { user_id: string; name: string; email: string };
type IntentRow = {
  id: string;
  status: string;
  price: number;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  paystack_reference: string | null;
};
type PayoutRow = { reference: string; user_id: string; amount: number; created_at: string };
type ReferralView = ReferralRow & {
  referrer: ProfileRow | null;
  referred: ProfileRow | null;
  qualifyingIntent: IntentRow | null;
  referrerPayout: PayoutRow | null;
  referredPayout: PayoutRow | null;
};

const PAGE_SIZE = 25;
const safeSearchText = (value: string) => value.trim().replace(/[,%()\\]/g, '').slice(0, 80);
const formatDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export default function ReferralTracking() {
  const [rows, setRows] = useState<ReferralView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [qualifiedTotal, setQualifiedTotal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(safeSearchText(search)), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    try {
      let matchingUserIds: string[] = [];
      if (searchTerm) {
        const profileResult = await db.from('profiles')
          .select('user_id')
          .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
          .limit(200);
        if (profileResult.error) throw profileResult.error;
        matchingUserIds = (profileResult.data ?? []).map((profile: { user_id: string }) => profile.user_id);
      }

      const applyFilters = (query: any) => {
        let filtered = query;
        if (status !== 'all') filtered = filtered.eq('status', status);
        if (fromDate) filtered = filtered.gte('created_at', new Date(`${fromDate}T00:00:00`).toISOString());
        if (toDate) filtered = filtered.lt('created_at', new Date(`${toDate}T00:00:00`).getTime() + 86400000
          ? new Date(new Date(`${toDate}T00:00:00`).getTime() + 86400000).toISOString()
          : new Date(`${toDate}T00:00:00`).toISOString());
        if (searchTerm) {
          const codeFilter = `code.ilike.%${searchTerm}%`;
          const idsFilter = matchingUserIds.length
            ? `,referrer_id.in.(${matchingUserIds.join(',')}),referred_id.in.(${matchingUserIds.join(',')})`
            : '';
          filtered = filtered.or(`${codeFilter}${idsFilter}`);
        }
        return filtered;
      };

      const [pageResult, pendingResult, qualifiedResult] = await Promise.all([
        applyFilters(db.from('user_referrals').select('*', { count: 'exact' }))
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
        applyFilters(db.from('user_referrals').select('id', { count: 'exact', head: true })).eq('status', 'pending'),
        applyFilters(db.from('user_referrals').select('id', { count: 'exact', head: true })).eq('status', 'qualified'),
      ]);
      if (pageResult.error) throw pageResult.error;
      if (pendingResult.error) throw pendingResult.error;
      if (qualifiedResult.error) throw qualifiedResult.error;

      const referrals = (pageResult.data ?? []) as ReferralRow[];
      setTotal(pageResult.count ?? 0);
      setPendingTotal(pendingResult.count ?? 0);
      setQualifiedTotal(qualifiedResult.count ?? 0);

      if (!referrals.length) {
        setRows([]);
        return;
      }

      const userIds = [...new Set(referrals.flatMap((referral) => [referral.referrer_id, referral.referred_id]))];
      const intentIds = referrals.flatMap((referral) => referral.qualifying_intent_id ? [referral.qualifying_intent_id] : []);
      const rewardReferences = referrals.flatMap((referral) => [
        `referral_reward:referrer:${referral.id}`,
        `referral_reward:referred:${referral.id}`,
      ]);
      const [profilesResult, intentsResult, payoutsResult] = await Promise.all([
        db.from('profiles').select('user_id,name,email').in('user_id', userIds),
        intentIds.length
          ? db.from('rental_intents').select('id,status,price,payment_method,paid_at,created_at,paystack_reference').in('id', intentIds)
          : Promise.resolve({ data: [], error: null }),
        db.from('wallet_transactions').select('reference,user_id,amount,created_at').in('reference', rewardReferences),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (intentsResult.error) throw intentsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;

      const profiles = new Map<string, ProfileRow>((profilesResult.data ?? []).map((profile: ProfileRow) => [profile.user_id, profile]));
      const intents = new Map<string, IntentRow>((intentsResult.data ?? []).map((intent: IntentRow) => [intent.id, intent]));
      const payouts = new Map<string, PayoutRow>((payoutsResult.data ?? []).map((payout: PayoutRow) => [payout.reference, payout]));

      setRows(referrals.map((referral) => ({
        ...referral,
        referrer: profiles.get(referral.referrer_id) ?? null,
        referred: profiles.get(referral.referred_id) ?? null,
        qualifyingIntent: referral.qualifying_intent_id ? intents.get(referral.qualifying_intent_id) ?? null : null,
        referrerPayout: payouts.get(`referral_reward:referrer:${referral.id}`) ?? null,
        referredPayout: payouts.get(`referral_reward:referred:${referral.id}`) ?? null,
      })));
    } catch (error) {
      console.error('Referral tracking load failed:', error);
      toast({ title: 'Could not load referral activity', description: 'Please refresh and try again.', variant: 'destructive' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, page, searchTerm, status, toDate]);

  useEffect(() => { void loadReferrals(); }, [loadReferrals]);

  const pageQualified = useMemo(() => rows.filter((row) => row.status === 'qualified').length, [rows]);
  const payoutStatus = (row: ReferralView) => {
    if (row.status !== 'qualified') return 'Not due';
    if (row.referrerPayout && row.referredPayout) return 'Paid to both';
    if (row.referrerPayout || row.referredPayout) return 'Partially recorded';
    return 'Not recorded';
  };

  const renderPayout = (payout: PayoutRow | null, reward: number, qualified: boolean) => {
    if (!qualified) return <Badge variant="outline">Not due</Badge>;
    if (payout) return (
      <span className="inline-flex flex-col gap-1 text-xs">
        <Badge variant="secondary" className="w-fit gap-1"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
        <span className="text-muted-foreground">{formatNaira(Number(payout.amount))} · {formatDate(payout.created_at)}</span>
      </span>
    );
    return <span className="inline-flex flex-col gap-1 text-xs"><Badge variant="destructive">Missing record</Badge><span className="text-muted-foreground">Expected {formatNaira(Number(reward))}</span></span>;
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Growth & rewards</p>
          <h1 className="text-2xl font-bold tracking-tight">Referral Tracking</h1>
          <p className="text-sm text-muted-foreground">Review invitations, first paid rentals, and both reward credits.</p>
        </div>
        <Button variant="outline" onClick={() => void loadReferrals()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matching referrals</CardTitle><Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? '—' : total.toLocaleString()}</div><p className="text-xs text-muted-foreground">For the selected filters</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting first rental</CardTitle><Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? '—' : pendingTotal.toLocaleString()}</div><p className="text-xs text-muted-foreground">Signups not yet qualified</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified rentals</CardTitle><WalletCards className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading ? '—' : qualifiedTotal.toLocaleString()}</div><p className="text-xs text-muted-foreground">{pageQualified} shown on this page</p></CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search name, email, or referral code" aria-label="Search referral records" />
        </div>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by referral status"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Awaiting rental</SelectItem><SelectItem value="qualified">Qualified</SelectItem></SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} className="w-full sm:w-40" aria-label="Signup date from" />
        <Input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); }} className="w-full sm:w-40" aria-label="Signup date through" />
        {(search || status !== 'all' || fromDate || toDate) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setSearchTerm(''); setStatus('all'); setFromDate(''); setToDate(''); setPage(0); }}>Clear filters</Button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signup</TableHead><TableHead>Referrer</TableHead><TableHead>Referral</TableHead>
                <TableHead>Qualifying rental</TableHead><TableHead>Referral status</TableHead>
                <TableHead>Referrer reward</TableHead><TableHead>New user reward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading referral activity…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No referral signups match these filters.</TableCell></TableRow>
              ) : rows.map((row) => {
                const qualified = row.status === 'qualified';
                const intent = row.qualifyingIntent;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{row.referred?.name || 'Profile unavailable'}</div>
                      <div className="text-xs text-muted-foreground">{row.referred?.email || row.referred_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDate(row.created_at)}</div>
                    </TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{row.referrer?.name || 'Profile unavailable'}</div>
                      <div className="text-xs text-muted-foreground">{row.referrer?.email || row.referrer_id}</div>
                    </TableCell>
                    <TableCell><code className="rounded bg-muted px-2 py-1 text-xs">{row.code}</code></TableCell>
                    <TableCell className="min-w-52">
                      {intent ? (
                        <div className="space-y-1">
                          <div className="font-medium">{formatNaira(Number(intent.price))} · {intent.payment_method}</div>
                          <Badge variant={intent.status === 'paid' ? 'secondary' : intent.status === 'pending' ? 'outline' : 'destructive'}>
                            {intent.status === 'paid' ? 'Paid' : intent.status === 'pending' ? 'Pending payment' : 'Failed'}
                          </Badge>
                          <div className="text-xs text-muted-foreground">{formatDate(intent.paid_at || intent.created_at)}</div>
                          {intent.paystack_reference && <div className="max-w-40 truncate font-mono text-xs text-muted-foreground">{intent.paystack_reference}</div>}
                        </div>
                      ) : <span className="text-sm text-muted-foreground">{qualified ? 'Rental detail unavailable' : 'No qualifying rental yet'}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={qualified ? 'secondary' : 'outline'}>{qualified ? 'Qualified' : 'Awaiting rental'}</Badge>
                      {row.qualified_at && <div className="mt-1 text-xs text-muted-foreground">{formatDate(row.qualified_at)}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">{payoutStatus(row)}</div>
                    </TableCell>
                    <TableCell>{renderPayout(row.referrerPayout, row.referrer_reward, qualified)}</TableCell>
                    <TableCell>{renderPayout(row.referredPayout, row.referred_reward, qualified)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'No records' : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}>Previous</Button>
          <span className="min-w-20 text-center text-sm text-muted-foreground">Page {page + 1} of {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page + 1 >= pageCount || loading}>Next</Button>
        </div>
      </div>
    </div>
  );
}