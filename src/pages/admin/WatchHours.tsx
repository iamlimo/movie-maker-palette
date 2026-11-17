import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Download, ShieldCheck, Sparkles, User2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/priceUtils";
import { calculateWatchRewardProgress, formatMinutesToReadable } from "@/lib/watchHours";

type TotalsRow = {
  user_id: string;
  total_eligible_minutes: number;
  credited_reward_minutes: number;
  pending_reward_minutes: number;
  pending_reward_value_kobo: number;
  completed_reward_blocks: number;
  remaining_minutes: number;
  last_watched_at: string | null;
  status: string;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
  email: string | null;
};

export default function WatchHoursAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TotalsRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [totalsResult, profilesResult] = await Promise.all([
        (supabase as any).from("user_watch_hour_totals").select("*").order("total_eligible_minutes", { ascending: false }),
        (supabase as any).from("profiles").select("user_id,name,email"),
      ]);

      if (totalsResult.error) throw totalsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profileMap = Object.fromEntries((profilesResult.data || []).map((item: ProfileRow) => [item.user_id, item]));
      setProfiles(profileMap);
      setRows((totalsResult.data || []) as TotalsRow[]);
    } catch (error) {
      console.error("Failed to load watch hours data", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const summary = useMemo(() => {
    const totalEligible = rows.reduce((sum, row) => sum + Number(row.total_eligible_minutes || 0), 0);
    const totalPending = rows.reduce((sum, row) => sum + Number(row.pending_reward_value_kobo || 0), 0);
    const activeUsers = rows.filter((row) => Number(row.total_eligible_minutes || 0) > 0).length;
    return {
      totalEligible,
      totalPending,
      activeUsers,
    };
  }, [rows]);

  const issueReward = async (userId: string) => {
    if (!user) return;
    setIssuing(userId);
    try {
      const { data, error } = await (supabase as any).rpc("credit_user_watch_hours", {
        p_user_id: userId,
        p_admin_id: user.id,
        p_reference: `WATCH_HOURS_${Date.now()}`,
      });
      if (error) throw error;
      console.log("Issued reward", data);
      await load();
    } catch (error) {
      console.error("Failed to credit reward", error);
    } finally {
      setIssuing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Deals & Rewards</p>
          <h1 className="text-3xl font-semibold tracking-tight">Watch Hours & Rewards</h1>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total eligible watch time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutesToReadable(summary.totalEligible)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Users with eligible watch time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending reward value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNaira(summary.totalPending)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Watch-hour summary</CardTitle>
          <CardDescription>Each completed 2hr block is worth ₦100 in Signature Credits pending admin approval.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Total eligible</th>
                    <th className="p-3">Pending blocks</th>
                    <th className="p-3">Pending value</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last watched</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-muted-foreground text-center">No watch-hour records yet.</td>
                    </tr>
                  ) : rows.map((row) => {
                    const profile = profiles[row.user_id];
                    const progress = calculateWatchRewardProgress(Number(row.total_eligible_minutes || 0), Number(row.credited_reward_minutes || 0));
                    return (
                      <tr key={row.user_id} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="rounded-full bg-primary/10 p-2 text-primary"><User2 className="h-4 w-4" /></div>
                            <div>
                              <div className="font-medium">{profile?.name || "Unknown user"}</div>
                              <div className="text-xs text-muted-foreground">{profile?.email || row.user_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">{formatMinutesToReadable(Number(row.total_eligible_minutes || 0))}</td>
                        <td className="p-3">{progress.completedRewardBlocks}</td>
                        <td className="p-3">{formatNaira(Number(row.pending_reward_value_kobo || 0))}</td>
                        <td className="p-3">
                          <Badge variant={Number(row.pending_reward_value_kobo || 0) > 0 ? "secondary" : "outline"}>
                            {row.status || (Number(row.pending_reward_value_kobo || 0) > 0 ? "Pending review" : "In progress")}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {row.last_watched_at ? new Date(row.last_watched_at).toLocaleDateString() : "No activity"}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            disabled={Number(row.pending_reward_value_kobo || 0) === 0 || issuing === row.user_id}
                            onClick={() => issueReward(row.user_id)}
                          >
                            {issuing === row.user_id ? "Processing..." : "Credit"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-600" /> Review requirement</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Watch-hours rewards are recorded as pending value until an authorised admin approves and credits the Signature Credit balance.
        </CardContent>
      </Card>
    </div>
  );
}
