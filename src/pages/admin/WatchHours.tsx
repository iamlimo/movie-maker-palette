import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Download, ShieldCheck, Sparkles, User2, ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/priceUtils";
import { calculateWatchRewardProgress, formatMinutesToReadable } from "@/lib/watchHours";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: syncError } = await (supabase as any).rpc("sync_all_user_watch_hour_totals");
      if (syncError && !["42883", "PGRST202"].includes(syncError.code)) throw syncError;

      const batchSize = 1000;
      const profileRows: ProfileRow[] = [];
      const totalsRows: TotalsRow[] = [];

      for (let offset = 0; ; offset += batchSize) {
        const result = await (supabase as any)
          .from("profiles")
          .select("user_id,name,email")
          .range(offset, offset + batchSize - 1)
          .order("user_id", { ascending: true });
        if (result.error) throw result.error;
        const batch = (result.data || []) as ProfileRow[];
        profileRows.push(...batch);
        if (batch.length < batchSize) break;
      }

      for (let offset = 0; ; offset += batchSize) {
        const result = await (supabase as any)
          .from("user_watch_hour_totals")
          .select("*")
          .range(offset, offset + batchSize - 1)
          .order("total_eligible_minutes", { ascending: false });
        if (result.error) throw result.error;
        const batch = (result.data || []) as TotalsRow[];
        totalsRows.push(...batch);
        if (batch.length < batchSize) break;
      }

      const profileMap = Object.fromEntries(profileRows.map((item) => [item.user_id, item]));
      const totalsByUser = new Map(totalsRows.map((item) => [item.user_id, item]));

      const allRows = profileRows.map((profile) => totalsByUser.get(profile.user_id) || {
        user_id: profile.user_id,
        total_eligible_minutes: 0,
        credited_reward_minutes: 0,
        pending_reward_minutes: 0,
        pending_reward_value_kobo: 0,
        completed_reward_blocks: 0,
        remaining_minutes: 0,
        last_watched_at: null,
        status: "in_progress",
      });

      totalsRows.forEach((totals) => {
        if (!profileMap[totals.user_id]) {
          profileMap[totals.user_id] = {
            user_id: totals.user_id,
            name: null,
            email: null,
          };
          allRows.push(totals);
        }
      });

      allRows.sort((a, b) => Number(b.total_eligible_minutes || 0) - Number(a.total_eligible_minutes || 0));
      setProfiles(profileMap);
      setRows(allRows);
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

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const profile = profiles[row.user_id];
      const pendingValue = Number(row.pending_reward_value_kobo || 0);
      const hasActivity = Number(row.total_eligible_minutes || 0) > 0;
      const status = row.status || (pendingValue > 0 ? "pending_review" : "in_progress");

      const matchesSearch = !needle || [profile?.name || "", profile?.email || "", row.user_id]
        .some((value) => value.toLowerCase().includes(needle));

      const matchesStatus = statusFilter === "all"
        || (statusFilter === "pending_review" && status === "pending_review")
        || (statusFilter === "in_progress" && status !== "pending_review")
        || (statusFilter === "credited" && Number(row.credited_reward_minutes || 0) > 0);

      const matchesActivity = activityFilter === "all"
        || (activityFilter === "active" && hasActivity)
        || (activityFilter === "inactive" && !hasActivity);

      return matchesSearch && matchesStatus && matchesActivity;
    });
  }, [rows, profiles, searchTerm, statusFilter, activityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, activityFilter, pageSize]);

  const exportCsv = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Name", "Email", "User ID", "Total Eligible Minutes", "Credited Reward Minutes",
      "Pending Reward Minutes", "Pending Value Kobo", "Completed Reward Blocks",
      "Remaining Minutes", "Status", "Last Watched",
    ];

    const csvRows = filteredRows.map((row) => {
      const profile = profiles[row.user_id];
      const progress = calculateWatchRewardProgress(Number(row.total_eligible_minutes || 0), Number(row.credited_reward_minutes || 0));
      return [
        profile?.name || "Unknown user",
        profile?.email || "",
        row.user_id,
        row.total_eligible_minutes,
        row.credited_reward_minutes,
        progress.pendingRewardMinutes,
        row.pending_reward_value_kobo,
        progress.completedRewardBlocks,
        row.remaining_minutes,
        row.status || "in_progress",
        row.last_watched_at || "",
      ].map(escapeCsv).join(",");
    });

    const csv = `\uFEFF${headers.map(escapeCsv).join(",")}\n${csvRows.join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `watch-hours-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={loading || filteredRows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
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
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, email, or user ID..."
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending_review">Pending review</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="credited">Credited</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="active">Watched activity</SelectItem>
                <SelectItem value="inactive">No activity</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter !== "all" || activityFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setActivityFilter("all");
                }}
              >
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
          </div>

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
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-muted-foreground text-center">No watch-hour records yet.</td>
                    </tr>
                  ) : paginatedRows.map((row) => {
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

          {!loading && filteredRows.length > 0 && (
            <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filteredRows.length)} of {filteredRows.length}
              </p>

              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-20 text-center text-sm text-muted-foreground">
                  Page {safePage} / {totalPages}
                </span>
                <Button variant="outline" size="icon" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
