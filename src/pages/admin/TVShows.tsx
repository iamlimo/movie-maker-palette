import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/priceUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TVShow {
  id: string;
  title: string;
  description?: string;
  genre_id?: string;
  release_date?: string;
  language?: string;
  rating?: string;
  price: number;
  thumbnail_url?: string;
  trailer_url?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

interface Season {
  id: string;
  tv_show_id: string;
  season_number: number;
  description?: string;
  price: number;
  rental_expiry_duration: number;
  created_at: string;
  status?: string;
}

interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  duration?: number;
  price: number;
  status: "pending" | "approved" | "rejected";
  video_url?: string;
  created_at: string;
}

const TVShows = () => {
  const [tvShows, setTvShows] = useState<TVShow[]>([]);
  const [seasons, setSeasons] = useState<Record<string, Season[]>>({});
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "show" | "season" | "episode"; id: string; showId?: string; name: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");

  useEffect(() => {
    fetchTVShows();
  }, []);

  const fetchTVShows = async () => {
    try {
      const { data, error } = await supabase
        .from("tv_shows")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTvShows(data || []);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
      toast({ title: "Error", description: "Failed to fetch TV shows", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleShowExpansion = async (showId: string) => {
    const newExpanded = new Set(expandedShows);
    if (expandedShows.has(showId)) {
      newExpanded.delete(showId);
    } else {
      newExpanded.add(showId);
      await fetchSeasons(showId);
    }
    setExpandedShows(newExpanded);
  };

  const toggleSeasonExpansion = async (seasonId: string) => {
    const newExpanded = new Set(expandedSeasons);
    if (expandedSeasons.has(seasonId)) {
      newExpanded.delete(seasonId);
    } else {
      newExpanded.add(seasonId);
      await fetchEpisodes(seasonId);
    }
    setExpandedSeasons(newExpanded);
  };

  const fetchSeasons = async (showId: string) => {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("tv_show_id", showId)
        .order("season_number");

      if (error) throw error;
      setSeasons((prev) => ({ ...prev, [showId]: data || [] }));
    } catch (error) {
      console.error("Error fetching seasons:", error);
    }
  };

  const fetchEpisodes = async (seasonId: string) => {
    try {
      const { data, error } = await supabase
        .from("episodes")
        .select("*")
        .eq("season_id", seasonId)
        .order("episode_number");

      if (error) throw error;
      setEpisodes((prev) => ({ ...prev, [seasonId]: data || [] }));
    } catch (error) {
      console.error("Error fetching episodes:", error);
    }
  };

  const openDeleteDialog = (type: "show" | "season" | "episode", id: string, name: string, showId?: string) => {
    setDeleteTarget({ type, id, showId, name });
    setDeleteMode("soft");
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "show") {
        if (deleteMode === "soft") {
          const { error } = await supabase.from("tv_shows").update({ status: "rejected" as const }).eq("id", deleteTarget.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("tv_shows").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        }
        fetchTVShows();
      } else if (deleteTarget.type === "season") {
        if (deleteMode === "soft") {
          const { error } = await supabase.from("seasons").update({ status: "rejected" as const }).eq("id", deleteTarget.id);
          if (error) throw error;
        } else {
          await supabase.from("episodes").delete().eq("season_id", deleteTarget.id);
          const { error } = await supabase.from("seasons").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        }
        if (deleteTarget.showId) fetchSeasons(deleteTarget.showId);
      } else if (deleteTarget.type === "episode") {
        if (deleteMode === "soft") {
          const { error } = await supabase.from("episodes").update({ status: "rejected" as const }).eq("id", deleteTarget.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("episodes").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        }
        // Find the season id to refresh
        for (const [seasonId, eps] of Object.entries(episodes)) {
          if (eps.some(e => e.id === deleteTarget.id)) {
            fetchEpisodes(seasonId);
            break;
          }
        }
      }

      toast({ title: "Success", description: `${deleteTarget.name} ${deleteMode === "soft" ? "archived" : "deleted"} successfully` });
    } catch (error) {
      console.error("Error deleting:", error);
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      approved: "bg-green-500 text-white",
      rejected: "bg-red-500 text-white",
      pending: "bg-yellow-500 text-white",
    };
    return <Badge className={variants[status] || "bg-gray-500 text-white"}>{status}</Badge>;
  };

  const filteredTVShows = tvShows.filter((show) => {
    const matchesSearch = show.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || show.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TV shows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">TV Shows Management</h1>
          <p className="text-muted-foreground">Manage all TV shows, seasons, and episodes</p>
        </div>
        <Button onClick={() => navigate("/admin/tv-shows/add")}>
          <Plus className="h-4 w-4 mr-2" />
          Create TV Show
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input placeholder="Search TV shows..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Release Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTVShows.map((show) => (
                <React.Fragment key={show.id}>
                  <TableRow className="border-b">
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleShowExpansion(show.id)}>
                        {expandedShows.has(show.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {show.thumbnail_url && (
                          <img src={show.thumbnail_url} alt={show.title} className="w-12 h-16 object-cover rounded" />
                        )}
                        <div>
                          <div className="font-medium">{show.title}</div>
                          <div className="text-sm text-muted-foreground">TV Show</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(show.status)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{formatNaira(show.price)}</div>
                        <div className="text-xs text-muted-foreground">{show.price} kobo</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {show.release_date ? new Date(show.release_date).toLocaleDateString() : "No date"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/tv-shows/view/${show.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/tv-shows/edit/${show.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDialog("show", show.id, show.title)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Seasons */}
                  {expandedShows.has(show.id) &&
                    seasons[show.id]?.map((season) => (
                      <React.Fragment key={season.id}>
                        <TableRow className="bg-secondary/30">
                          <TableCell className="pl-8">
                            <Button variant="ghost" size="sm" onClick={() => toggleSeasonExpansion(season.id)}>
                              {expandedSeasons.has(season.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">Season {season.season_number}</div>
                            <div className="text-sm text-muted-foreground">{season.description || "No description"}</div>
                          </TableCell>
                          <TableCell>
                            {season.status ? getStatusBadge(season.status) : <Badge variant="outline">Season</Badge>}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold">{formatNaira(season.price)}</div>
                              <div className="text-xs text-muted-foreground">{season.price} kobo</div>
                            </div>
                          </TableCell>
                          <TableCell>{season.rental_expiry_duration}h rental</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" title="Add Episode" onClick={() => navigate(`/admin/tv-shows/${show.id}/seasons/${season.id}/add-episode`)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Edit Season" onClick={() => navigate(`/admin/tv-shows/${show.id}/seasons/${season.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Delete Season" onClick={() => openDeleteDialog("season", season.id, `Season ${season.season_number}`, show.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Episodes */}
                        {expandedSeasons.has(season.id) &&
                          episodes[season.id]?.map((episode) => (
                            <TableRow key={episode.id} className="bg-secondary/10">
                              <TableCell className="pl-16"></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">E{episode.episode_number}</span>
                                  <span className="font-medium text-sm">{episode.title}</span>
                                  {episode.duration && (
                                    <span className="text-xs text-muted-foreground">({episode.duration}min)</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(episode.status)}</TableCell>
                              <TableCell>
                                <div className="text-sm">{formatNaira(episode.price)}</div>
                              </TableCell>
                              <TableCell>
                                {episode.video_url ? (
                                  <Badge variant="outline" className="text-xs">Has Video</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No video</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/tv-shows/${show.id}/seasons/${season.id}/episodes/${episode.id}/edit`)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => openDeleteDialog("episode", episode.id, episode.title)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}

                        {expandedSeasons.has(season.id) && (!episodes[season.id] || episodes[season.id].length === 0) && (
                          <TableRow className="bg-secondary/10">
                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4 pl-16">
                              No episodes yet.{" "}
                              <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/admin/tv-shows/${show.id}/seasons/${season.id}/add-episode`)}>
                                Add one
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          {filteredTVShows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No TV shows found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how to remove this {deleteTarget?.type === "show" ? "TV show" : deleteTarget?.type}:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <button
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                deleteMode === "soft" ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
              }`}
              onClick={() => setDeleteMode("soft")}
            >
              <p className="font-medium">Archive (Soft Delete)</p>
              <p className="text-sm text-muted-foreground">Sets status to "rejected". Can be restored later.</p>
            </button>
            <button
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                deleteMode === "hard" ? "border-destructive bg-destructive/10" : "border-border hover:border-muted-foreground"
              }`}
              onClick={() => setDeleteMode("hard")}
            >
              <p className="font-medium text-destructive">Permanent Delete</p>
              <p className="text-sm text-muted-foreground">
                Permanently removes{deleteTarget?.type === "season" ? " the season and all its episodes" : ""}. Cannot be undone.
              </p>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={deleteMode === "hard" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {deleteMode === "soft" ? "Archive" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

import React from "react";

export default TVShows;
