import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Users, UserCheck, ClipboardList, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SupportPanel() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    openTickets: 0,
    newUsers7d: 0,
    pendingProducers: 0,
    pendingApplications: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const iso = sevenDaysAgo.toISOString();

        const [tickets, users7d, producers, jobApps, allUsers] = await Promise.all([
          supabase.from('tickets' as any).select('*', { count: 'exact', head: true }).neq('status', 'closed').then((r: any) => r).catch(() => ({ count: 0 })),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', iso),
          supabase.from('producers').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          openTickets: (tickets as any).count ?? 0,
          newUsers7d: users7d.count ?? 0,
          pendingProducers: producers.count ?? 0,
          pendingApplications: jobApps.count ?? 0,
          totalUsers: allUsers.count ?? 0,
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
    { title: 'Open Tickets', value: stats.openTickets.toLocaleString(), icon: AlertCircle, desc: 'Tickets needing response' },
    { title: 'New Users (7d)', value: stats.newUsers7d.toLocaleString(), icon: Users, desc: 'Signups in last 7 days' },
    { title: 'Pending Producers', value: stats.pendingProducers.toLocaleString(), icon: UserCheck, desc: 'Producer applications to review' },
    { title: 'Job Applications', value: stats.pendingApplications.toLocaleString(), icon: ClipboardList, desc: 'New applications waiting' },
    { title: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: Briefcase, desc: 'All-time platform users' },
  ];

  return (
    <div className="flex flex-1 flex-col space-y-8 p-4 sm:p-6 lg:p-8 min-h-screen gradient-hero">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Support Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">Welcome back, {profile?.name || 'team'} — here's where users need you.</p>
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