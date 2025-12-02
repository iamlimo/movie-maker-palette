import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import CinematicHeroSlider from "@/components/CinematicHeroSlider";
import BrandStrip from "@/components/BrandStrip";
import MovieSection from "@/components/MovieSection";
import { useAuth } from "@/contexts/AuthContext";
import { useSectionsWithContent } from "@/hooks/useContentSections";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Capacitor } from "@capacitor/core";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sectionsWithContent, loading, refetch } = useSectionsWithContent();
  const currentYear = new Date().getFullYear();
  const isMobile = useIsMobile();

  const { isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
    enabled: isMobile,
  });

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (user && window.location.pathname === "/auth") {
      navigate("/");
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        
        {/* Hero Skeleton */}
        <div className="relative w-full">
          <Skeleton className="w-full h-[70vh] rounded-none" />
        </div>

        {/* Brand Strip Skeleton */}
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>

        {/* Content Sections Skeleton */}
        <div className="container mx-auto px-4 space-y-12 pb-24">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      {/* Pull-to-refresh indicator */}
      {isRefreshing && isMobile && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Refreshing...</span>
        </div>
      )}

      <CinematicHeroSlider />
      <BrandStrip />

      {sectionsWithContent.map((section) => (
        <MovieSection
          key={section.id}
          title={section.title}
          subtitle={section.subtitle || ""}
          movies={section.content.map((item) => ({
            id: item.id,
            title: item.title,
            year: item.release_date
              ? new Date(item.release_date).getFullYear()
              : undefined,
            // rating: item.rating ? (typeof item.rating === 'string' ? parseFloat(item.rating) : item.rating) : undefined,
            duration: item.duration ? `${item.duration}min` : undefined,
            price: item.price || 0,
            genre: item.genre || undefined,
            imageUrl: item.thumbnail_url,
            contentType: item.content_type as "movie" | "tv_show",
            description: item.description,
          }))}
        />
      ))}

      {sectionsWithContent.length === 0 && (
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">No Content Available</h2>
          <p className="text-muted-foreground">
            Content will appear here once sections are created and movies are
            assigned to them.
          </p>
        </div>
      )}

      {/* Footer - Hidden on Mobile/Capacitor */}
      {!isMobile && !Capacitor.isNativePlatform() && (
        <footer className="bg-secondary/20 border-t border-border py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    <img src="/signature-tv-logo.png" alt="" />
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Premium movie rental platform with the latest releases and
                  timeless classics.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-4">Browse</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <a
                      href="#"
                      className="hover:text-primary transition-smooth"
                    >
                      New Releases
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-primary transition-smooth"
                    >
                      Popular
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-primary transition-smooth"
                    >
                      Action
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-primary transition-smooth"
                    >
                      Drama
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-4">Support</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <a
                      href="#"
                      className="hover:text-primary transition-smooth"
                    >
                      Help Center
                    </a>
                  </li>
                  <li>
                    <a
                      href="/contact"
                      className="hover:text-primary transition-smooth"
                    >
                      Contact Us
                    </a>
                  </li>
                  <li>
                    <a
                      href="/terms"
                      className="hover:text-primary transition-smooth"
                    >
                      Rental Terms
                    </a>
                  </li>
                  <li>
                    <a
                      href="/general-terms"
                      className="hover:text-primary transition-smooth"
                    >
                      General T&C
                    </a>
                  </li>

                  <li>
                    <a
                      href="/privacy-policy"
                      className="hover:text-primary transition-smooth"
                    >
                      Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-4">Connect</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <a
                      href="https://x.com/signaturetvapp?s=21&t=wyKWyV_QNX8UM7ZSMUfKng"
                      className="hover:text-primary transition-smooth"
                    >
                      X formerly Twitter
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.facebook.com/share/19qNut6WKf/?mibextid=wwXIfr"
                      className="hover:text-primary transition-smooth"
                    >
                      Facebook
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.instagram.com/signaturetvapp?igsh=NHZ0enljdnM5ZGZy&utm_source=qr"
                      className="hover:text-primary transition-smooth"
                    >
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.tiktok.com/@signaturetvapp?_t=ZS-905b5iqXdzu&_r=1"
                      className="hover:text-primary transition-smooth"
                    >
                      TikTok
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.youtube.com/@spicturesnetwork"
                      className="hover:text-primary transition-smooth"
                    >
                      YouTube
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
              <p>&copy; {currentYear} Signature TV. All rights reserved.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Index;
