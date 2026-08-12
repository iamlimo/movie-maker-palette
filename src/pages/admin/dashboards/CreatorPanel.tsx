import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Film, Tv, Clapperboard, Building2 } from "lucide-react";

type CreatorProfile = {
  id: string;
  display_name: string;
  company_name: string | null;
  creator_type: string | null;
  status: string | null;
  email: string;
};

type ContentRow = {
  content_id: string;
  content_type: string;
  title: string;
};

const TYPE_META: Record<string, { label: string; icon: typeof Film }> = {
  movie: { label: "Movie", icon: Film },
  tv_show: { label: "TV Series", icon: Tv },
  episode: { label: "Episode", icon: Clapperboard },
};

export default function CreatorPanel() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;
        if (!userId) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;

        const { data: prof } = await sb
          .from("creator_profiles")
          .select("id, display_name, company_name, creator_type, status, email")
          .eq("user_id", userId)
          .maybeSingle();

        if (!mounted || !prof) {
          if (mounted) setLoading(false);
          return;
        }
        setProfile(prof as CreatorProfile);

        const { data: mappings } = await sb
          .from("content_creators")
          .select("content_id, content_type")
          .eq("creator_profile_id", prof.id);

        const rows: ContentRow[] = [];
        for (const m of (mappings ?? []) as { content_id: string; content_type: string }[]) {
          const table =
            m.content_type === "movie" ? "movies" : m.content_type === "tv_show" ? "tv_shows" : "episodes";
          const { data: item } = await sb.from(table).select("title").eq("id", m.content_id).maybeSingle();
          rows.push({ ...m, title: item?.title ?? "Untitled" });
        }

        if (mounted) setContent(rows);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Creator dashboard</CardTitle>
          <CardDescription>
            No creator profile is linked to this account yet. Please contact the Signature TV team.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const counts = content.reduce<Record<string, number>>((acc, row) => {
    acc[row.content_type] = (acc[row.content_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {profile.display_name}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          <Building2 className="h-4 w-4" />
          {profile.company_name ?? "—"}
          <Badge variant="secondary">{profile.creator_type ?? "creator"}</Badge>
          <Badge variant={profile.status === "active" ? "default" : "outline"}>
            {profile.status === "active" ? "Active" : "Pending activation"}
          </Badge>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{meta.label}s</CardTitle>
              <meta.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts[key] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My catalogue</CardTitle>
          <CardDescription>Titles mapped to you by the Signature TV team.</CardDescription>
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
                key={`${row.content_type}-${row.content_id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{row.title}</span>
                </div>
                <Badge variant="outline">{meta?.label ?? row.content_type}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
