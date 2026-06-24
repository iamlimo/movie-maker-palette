import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Bell, Send, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Target = "all" | "user";
type DeepLinkTarget = "home" | "movie" | "tvshow";

function safeJsonStringify(input: unknown): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return "{}";
  }
}

type ProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
};

type MovieRow = {
  id: string;
  title: string;
};

type TvShowRow = {
  id: string;
  title: string;
};

export default function PushNotifications() {
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // UI target uses email; edge function still needs target_user_id internally.
  const [target, setTarget] = useState<Target>("all");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedProfileUserId, setSelectedProfileUserId] = useState("");

  const [silent, setSilent] = useState(false);

  // Deep-link UX: friendly select + content pickers.
  const [deepLinkTarget, setDeepLinkTarget] =
    useState<DeepLinkTarget>("home");

  const [movies, setMovies] = useState<MovieRow[]>([]);
  const [movieLoading, setMovieLoading] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState("");

  const [tvShows, setTvShows] = useState<TvShowRow[]>([]);
  const [tvLoading, setTvLoading] = useState(false);
  const [selectedTvId, setSelectedTvId] = useState("");

  // edge function contract requires these:
  const targetScreenForEdge = useMemo(() => deepLinkTarget, [deepLinkTarget]);
  const entityIdForEdge = useMemo(() => {
    if (deepLinkTarget === "home") return "home";
    if (deepLinkTarget === "movie") return selectedMovieId;
    if (deepLinkTarget === "tvshow") return selectedTvId;
    return "";
  }, [deepLinkTarget, selectedMovieId, selectedTvId]);

  const [extraDataJson, setExtraDataJson] = useState<string>(
    safeJsonStringify({ origin: "admin-dashboard" }),
  );

  const [loading, setLoading] = useState(false);

  const parsedExtraData = useMemo(() => {
    if (!extraDataJson.trim()) return {};
    try {
      const v = JSON.parse(extraDataJson);
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      )
        return v as Record<string, unknown>;
      return {};
    } catch {
      return null;
    }
  }, [extraDataJson]);

  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const email = (p.email ?? "").toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      return email.includes(q) || name.includes(q);
    });
  }, [profiles, userSearch]);

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    entityIdForEdge.trim().length > 0 &&
    parsedExtraData !== null &&
    (target === "all" ||
      (target === "user" && selectedProfileUserId.trim().length > 0)) &&
    !profilesLoading &&
    !movieLoading &&
    !tvLoading;

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setProfilesLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, user_id, name, email")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        const rows = (data ?? []).map((row: unknown) => {
          const r = row as Partial<{
            id?: unknown;
            user_id?: unknown;
            name?: unknown;
            email?: unknown;
          }>;

          const id = r.id;
          const userId = r.user_id ?? r.id;

          return {
            id: String(id),
            user_id: String(userId),
            name: typeof r.name === "string" ? r.name : null,
            email: typeof r.email === "string" ? r.email : null,
          };
        }) as ProfileRow[];

        setProfiles(rows);
      } catch (err) {
        console.error("Failed to load profiles:", err);
      } finally {
        setProfilesLoading(false);
      }
    };

    void loadProfiles();
  }, []);

  const loadMovies = async () => {
    if (movieLoading) return;
    try {
      setMovieLoading(true);
      const { data, error } = await supabase
        .from("movies")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setMovies((data ?? []) as MovieRow[]);
    } catch (err) {
      console.error("Failed to load movies:", err);
    } finally {
      setMovieLoading(false);
    }
  };

  const loadTvShows = async () => {
    if (tvLoading) return;
    try {
      setTvLoading(true);
      const { data, error } = await supabase
        .from("tv_shows")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setTvShows((data ?? []) as TvShowRow[]);
    } catch (err) {
      console.error("Failed to load tv shows:", err);
    } finally {
      setTvLoading(false);
    }
  };

  useEffect(() => {
    setSelectedMovieId("");
    setSelectedTvId("");
    if (deepLinkTarget === "movie" && movies.length === 0) void loadMovies();
    if (deepLinkTarget === "tvshow" && tvShows.length === 0) void loadTvShows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTarget]);

  const handleSend = async () => {
    if (!canSend) return;

    if (parsedExtraData === null) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: "extra data must be a JSON object.",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: fnData, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: title.trim(),
          body: body.trim(),
          silent,
          target,
          target_user_id: target === "user" ? selectedProfileUserId.trim() : undefined,
          target_screen: targetScreenForEdge.trim(),
          entity_id: entityIdForEdge.trim(),
          data: parsedExtraData,
          notification_id: null,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Failed to send",
          description: error.message || "Edge function error",
        });
        return;
      }

      toast({
        title: "Notification queued",
        description:
          fnData &&
          typeof fnData === "object" &&
          "success" in fnData &&
          "sent_count" in fnData
            ? `Sent to ${(fnData as { sent_count?: number }).sent_count ?? 0} device(s).`
            : "Push notification sent successfully.",
      });

      setTitle("");
      setBody("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send push notification";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Push Notifications
          </h1>
          <p className="text-muted-foreground">
            Compose and send push notifications with friendly target and deep-link picks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/10 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <div className="text-sm font-medium text-primary">Admin</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5 border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Notification Composer</CardTitle>
            <CardDescription>
              Sends via the existing admin edge function (stores notification + dispatches).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pn-title">Title</Label>
              <Input
                id="pn-title"
                placeholder="e.g. New episode is live!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pn-body">Message</Label>
              <Textarea
                id="pn-body"
                placeholder="Write the notification message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target</Label>
                <Select
                  value={target}
                  onValueChange={(v) => setTarget(v as Target)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="user">Single user (by email)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {target === "user" ? (
                <div className="space-y-2">
                  <Label htmlFor="pn-user">Recipient email</Label>

                  <Input
                    id="pn-user"
                    placeholder={
                      profilesLoading ? "Loading users..." : "Search email or name..."
                    }
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    disabled={profilesLoading}
                  />

                  <Select
                    value={selectedProfileUserId}
                    onValueChange={(v) => setSelectedProfileUserId(String(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProfiles.length === 0 ? (
                        <SelectItem value="" disabled>
                          No users found
                        </SelectItem>
                      ) : (
                        filteredProfiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.email ?? p.name ?? p.user_id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
                    <User className="h-4 w-4" />
                    Edge function still uses user_id internally.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="opacity-70">Recipient email</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-1 pt-2">
                    <User className="h-4 w-4" />
                    Not required when sending to all.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Silent notification</div>
                <div className="text-xs text-muted-foreground">
                  When enabled, sends a background/content-available style notification.
                </div>
              </div>
              <Switch checked={silent} onCheckedChange={setSilent} />
            </div>

            <div className="space-y-2">
              <Label>Deep-link</Label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pn-deeplink-destination" className="opacity-90">
                    Destination
                  </Label>
                  <select
                    id="pn-deeplink-destination"
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={deepLinkTarget}
                    onChange={(e) =>
                      setDeepLinkTarget(e.target.value as DeepLinkTarget)
                    }
                  >
                    <option value="home">Home</option>
                    <option value="movie">Movie details</option>
                    <option value="tvshow">TV show details</option>
                  </select>
                </div>

                {deepLinkTarget === "movie" ? (
                  <div className="space-y-2">
                    <Label htmlFor="pn-movie">Pick a movie</Label>
                    <select
                      id="pn-movie"
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                      value={selectedMovieId}
                      onChange={(e) => setSelectedMovieId(e.target.value)}
                      disabled={movieLoading || movies.length === 0}
                    >
                      <option value="">
                        {movieLoading
                          ? "Loading movies..."
                          : movies.length === 0
                            ? "No movies available"
                            : "Select a movie"}
                      </option>
                      {movies.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {deepLinkTarget === "tvshow" ? (
                  <div className="space-y-2">
                    <Label htmlFor="pn-tvshow">Pick a TV show</Label>
                    <select
                      id="pn-tvshow"
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                      value={selectedTvId}
                      onChange={(e) => setSelectedTvId(e.target.value)}
                      disabled={tvLoading || tvShows.length === 0}
                    >
                      <option value="">
                        {tvLoading
                          ? "Loading TV shows..."
                          : tvShows.length === 0
                            ? "No TV shows available"
                            : "Select a TV show"}
                      </option>
                      {tvShows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {deepLinkTarget === "home" ? (
                  <div className="space-y-2">
                    <Label>Entity</Label>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 pt-2">
                      <Bell className="h-4 w-4" />
                      Home doesn’t need a content entity.
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="text-xs text-muted-foreground pt-2">
                Under the hood we send:{" "}
                <code className="text-[10px]">data.target_screen</code> ={" "}
                <span className="font-medium">{targetScreenForEdge}</span> and{" "}
                <code className="text-[10px]">data.entity_id</code> ={" "}
                <span className="font-medium">
                  {entityIdForEdge === "home" ? "home" : "selected content id"}
                </span>
                .
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pn-extra">Extra data (JSON)</Label>
              <Textarea
                id="pn-extra"
                placeholder='{"key":"value"}'
                value={extraDataJson}
                onChange={(e) => setExtraDataJson(e.target.value)}
                rows={5}
              />
              {parsedExtraData === null ? (
                <div className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Invalid JSON. Extra data must be a JSON object.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                onClick={handleSend}
                disabled={!canSend || loading}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Sending..." : "Send Push Notification"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Contract enforced by the edge function.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/60 p-3">
              <div className="font-medium text-foreground mb-1">Required</div>
              <ul className="space-y-1 list-disc pl-5">
                <li>title + message</li>
                <li>target: all or user (+ user_id behind the scenes)</li>
                <li>data.target_screen and data.entity_id</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <div className="font-medium text-foreground mb-1">Stored for audit</div>
              <div>
                The edge function inserts a row into{" "}
                <code className="text-xs">push_notifications</code> and updates{" "}
                <code className="text-xs">sent_count</code> after dispatch.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
