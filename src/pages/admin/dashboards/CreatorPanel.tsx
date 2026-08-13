import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  Film,
  Tv,
  Clapperboard,
  Building2,
  BarChart3,
  Wallet,
  Receipt,
  Eye,
  Users,
  RefreshCw,
  Lock,
} from "lucide-react";

type Summary = {
  titles: number;
  total_revenue: number;
  rentals_count: number;
  revenue_30d: number;
  rentals_30d: number;
  views: number;
  active_access: number;
};

type CreatorDashboard = {
  has_profile: boolean;
  profile?: {
    id: string;
    display_name: string;
    company_name: string | null;
    creator_type: string | null;
    status: string | null;
    email: string;
  };
  content?: { content_type: string; id: string; title: string }[];
  summary?: Summary;
  by_title?: { title: string; rental_type: string; rentals: number; revenue: number }[];
  daily?: { day: string; revenue: number; rentals: number }[];
  recent?: {
    id: string;
    title: string;
    rental_type: string;
    payment_method: string | null;
    price: number;
    paid_at: string | null;
  }[];
};

const TYPE_META: Record<string, { label: string; icon: typeof Film }> = {
  movie: { label: "Movie", icon: Film },
  tv_show: { label: "TV Series", icon: Tv },
  episode: { label: "Episode", icon: Clapperboard },
};

const naira = (kobo: number) =>
  `₦${((Number(kobo) || 0) / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Film;
}) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function CreatorPanel() {
  const [data, setData] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase as any).rpc("get_creator_dashboard");
    if (error) {
      console.error("[CreatorPanel] get_creator_dashboard error:", error);
      setData({ has_profile: false });
      return;
    }
    setData(result as CreatorDashboard);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const summary = data?.summary;
  const content = data?.content ?? [];
  const byTitle = data?.by_title ?? [];
  const daily = data?.daily ?? [];
  const recent = data?.recent ?? [];

  const counts = useMemo(
    () =>
      content.reduce<Record<string, number>>((acc, row) => {
        acc[row.content_type] = (acc[row.content_type] ?? 0) + 1;
        return acc;
      }, {}),
    [content],
  );

  const maxDaily = useMemo(
    () => Math.max(1, ...daily.map((d) => Number(d.revenue) || 0)),
    [daily],
  );
  const maxTitleRevenue = useMemo(
    () => Math.max(1, ...byTitle.map((t) => Number(t.revenue) || 0)),
    [byTitle],
  );

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!data?.has_profile || !data.profile) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Creator dashboard</CardTitle>
            <CardDescription>
              No creator profile is linked to this account yet. Please contact the Signature TV team.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const profile = data.profile;

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome, {profile.display_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {profile.company_name ?? "—"}
            </span>
            <Badge variant="secondary">{profile.creator_type ?? "creator"}</Badge>
            <Badge variant={profile.status === "active" ? "default" : "outline"}>
              {profile.status === "active" ? "Active" : "Pending activation"}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assigned titles"
          value={String(summary?.titles ?? 0)}
          hint={`${counts.movie ?? 0} movies · ${counts.tv_show ?? 0} series · ${counts.episode ?? 0} episodes`}
          icon={Film}
        />
        <StatCard
          label="Total revenue"
          value={naira(summary?.total_revenue ?? 0)}
          hint={`${naira(summary?.revenue_30d ?? 0)} in the last 30 days`}
          icon={Wallet}
        />
        <StatCard
          label="Rentals"
          value={String(summary?.rentals_count ?? 0)}
          hint={`${summary?.rentals_30d ?? 0} in the last 30 days`}
          icon={Receipt}
        />
        <StatCard
          label="Active viewers"
          value={String(summary?.active_access ?? 0)}
          hint={`${summary?.views ?? 0} recorded views`}
          icon={Users}
        />
      </div>

      <Tabs defaultValue="content" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="content" className="gap-2">
            <Film className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-2">
            <Wallet className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="rentals" className="gap-2">
            <Receipt className="h-4 w-4" />
            Rentals
          </TabsTrigger>
        </TabsList>

        {/* Assigned content */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My catalogue</CardTitle>
              <CardDescription>
                Titles mapped to you by the Signature TV team. Viewing only — content is managed by the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {content.length === 0 && (
                <p className="text-sm text-muted-foreground">No titles mapped to you yet.</p>
              )}
              {content.map((row) => {
                const meta = TYPE_META[row.content_type];
                const Icon = meta?.icon ?? Film;
                return (
                  <div
                    key={`${row.content_type}-${row.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{row.title}</span>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {meta?.label ?? row.content_type}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Creator accounts are read-only: you can review performance for your own titles but cannot edit platform content or view other creators' data.
          </p>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Last 30 days</CardTitle>
              <CardDescription>Daily rental revenue across your titles.</CardDescription>
            </CardHeader>
            <CardContent>
              {daily.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rental activity in the last 30 days.</p>
              ) : (
                <div className="flex h-48 items-end gap-1.5">
                  {daily.map((d) => {
                    const height = Math.max(4, ((Number(d.revenue) || 0) / maxDaily) * 100);
                    return (
                      <div key={d.day} className="group relative flex-1">
                        <div
                          className="w-full rounded-t-sm bg-primary/70 transition-all duration-300 group-hover:bg-primary"
                          style={{ height: `${height}%` }}
                        />
                        <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                          {dateLabel(d.day)} · {naira(d.revenue)} · {d.rentals} rentals
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Views" value={String(summary?.views ?? 0)} icon={Eye} />
            <StatCard
              label="Rentals / title"
              value={
                summary && summary.titles > 0
                  ? (summary.rentals_count / summary.titles).toFixed(1)
                  : "0"
              }
              icon={BarChart3}
            />
            <StatCard
              label="Avg. rental value"
              value={
                summary && summary.rentals_count > 0
                  ? naira(summary.total_revenue / summary.rentals_count)
                  : naira(0)
              }
              icon={Wallet}
            />
          </div>
        </TabsContent>

        {/* Revenue */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by title</CardTitle>
              <CardDescription>Gross rental revenue attributed to your content only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {byTitle.length === 0 && (
                <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
              )}
              {byTitle.map((row) => (
                <div key={`${row.title}-${row.rental_type}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{row.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {naira(row.revenue)} · {row.rentals} rentals
                    </span>
                  </div>
                  <Progress value={((Number(row.revenue) || 0) / maxTitleRevenue) * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rentals */}
        <TabsContent value="rentals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent rentals</CardTitle>
              <CardDescription>
                Your 25 most recent paid rentals. Customer identities are not shared.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground">No rentals yet.</p>
              )}
              {recent.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateLabel(row.paid_at)} · {row.rental_type}
                      {row.payment_method ? ` · ${row.payment_method}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{naira(row.price)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
