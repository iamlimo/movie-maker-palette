import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";
import { calculateWatchRewardProgress, formatMinutesToReadable } from "@/lib/watchHours";
import { Copy, Gift, Share2, Users, Trophy, Clock, Sparkles, PlayCircle } from "lucide-react";

type Referral = { id: string; status: string; referrer_id: string; referrer_reward: number; created_at: string };
type Voucher = { id: string; amount: number; status: string; expires_at: string };
type WatchHourTotals = {
  user_id: string;
  total_eligible_minutes: number;
  credited_reward_minutes: number;
  pending_reward_minutes: number;
  pending_reward_value_kobo: number;
  credited_reward_value_kobo: number;
  completed_reward_blocks: number;
  remaining_minutes: number;
  last_watched_at: string | null;
  status: string;
};

const SITE = typeof window !== "undefined" ? window.location.origin : "https://signaturetv.co";

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
};

const Rewards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [watchTotals, setWatchTotals] = useState<WatchHourTotals | null>(null);
  const [watchHoursLoading, setWatchHoursLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const db = supabase as any;
    const [c, r, v] = await Promise.all([
      db.rpc("get_my_referral_code"),
      db
        .from("user_referrals")
        .select("id,status,referrer_id,referred_id,referrer_reward,created_at")
        .or(`referrer_id.eq.${user.id},referred_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      db.from("reward_vouchers").select("id,amount,status,expires_at").eq("user_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()).order("expires_at"),
    ]);
    setCode(c.data ?? null);
    setReferrals(r.data ?? []);
    setVouchers(v.data ?? []);
    setLoading(false);
  }, [user]);

  const loadWatchHours = useCallback(async () => {
    if (!user) {
      setWatchTotals(null);
      return;
    }

    setWatchHoursLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("user_watch_hour_totals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setWatchTotals(data ?? null);
    } catch (error) {
      console.error("Failed to load watch-hour totals", error);
      setWatchTotals(null);
    } finally {
      setWatchHoursLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); loadWatchHours(); }, [load, loadWatchHours]);

  const hasCode = Boolean(code && code.trim());
  const link = hasCode ? `${SITE}/auth?mode=signup&ref=${encodeURIComponent(code!)}` : "";
  const shareText = hasCode ? `Join me on Signature TV! Sign up with my code ${code}. I earn ₦100 when your first paid rental is completed. ${link}` : "";

  const copy = async (text: string, label: string) => {
    if (!text) {
      toast({ title: `${label} isn't available yet`, variant: "destructive" });
      return;
    }

    try { await navigator.clipboard.writeText(text); toast({ title: `${label} copied` }); }
    catch { toast({ title: "Couldn't copy", variant: "destructive" }); }
  };

  const share = async () => {
    if (!hasCode || !shareText || !link) {
      toast({ title: "Your referral code isn't ready yet", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    if (navigator.share) {
      try { await navigator.share({ title: "Signature TV", text: shareText, url: link }); return; } catch { /* cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const claim = async (id: string) => {
    setClaiming(id);
    const { error } = await (supabase as any).rpc("claim_reward_voucher", { p_voucher_id: id });
    setClaiming(null);
    if (error) { toast({ title: "Couldn't claim", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reward added to your wallet 🎉" });
    load();
  };

  const qualified = referrals.filter((r) => r.status === "qualified");
  const earned = qualified.reduce((s, r) => s + Number(r.referrer_reward || 0), 0);
  const watchProgress = watchTotals
    ? calculateWatchRewardProgress(
        Number(watchTotals.total_eligible_minutes || 0),
        Number(watchTotals.credited_reward_minutes || 0),
      )
    : { totalEligibleMinutes: 0, creditedMinutes: 0, completedRewardBlocks: 0, pendingRewardMinutes: 0, pendingRewardValueKobo: 0, remainingEligibleMinutes: 0, totalRewardValueKobo: 0 };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-28 max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Gift className="h-7 w-7 text-primary" /> Deals & Rewards
          </h1>
          <p className="text-muted-foreground mt-1">Signature TV Gives Back — invite friends and earn wallet credit.</p>
        </div>

        {!user ? (
          <Card><CardContent className="py-10 text-center space-y-4">
            <p className="text-foreground">Sign in to get your personal referral code.</p>
            <Button asChild><Link to="/auth">Sign in</Link></Button>
          </CardContent></Card>
        ) : (
          <>
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Invite friends, earn ₦100</CardTitle>
                <CardDescription>When a friend signs up with your code and makes their first paid rental, you earn ₦100.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? <Skeleton className="h-14 w-full" /> : !hasCode ? (
                  <div className="rounded-lg border border-dashed border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                    Your referral code is still being prepared. Please wait a moment and refresh.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="flex-1 rounded-lg border border-border bg-background/60 px-4 py-3 font-mono text-xl tracking-widest text-foreground text-center sm:text-left">
                      {code}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => copy(code!, "Code")} disabled={!hasCode}><Copy className="h-4 w-4 mr-2" />Code</Button>
                      <Button variant="outline" onClick={() => copy(link, "Link")} disabled={!hasCode}><Copy className="h-4 w-4 mr-2" />Link</Button>
                      <Button onClick={share} disabled={!hasCode}><Share2 className="h-4 w-4 mr-2" />Share</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Users, label: "Friends invited", value: referrals.length },
                { icon: Trophy, label: "First rentals", value: qualified.length },
                { icon: Gift, label: "Bonus earned", value: formatNaira(earned) },
              ].map(({ icon: Icon, label, value }) => (
                <Card key={label}><CardContent className="p-4 text-center">
                  <Icon className="h-5 w-5 mx-auto text-primary mb-2" />
                  <div className="text-xl font-bold text-foreground">{loading ? "…" : value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </CardContent></Card>
              ))}
            </div>

            <Card className="border-primary/25 bg-gradient-to-br from-primary/5 via-background to-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-primary" /> Signature Watch Hours — Watch More. Earn More.</CardTitle>
                <CardDescription>Enjoy your favourite movies and TV shows on Signature TV. Earn ₦100 worth of Signature Credits for every 2hr block of eligible viewing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {watchHoursLoading ? <Skeleton className="h-12 w-full" /> : (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground uppercase tracking-[0.12em]">Eligible watch time (2hr target)</div>
                      <div className="mt-2 text-2xl font-bold">{formatMinutesToReadable(watchProgress.totalEligibleMinutes)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground uppercase tracking-[0.12em]">Completed blocks</div>
                      <div className="mt-2 text-2xl font-bold">{watchProgress.completedRewardBlocks}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground uppercase tracking-[0.12em]">Pending reward</div>
                      <div className="mt-2 text-2xl font-bold">{formatNaira(watchProgress.pendingRewardValueKobo)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground uppercase tracking-[0.12em]">Remaining</div>
                      <div className="mt-2 text-2xl font-bold">{formatMinutesToReadable(watchProgress.remainingEligibleMinutes)}</div>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Accumulated watch-hour rewards are recorded as pending until an authorised administrator manually credits them to your Signature Credits balance.
                </p>
              </CardContent>
            </Card>

            {/* <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Next-rental rewards</CardTitle>
                <CardDescription>Every paid rental earns you ₦150 credit, valid for 7 days. Claim it into your wallet before it expires.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? <Skeleton className="h-12 w-full" /> : vouchers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active rewards. Rent a title to unlock your next ₦150 reward.</p>
                ) : vouchers.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <div className="font-semibold text-foreground">{formatNaira(Number(v.amount))} reward</div>
                      <Badge variant="secondary" className="mt-1">{timeLeft(v.expires_at)}</Badge>
                    </div>
                    <Button size="sm" disabled={claiming === v.id} onClick={() => claim(v.id)}>
                      {claiming === v.id ? "Claiming…" : "Claim to wallet"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card> */}
          </>
        )}
      </main>
    </div>
  );
};

export default Rewards;
