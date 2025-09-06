import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Edit, Trash2, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  status: 'pending' | 'approved' | 'rejected';
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
}

interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  duration?: number;
  price: number;
  rental_expiry_duration: number;
  status: 'pending' | 'approved' | 'rejected';
  video_url?: string;
  release_date?: string;
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

  useEffect(() => {
    fetchTVShows();
  }, []);

  const fetchTVShows = async () => {
    try {
      const { data, error } = await supabase
        .from('tv_shows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTvShows(data || []);
    } catch (error) {
      console.error('Error fetching TV shows:', error);
      toast({
        title: "Error",
        description: "Failed to fetch TV shows",
        variant: "destructive",
      });
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
      // Fetch seasons for this show
      await fetchSeasons(showId);
    }
    setExpandedShows(newExpanded);
  };

  const fetchSeasons = async (showId: string) => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('tv_show_id', showId)
        .order('season_number');

      if (error) throw error;
      setSeasons(prev => ({ ...prev, [showId]: data || [] }));
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "bg-green-500 text-white",
      rejected: "bg-red-500 text-white",
      pending: "bg-yellow-500 text-white"
    };
    return (
      <Badge className={variants[status as keyof typeof variants] || "bg-gray-500 text-white"}>
        {status}
      </Badge>
    );
  };

  const filteredTVShows = tvShows.filter(show => {
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
        <Button onClick={() => navigate('/admin/tv-shows/add')}>
          <Plus className="h-4 w-4 mr-2" />
          Create TV Show
        </Button>
      </div>

      {/* Filters */}
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
              <Input
                placeholder="Search TV shows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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

      {/* TV Shows Table */}
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
                <>
                  <TableRow key={show.id} className="border-b">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowExpansion(show.id)}
                      >
                        {expandedShows.has(show.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {show.thumbnail_url && (
                          <img 
                            src={show.thumbnail_url} 
                            alt={show.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium">{show.title}</div>
                          <div className="text-sm text-muted-foreground">
                            TV Show
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(show.status)}</TableCell>
                    <TableCell>₦{show.price}</TableCell>
                    <TableCell>
                      {show.release_date 
                        ? new Date(show.release_date).toLocaleDateString()
                        : 'No date'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/admin/tv-shows/view/${show.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/admin/tv-shows/edit/${show.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Seasons */}
                  {expandedShows.has(show.id) && seasons[show.id]?.map((season) => (
                    <TableRow key={season.id} className="bg-secondary/30">
                      <TableCell className="pl-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newExpanded = new Set(expandedSeasons);
                            if (expandedSeasons.has(season.id)) {
                              newExpanded.delete(season.id);
                            } else {
                              newExpanded.add(season.id);
                            }
                            setExpandedSeasons(newExpanded);
                          }}
                        >
                          {expandedSeasons.has(season.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">Season {season.season_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {season.description || 'No description'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Season</Badge>
                      </TableCell>
                      <TableCell>₦{season.price}</TableCell>
                      <TableCell>
                        {season.rental_expiry_duration}h rental
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
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
    </div>
  );
};

export default TVShows;