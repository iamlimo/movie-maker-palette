import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, User, Menu, LogOut, Settings, X, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useWallet } from "@/hooks/useWallet";
import { useIsMobile } from "@/hooks/use-mobile";
import { isBottomNavRoute } from "@/lib/navigationUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import SearchModal from "./SearchModal";

const Header = () => {
  const { user, signOut, profile, loading } = useAuth();
  const { isSuperAdmin } = useRole();
  const { formatBalance } = useWallet();
  const { toast } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  
  const showBottomNav = isMobile && isBottomNavRoute(location.pathname);

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent multiple clicks

    setIsSigningOut(true);
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      console.error("Sign out failed:", error);
      toast({
        title: "Sign out failed",
        description: "There was an error signing you out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigningOut(false);
    }
  };
  return (
    <header className={`fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border ${showBottomNav ? 'md:block hidden' : ''}`}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <Link to="/">
            <img src="/signature-tv-logo.png" alt="Logo" className="h-12" />
          </Link>
          {/* <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">S</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Signature TV
          </span> */}
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            to="/"
            className="text-foreground hover:text-primary transition-smooth"
          >
            Home
          </Link>
          <Link
            to="/movies"
            className="text-muted-foreground hover:text-primary transition-smooth"
          >
            Movies
          </Link>
          <Link
            to="/tvshows"
            className="text-muted-foreground hover:text-primary transition-smooth"
          >
            TV Shows
          </Link>
          <Link
            to="/genres"
            className="text-muted-foreground hover:text-primary transition-smooth"
          >
            Genres
          </Link>
          <Link
            to="/watchlist"
            className="text-muted-foreground hover:text-primary transition-smooth"
          >
            Watchlist
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex text-muted-foreground hover:text-primary"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          {user ? (
            <div className="flex items-center space-x-3">
              {/* Wallet Widget */}
              <Link to="/wallet">
                <Button
                  variant="outline"
                  className="hidden md:flex items-center space-x-2 text-foreground hover:border-primary"
                >
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-medium">{formatBalance()}</span>
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="hidden md:flex items-center space-x-2 text-foreground hover:bg-secondary"
                  >
                    <User className="h-5 w-5" />
                    <span className="hidden lg:inline">
                      {profile?.name || user?.email || "Account"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-card border-border"
                >
                  <DropdownMenuItem asChild>
                    <Link
                      to="/profile"
                      className="flex items-center text-foreground"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/wallet"
                      className="flex items-center text-foreground"
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      My Wallet
                    </Link>
                  </DropdownMenuItem>
                  {isSuperAdmin() && (
                    <>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem asChild>
                        <Link
                          to="/admin"
                          className="flex items-center text-foreground"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-foreground hover:bg-destructive/10"
                    disabled={isSigningOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isSigningOut ? "Signing Out..." : "Sign Out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Quick Sign Out Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="hidden lg:flex text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isSigningOut ? "Signing Out..." : "Sign Out"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/auth?mode=login">
                <Button
                  variant="ghost"
                  className="hidden md:flex text-foreground hover:text-primary"
                >
                  Log In
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button
                  variant="premium"
                  className="hidden md:flex gradient-accent text-primary-foreground shadow-glow hover:scale-105 transition-bounce"
                >
                  Create Account
                </Button>
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-card border-t border-border">
          <nav className="container mx-auto px-4 py-4 space-y-4">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-foreground hover:text-primary transition-smooth"
            >
              Home
            </Link>
            <Link
              to="/movies"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-muted-foreground hover:text-primary transition-smooth"
            >
              Movies
            </Link>
            <Link
              to="/tvshows"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-muted-foreground hover:text-primary transition-smooth"
            >
              TV Shows
            </Link>
            <Link
              to="/genres"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-muted-foreground hover:text-primary transition-smooth"
            >
              Genres
            </Link>
            <Link
              to="/watchlist"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-muted-foreground hover:text-primary transition-smooth"
            >
              Watchlist
            </Link>
            {user && (
              <Link
                to="/wallet"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-muted-foreground hover:text-primary transition-smooth"
              >
                Wallet
              </Link>
            )}

            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsSearchOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full justify-start text-muted-foreground hover:text-primary"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {!user && (
              <div className="pt-4 border-t border-border space-y-3">
                <Link
                  to="/auth?mode=login"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-foreground hover:text-primary"
                  >
                    Log In
                  </Button>
                </Link>
                <Link
                  to="/auth?mode=signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full gradient-accent text-primary-foreground shadow-glow">
                    Create Account
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </header>
  );
};

export default Header;
