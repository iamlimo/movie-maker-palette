import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Wallet, ArrowDownToLine, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const formatNaira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountingPanel() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    queuedPayouts: 0,
    queuedPayoutsAmount: 0,
    anomalies: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const iso = startOfMonth.toISOString();

        const [allPay, monthPay, payouts, anomalies] = await Promise.all([
          supabase.from('payments').select('amount').eq('status', 'completed'),
          supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', iso),
          supabase.from('payouts').select('amount, status').eq('status', 'queued'),
          supabase.from('payment_anomalies').select('*', { count: 'exact', head: true }).eq('resolved', false),
        ]);

        const sum = (rows: any[] | null) =>
          (rows ?? []).reduce((s, r: any) => s + (typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount || 0), 0);

        setStats({
          totalRevenue: sum(allPay.data as any[]),
          monthlyRevenue: sum(monthPay.data as any[]),
          queuedPayouts: (payouts.data ?? []).length,
          queuedPayoutsAmount: sum(payouts.data as any[]),
          anomalies: anomalies.count ?? 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6 lg:p-8">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const cards = [
    { title: 'Total Revenue', value: formatNaira(stats.totalRevenue), icon: DollarSign, desc: 'All-time completed payments' },
    { title: 'Monthly Revenue', value: formatNaira(stats.monthlyRevenue), icon: DollarSign, desc: 'Revenue this month' },
    { title: 'Queued Payouts', value: stats.queuedPayouts.toLocaleString(), icon: ArrowDownToLine, desc: `Pending: ${formatNaira(stats.queuedPayoutsAmount)}` },
    { title: 'Open Anomalies', value: stats.anomalies.toLocaleString(), icon: AlertCircle, desc: 'Unresolved payment anomalies' },
    { title: 'Finance Audit', value: 'Available', icon: ShieldCheck, desc: 'Audit trail in Settings → Audit Logs' },
  ];

  return (
    <div className="flex flex-1 flex-col space-y-8 p-4 sm:p-6 lg:p-8 min-h-screen gradient-hero">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Accounting Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">Welcome back, {profile?.name || 'team'} — financial overview at a glance.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title} className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                <div className="text-3xl font-bold text-foreground">{c.value}</div>
              </div>
              <div className="p-3 rounded-xl bg-primary/10"><c.icon className="h-6 w-6 text-primary" /></div>
            </CardHeader>
            <CardContent><CardDescription>{c.desc}</CardDescription></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}