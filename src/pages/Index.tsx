import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import CinematicHeroSlider from "@/components/CinematicHeroSlider";
import BrandStrip from "@/components/BrandStrip";
import MovieSection from "@/components/MovieSection";
import { newReleases, popularMovies, actionMovies } from "@/data/movies";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (user && window.location.pathname === '/auth') {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen">
      <Header />
      <CinematicHeroSlider />
      <BrandStrip />
      
      <MovieSection 
        title="New Releases"
        subtitle="Latest movies available for rental"
        movies={newReleases}
      />
      
      <MovieSection 
        title="Popular This Week"
        subtitle="Most rented movies by our customers"
        movies={popularMovies}
      />
      
      <MovieSection 
        title="Action & Adventure"
        subtitle="Heart-pounding excitement awaits"
        movies={actionMovies}
      />
      
      {/* Footer */}
      <footer className="bg-secondary/20 border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">S</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Signature TV
                </span>
              </div>
              <p className="text-muted-foreground">
                Premium movie rental platform with the latest releases and timeless classics.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Browse</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-smooth">New Releases</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Popular</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Action</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Drama</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-smooth">Help Center</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Contact Us</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Rental Terms</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Privacy Policy</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Connect</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-smooth">Twitter</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Facebook</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">Instagram</a></li>
                <li><a href="#" className="hover:text-primary transition-smooth">YouTube</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 Signature TV. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
