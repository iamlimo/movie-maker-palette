import MovieCard from "./MovieCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MovieSectionProps {
  title: string;
  subtitle?: string;
  movies: Array<{
    id: string;
    title: string;
    year: number;
    rating: number;
    duration: string;
    price: string;
    genre: string;
    imageUrl: string;
    contentType?: 'movie' | 'tv_show';
  }>;
}

const MovieSection = ({ title, subtitle, movies }: MovieSectionProps) => {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">{title}</h2>
            {subtitle && (
              <p className="text-muted-foreground">{subtitle}</p>
            )}
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Movie Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              id={movie.id}
              title={movie.title}
              year={movie.year}
              rating={movie.rating}
              duration={movie.duration}
              price={movie.price}
              genre={movie.genre}
              imageUrl={movie.imageUrl}
              contentType={movie.contentType || 'movie'}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MovieSection;