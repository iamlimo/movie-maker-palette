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
import { Copy, Gift, Share2, Users, Trophy, Clock, Sparkles } from "lucide-react";

type Referral = { id: string; status: string; referrer_id: string; referrer_reward: number; created_at: string };
type Voucher = { id: string; amount: number; status: string; expires_at: string };

const SITE = "https://movie-maker-palette.lovable.app";

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
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const db = supabase as any;
    const [c, r, v] = await Promise.all([
      db.rpc("get_my_referral_code"),
      db.from("user_referrals").select("id,status,referrer_id,referrer_reward,created_at").eq("referrer_id", user.id),
      db.from("reward_vouchers").select("id,amount,status,expires_at").eq("user_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()).order("expires_at"),
    ]);
    setCode(c.data ?? null);
    setReferrals(r.data ?? []);
    setVouchers(v.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const link = code ? `${SITE}/auth?mode=signup&ref=${code}` : "";
  const shareText = `Join me on Signature TV! Sign up with my code ${code} and we both get ₦200 after your first rental. ${link}`;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${label} copied` }); }
    catch { toast({ title: "Couldn't copy", variant: "destructive" }); }
  };

  const share = async () => {
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
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Invite friends, earn ₦200</CardTitle>
                <CardDescription>When a friend signs up with your code and makes their first paid rental, you both get ₦200 in your wallets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? <Skeleton className="h-14 w-full" /> : (
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="flex-1 rounded-lg border border-border bg-background/60 px-4 py-3 font-mono text-xl tracking-widest text-foreground text-center sm:text-left">
                      {code}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => copy(code!, "Code")}><Copy className="h-4 w-4 mr-2" />Code</Button>
                      <Button variant="outline" onClick={() => copy(link, "Link")}><Copy className="h-4 w-4 mr-2" />Link</Button>
                      <Button onClick={share}><Share2 className="h-4 w-4 mr-2" />Share</Button>
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

            <Card>
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
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Rewards;
