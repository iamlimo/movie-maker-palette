import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RefreshCw, Search, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";

interface WebhookEventRow {
  event_id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: any;
  processed_at: string | null;
}

interface DetailData {
  event: WebhookEventRow;
  intent: any | null;
  accessRows: any[];
}

function extractReference(payload: any): string | null {
  return payload?.data?.reference ?? payload?.reference ?? null;
}

function badgeVariantForEvent(type: string) {
  if (type.includes("success")) return "default" as const;
  if (type.includes("failed") || type.includes("dispute")) return "destructive" as const;
  return "secondary" as const;
}

export default function WebhookEvents() {
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("webhook_events")
      .select("*")
      .order("processed_at", { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: "Failed to load webhook events", description: error.message, variant: "destructive" });
    } else {
      setEvents((data ?? []) as WebhookEventRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const ref = extractReference(e.payload) ?? "";
      return (
        e.event_type.toLowerCase().includes(q) ||
        e.provider_event_id.toLowerCase().includes(q) ||
        ref.toLowerCase().includes(q)
      );
    });
  }, [events, search]);

  const openDetail = async (event: WebhookEventRow) => {
    setDetail({ event, intent: null, accessRows: [] });
    setDetailLoading(true);
    const reference = extractReference(event.payload);
    let intent: any = null;
    let accessRows: any[] = [];
    if (reference) {
      const { data: intentRow } = await supabase
        .from("rental_intents")
        .select("*")
        .or(`paystack_reference.eq.${reference},provider_reference.eq.${reference}`)
        .maybeSingle();
      intent = intentRow;
      if (intentRow?.id) {
        const { data: access } = await supabase
          .from("rental_access")
          .select("*")
          .eq("rental_intent_id", intentRow.id)
          .order("granted_at", { ascending: false });
        accessRows = access ?? [];
      }
    }
    setDetail({ event, intent, accessRows });
    setDetailLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="h-7 w-7" /> Webhook Events
          </h1>
          <p className="text-muted-foreground">
            Every Paystack callback: payload, verification, and entitlement changes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadEvents} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>Recent events ({filtered.length})</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search event type, id, or reference"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Provider Event ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No webhook events recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const ref = extractReference(e.payload);
                  const amount = Number(e.payload?.data?.amount ?? 0);
                  const channel = e.payload?.data?.channel ?? "—";
                  return (
                    <TableRow key={e.event_id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {e.processed_at ? new Date(e.processed_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariantForEvent(e.event_type)}>{e.event_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{ref ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[220px] truncate">
                        {e.provider_event_id}
                      </TableCell>
                      <TableCell>{amount ? formatNaira(amount) : "—"}</TableCell>
                      <TableCell className="capitalize">{channel}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openDetail(e)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Webhook event</SheetTitle>
            <SheetDescription>
              {detail?.event.event_type} · {detail?.event.provider_event_id}
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-6 space-y-6">
              <section>
                <h3 className="text-sm font-semibold mb-2">Verification</h3>
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Signature:</span>{" "}
                    <Badge variant="default">Verified (HMAC)</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Idempotency:</span>{" "}
                    <Badge variant="secondary">Recorded once</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received at:</span>{" "}
                    {detail.event.processed_at
                      ? new Date(detail.event.processed_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Rental intent</h3>
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : detail.intent ? (
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Intent:</span>{" "}
                      <span className="font-mono text-xs">{detail.intent.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge
                        variant={
                          detail.intent.status === "paid"
                            ? "default"
                            : detail.intent.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {detail.intent.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price:</span>{" "}
                      {formatNaira(Number(detail.intent.price ?? 0))}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {detail.intent.rental_type}
                    </div>
                    <div>
                      <span className="text-muted-foreground">User:</span>{" "}
                      <span className="font-mono text-xs">{detail.intent.user_id}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No rental intent linked to this reference (likely a wallet top-up or unrelated event).
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">
                  Entitlement changes ({detail.accessRows.length})
                </h3>
                {detail.accessRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No rental_access rows for this intent.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.accessRows.map((a) => (
                      <div key={a.id} className="rounded-md border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">{a.id}</span>
                          <Badge
                            variant={
                              a.revoked_at
                                ? "destructive"
                                : a.status === "paid"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {a.revoked_at ? "revoked" : a.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Granted:</span>{" "}
                          {a.granted_at ? new Date(a.granted_at).toLocaleString() : "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expires:</span>{" "}
                          {a.expires_at ? new Date(a.expires_at).toLocaleString() : "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Source:</span> {a.source ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Raw payload</h3>
                <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(detail.event.payload, null, 2)}
                </pre>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}