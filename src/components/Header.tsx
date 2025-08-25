import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, User, Menu, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { user, signOut, profile } = useAuth();
  const { isSuperAdmin } = useRole();

  const handleSignOut = async () => {
    await signOut();
  };
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
          <Button variant="ghost" size="icon" className="hidden md:flex text-muted-foreground hover:text-primary">
            <Search className="h-5 w-5" />
          </Button>
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden md:flex items-center space-x-2 text-foreground hover:bg-secondary">
                  <User className="h-5 w-5" />
                  <span className="hidden lg:inline">{profile?.name || user?.email || 'Account'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem className="text-foreground">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {isSuperAdmin() && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center text-foreground">
                        <Settings className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleSignOut} className="text-foreground hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth" className="hidden md:block">
                <Button variant="outline" className="text-foreground border-border hover:bg-secondary">
                  Sign In
                </Button>
              </Link>
              
              <Link to="/auth" className="hidden md:block">
                <Button variant="premium" className="gradient-accent text-primary-foreground shadow-glow hover:scale-105 transition-bounce">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
          
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;