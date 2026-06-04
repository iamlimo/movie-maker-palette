import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Tag, ShoppingCart, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const formatNaira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesPanel() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    totalRevenue: 0,
    activeReferralCodes: 0,
    rentalsThisMonth: 0,
    newUsersThisMonth: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const iso = startOfMonth.toISOString();

        const [allPay, monthPay, refCodes, rentals, users] = await Promise.all([
          supabase.from('payments').select('amount').eq('status', 'completed'),
          supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', iso),
          supabase.from('referral_codes').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('rentals').select('*', { count: 'exact', head: true }).gte('created_at', iso),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', iso),
        ]);

        const sum = (rows: any[] | null) =>
          (rows ?? []).reduce((s, r: any) => s + (typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount || 0), 0);

        setStats({
          totalRevenue: sum(allPay.data as any[]),
          monthlyRevenue: sum(monthPay.data as any[]),
          activeReferralCodes: refCodes.count ?? 0,
          rentalsThisMonth: rentals.count ?? 0,
          newUsersThisMonth: users.count ?? 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6 lg:p-8">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const cards = [
    { title: 'Monthly Revenue', value: formatNaira(stats.monthlyRevenue), icon: TrendingUp, desc: 'Revenue this month' },
    { title: 'Total Revenue', value: formatNaira(stats.totalRevenue), icon: DollarSign, desc: 'All-time revenue' },
    { title: 'Rentals This Month', value: stats.rentalsThisMonth.toLocaleString(), icon: ShoppingCart, desc: 'New rentals MTD' },
    { title: 'New Users (MTD)', value: stats.newUsersThisMonth.toLocaleString(), icon: Users, desc: 'New signups this month' },
    { title: 'Active Referral Codes', value: stats.activeReferralCodes.toLocaleString(), icon: Tag, desc: 'Live promo codes' },
  ];

  return (
    <div className="flex flex-1 flex-col space-y-8 p-4 sm:p-6 lg:p-8 min-h-screen gradient-hero">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Sales Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">Welcome back, {profile?.name || 'team'} — here's how sales are trending.</p>
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