import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";

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
  status: "pending" | "approved" | "rejected";
  rental_expiry_duration: number;
  created_at: string;
  updated_at: string;
  cast_crew?: any[];
  age_restriction?: number;
  content_warnings?: string[];
  viewer_discretion?: string;
  cast_info?: string;
}

const ViewMovie = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchMovie(id);
    }
  }, [id]);

  const fetchMovie = async (movieId: string) => {
    try {
      const { data, error } = await supabase
        .from("movies")
        .select("*")
        .eq("id", movieId)
        .single();

      if (error) throw error;
      setMovie({
        ...data,
        cast_crew: [],
      });
    } catch (error) {
      console.error("Error fetching movie:", error);
      toast({
        title: "Error",
        description: "Failed to fetch movie details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "bg-green-500 text-white",
      rejected: "bg-red-500 text-white",
      pending: "bg-yellow-500 text-white",
    };
    return (
      <Badge
        className={
          variants[status as keyof typeof variants] || "bg-gray-500 text-white"
        }
      >
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading movie...</p>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Movie Not Found</h1>
          <Button onClick={() => navigate("/admin/movies")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Movies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/movies")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Movies
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{movie.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(movie.status)}
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {movie.genre_name || "No genre"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/movies/edit/${movie.id}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Movie
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Movie Poster and Basic Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-6">
                {movie.thumbnail_url && (
                  <img
                    src={movie.thumbnail_url}
                    alt={movie.title}
                    className="w-48 h-72 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Description</h2>
                    <p className="text-muted-foreground">
                      {movie.description || "No description available"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-muted-foreground">
                        {movie.duration
                          ? `${movie.duration} minutes`
                          : "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Language</p>
                      <p className="text-muted-foreground">
                        {movie.language || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Rating</p>
                      <p className="text-muted-foreground">
                        {movie.rating || "Not rated"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Release Date</p>
                      <p className="text-muted-foreground">
                        {movie.release_date
                          ? new Date(movie.release_date).toLocaleDateString()
                          : "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cast & Crew */}
          {movie.cast_crew && movie.cast_crew.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cast & Crew</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {movie.cast_crew.map((member: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      {member.photo_url && (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="w-12 h-12 object-cover rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.role_type}
                        </p>
                        {member.character_name && (
                          <p className="text-xs text-muted-foreground">
                            as {member.character_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing & Rental Info */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Rental</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Price</p>
                <p className="text-2xl font-bold text-primary">
                  {formatNaira(movie.price)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {movie.price} kobo
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">Rental Duration</p>
                <p className="text-muted-foreground">
                  {movie.rental_expiry_duration} hours
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Media Files */}
          <Card>
            <CardHeader>
              <CardTitle>Media Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {movie.video_url && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Main Video</span>
                  <Button size="sm" variant="outline">
                    <Play className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              )}
              {movie.trailer_url && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Trailer</span>
                  <Button size="sm" variant="outline">
                    <Play className="h-4 w-4 mr-2" />
                    Watch
                  </Button>
                </div>
              )}
              {movie.thumbnail_url && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Thumbnail</span>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-muted-foreground text-sm">
                  {new Date(movie.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-muted-foreground text-sm">
                  {new Date(movie.updated_at).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ViewMovie;
