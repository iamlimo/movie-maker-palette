import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Edit, Trash2, Eye, Clock, FileVideo, FileImage, AlertCircle } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Movie {
  id: string;
  title: string;
  description?: string;
  genre_id?: string;
  genre_name?: string;
  release_date?: string;
  duration?: number;
  language?: string;
  rating?: string;
  price: number;
  thumbnail_url?: string;
  video_url?: string;
  trailer_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  rental_expiry_duration: number;
  created_at: string;
  updated_at: string;
  cast_crew?: any[];
}

interface Genre {
  id: string;
  name: string;
}

const Movies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchMovies();
    fetchGenres();
  }, []);

  // Auto-refresh movies when navigating back to this page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMovies();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select(`
          *,
          genre:genres(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovies((data || []).map((item: any) => ({
        ...item,
        genre_name: item.genre?.name,
        cast_crew: Array.isArray(item.cast_crew) ? item.cast_crew : []
      })));
    } catch (error) {
      console.error('Error fetching movies:', error);
      toast({
        title: "Error",
        description: "Failed to fetch movies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');

      if (error) throw error;
      setGenres(data || []);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  const handleDeleteMovie = async (movieId: string, isHardDelete: boolean) => {
    try {
      if (isHardDelete) {
        // Hard delete - remove from database
        const { error } = await supabase
          .from('movies')
          .delete()
          .eq('id', movieId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Movie permanently deleted",
        });
      } else {
        // Soft delete - set status to rejected
        const { error } = await supabase
          .from('movies')
          .update({ status: 'rejected' })
          .eq('id', movieId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Movie deactivated",
        });
      }

      fetchMovies();
    } catch (error) {
      console.error('Error deleting movie:', error);
      toast({
        title: "Error",
        description: "Failed to delete movie",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRentalExpiry = async (movieId: string, hours: number) => {
    try {
      const { error } = await supabase
        .from('movies')
        .update({ rental_expiry_duration: hours })
        .eq('id', movieId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Rental expiry updated to ${hours} hours`,
      });

      fetchMovies();
    } catch (error) {
      console.error('Error updating rental expiry:', error);
      toast({
        title: "Error",
        description: "Failed to update rental expiry",
        variant: "destructive",
      });
    }
  };

  const filteredMovies = movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || movie.status === statusFilter;
    const matchesGenre = genreFilter === "all" || movie.genre_id === genreFilter;
    return matchesSearch && matchesStatus && matchesGenre;
  });

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

  const getGenreName = (genreId?: string) => {
    if (!genreId) return "No genre";
    const genre = genres.find(g => g.id === genreId);
    return genre?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading movies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Movie Management</h1>
          <p className="text-muted-foreground">Manage all movies in the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => navigate('/admin/movies/add')} 
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Movie
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/admin/movies')} 
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            View All
          </Button>
        </div>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search movies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
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
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map(genre => (
                  <SelectItem key={genre.id} value={genre.id}>
                    {genre.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movies Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Cast & Crew</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Media Files</TableHead>
                <TableHead>Release Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Rental Expiry</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovies.map((movie) => (
                <TableRow key={movie.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {movie.thumbnail_url && (
                        <img 
                          src={movie.thumbnail_url} 
                          alt={movie.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        <div className="font-medium">{movie.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {movie.duration ? `${movie.duration} min` : 'No duration'}
                        </div>
                        {movie.trailer_url && (
                          <div className="text-xs text-primary">Has trailer</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {movie.cast_crew && movie.cast_crew.length > 0 ? (
                        movie.cast_crew.slice(0, 3).map((cast: any, index: number) => (
                          <div key={index} className="text-xs">
                            <span className="font-medium">{cast.name}</span>
                            <span className="text-muted-foreground"> ({cast.role_type})</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">No cast assigned</span>
                      )}
                      {movie.cast_crew && movie.cast_crew.length > 3 && (
                        <div className="text-xs text-primary">+{movie.cast_crew.length - 3} more</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getGenreName(movie.genre_id) || movie.genre_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" title="Media files status">
                      {movie.thumbnail_url ? (
                        <FileImage className="h-4 w-4 text-green-600" />
                      ) : (
                        <FileImage className="h-4 w-4 text-red-400" />
                      )}
                      {movie.video_url ? (
                        <FileVideo className="h-4 w-4 text-green-600" />
                      ) : (
                        <FileVideo className="h-4 w-4 text-red-400" />
                      )}
                      {!movie.thumbnail_url && !movie.video_url && (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {movie.release_date 
                      ? new Date(movie.release_date).toLocaleDateString()
                      : 'No date'
                    }
                  </TableCell>
                  <TableCell>{getStatusBadge(movie.status)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{formatNaira(movie.price)}</div>
                      <div className="text-xs text-muted-foreground">{movie.price} kobo</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{movie.rental_expiry_duration}h</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Clock className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Update Rental Expiry</AlertDialogTitle>
                            <AlertDialogDescription>
                              Set the rental duration for "{movie.title}" in hours.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <Select onValueChange={(value) => handleUpdateRentalExpiry(movie.id, parseInt(value))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="24">24 hours</SelectItem>
                                <SelectItem value="48">48 hours (default)</SelectItem>
                                <SelectItem value="72">72 hours</SelectItem>
                                <SelectItem value="168">7 days</SelectItem>
                                <SelectItem value="720">30 days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/movies/view/${movie.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/movies/edit/${movie.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Movie</AlertDialogTitle>
                            <AlertDialogDescription>
                              Choose how to delete "{movie.title}":
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col gap-2">
                            <AlertDialogAction
                              onClick={() => handleDeleteMovie(movie.id, false)}
                              className="w-full"
                            >
                              Soft Delete (Hide from users)
                            </AlertDialogAction>
                            <AlertDialogAction
                              onClick={() => handleDeleteMovie(movie.id, true)}
                              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Permanent Delete
                            </AlertDialogAction>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredMovies.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No movies found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Movies;