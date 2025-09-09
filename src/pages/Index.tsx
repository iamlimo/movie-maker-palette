import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import CinematicHeroSlider from "@/components/CinematicHeroSlider";
import BrandStrip from "@/components/BrandStrip";
import MovieSection from "@/components/MovieSection";
import { useAuth } from "@/contexts/AuthContext";
import { useSectionsWithContent } from "@/hooks/useContentSections";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sectionsWithContent, loading } = useSectionsWithContent();

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (user && window.location.pathname === '/auth') {
      navigate('/');
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <CinematicHeroSlider />
      <BrandStrip />
      
      {sectionsWithContent.map((section) => (
        <MovieSection 
          key={section.id}
          title={section.title}
          subtitle={section.subtitle || ''}
          movies={section.content.map(item => ({
            id: item.id,
            title: item.title,
            year: item.release_date ? new Date(item.release_date).getFullYear() : 2024,
            rating: item.rating ? parseFloat(item.rating) : 0,
            duration: item.duration ? `${item.duration}min` : '120min',
            price: `₦${item.price}`,
            genre: item.genre || 'Unknown',
            imageUrl: item.thumbnail_url || '/placeholder.svg'
          }))}
        />
      ))}

      {sectionsWithContent.length === 0 && (
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">No Content Available</h2>
          <p className="text-muted-foreground">
            Content will appear here once sections are created and movies are assigned to them.
          </p>
        </div>
      )}
      
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
