import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play, Clock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import moviePlaceholder from "@/assets/movie-placeholder.jpg";

interface MovieCardProps {
  id: string;
  title: string;
  year: number;
  rating: number;
  duration: string;
  price: string;
  genre: string;
  imageUrl: string;
  contentType?: 'movie' | 'tv_show';
  featured?: boolean;
}

const MovieCard = ({ 
  id,
  title, 
  year, 
  rating, 
  duration, 
  price, 
  genre, 
  imageUrl,
  contentType = 'movie',
  featured = false 
}: MovieCardProps) => {
  const navigate = useNavigate();

  const handlePreview = () => {
    const route = contentType === 'movie' ? `/movie/${id}` : `/tvshow/${id}`;
    navigate(route);
  };
  return (
    <div className={`group relative overflow-hidden rounded-xl transition-smooth hover:scale-105 ${
      featured ? 'shadow-premium' : 'shadow-card'
    }`}>
      {/* Movie Poster */}
      <div className="aspect-[2/3] overflow-hidden bg-secondary">
        <img 
          src={imageUrl || moviePlaceholder} 
          alt={title}
          className="w-full h-full object-cover transition-smooth group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = moviePlaceholder;
          }}
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-smooth">
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="premium" size="sm" onClick={handlePreview}>
                <Play className="h-4 w-4 mr-1" />
                Rent {price}
              </Button>
              <Button variant="cinema" size="sm" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Movie Info */}
      <div className="p-4 gradient-card">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth line-clamp-2">
            {title}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {price}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
          <span>{year}</span>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span>{rating || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{duration}</span>
          </div>
        </div>
        
        <Badge variant="outline" className="text-xs">
          {genre}
        </Badge>
      </div>
    </div>
  );
};

export default MovieCard;