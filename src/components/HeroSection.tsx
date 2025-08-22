import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Plus, Star, Clock } from "lucide-react";
import heroImage from "@/assets/hero-movie.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="Featured Movie"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-16">
        <div className="max-w-2xl">
          {/* Movie Badge */}
          <div className="flex items-center gap-4 mb-6">
            <Badge variant="secondary" className="px-3 py-1">
              Featured Movie
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span>8.7</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>2h 28m</span>
              </div>
              <span>•</span>
              <span>2024</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Cosmic
            <br />
            Legends
          </h1>

          {/* Description */}
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            In a galaxy torn by ancient conflicts, unlikely heroes must unite to prevent 
            the awakening of a cosmic force that threatens to unravel the very fabric of 
            reality. An epic journey of courage, sacrifice, and destiny awaits.
          </p>

          {/* Genres */}
          <div className="flex items-center gap-2 mb-8">
            <Badge variant="outline">Sci-Fi</Badge>
            <Badge variant="outline">Action</Badge>
            <Badge variant="outline">Adventure</Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <Button variant="premium" size="lg" className="shadow-glow">
              <Play className="h-5 w-5 mr-2" />
              Rent for $6.99
            </Button>
            <Button variant="cinema" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Add to Watchlist
            </Button>
          </div>

          {/* Rental Info */}
          <div className="mt-6 text-sm text-muted-foreground">
            <p>48-hour rental period • HD & 4K available • Instant streaming</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;