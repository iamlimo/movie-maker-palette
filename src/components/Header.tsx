import { Button } from "@/components/ui/button";
import { Search, User, Menu } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">S</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Signature TV
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#" className="text-foreground hover:text-primary transition-smooth">
            Home
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
            Movies
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
            Genres
          </a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
            Watchlist
          </a>
        </nav>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="outline" className="hidden md:flex">
            Sign In
          </Button>
          <Button variant="premium" className="hidden md:flex">
            Sign Up
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;