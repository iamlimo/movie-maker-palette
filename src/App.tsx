import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BottomNav } from "@/components/mobile/BottomNav";
import { MobileRouteAnimator } from "@/components/mobile/MobileRouteAnimator";
import { useDeepLinking } from "@/hooks/useDeepLinking";
import { OfflineBanner } from "@/components/OfflineBanner";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load non-critical routes for faster initial load
const Profile = lazy(() => import('./pages/Profile'));
const MoviePreview = lazy(() => import('./pages/MoviePreview'));
const TVShowPreview = lazy(() => import('./pages/TVShowPreview'));
const Movies = lazy(() => import('./pages/Movies'));
const TVShows = lazy(() => import('./pages/TVShows'));
const Genres = lazy(() => import('./pages/Genres'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Help = lazy(() => import('./pages/Help'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Docs = lazy(() => import('./pages/Docs'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsAndConditions = lazy(() => import('./pages/GeneralTerms'));

// Lazy load ALL admin routes
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminMovies = lazy(() => import('@/pages/admin/Movies'));
const AddMovieNew = lazy(() => import('@/pages/admin/AddMovieNew'));
const ViewMovie = lazy(() => import('@/pages/admin/ViewMovie'));
const EditMovie = lazy(() => import('@/pages/admin/EditMovie'));
const AdminTVShows = lazy(() => import('@/pages/admin/TVShows'));
const AddTVShow = lazy(() => import('@/pages/admin/AddTVShow'));
const AddSeason = lazy(() => import('@/pages/admin/AddSeason'));
const AddEpisode = lazy(() => import('@/pages/admin/AddEpisode'));
const EditSeason = lazy(() => import('@/pages/admin/EditSeason'));
const EditEpisode = lazy(() => import('@/pages/admin/EditEpisode'));
const ViewTVShow = lazy(() => import('@/pages/admin/ViewTVShow'));
const EditTVShow = lazy(() => import('@/pages/admin/EditTVShow'));
const Submissions = lazy(() => import('@/pages/admin/Submissions'));
const Users = lazy(() => import('@/pages/admin/Users'));
const Finance = lazy(() => import('@/pages/admin/Finance'));
const Producers = lazy(() => import('@/pages/admin/Producers'));
const Sections = lazy(() => import('@/pages/admin/Sections'));
const HeroSlider = lazy(() => import('@/pages/admin/HeroSlider'));
const Banners = lazy(() => import('@/pages/admin/Banners'));
const Wallets = lazy(() => import('@/pages/admin/Wallets'));
const Settings = lazy(() => import('@/pages/admin/Settings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
      gcTime: 30 * 60 * 1000, // Cache kept for 30 minutes
      refetchOnMount: false, // Don't refetch when component mounts
      refetchOnWindowFocus: false, // Don't refetch when app regains focus
      refetchOnReconnect: false, // Don't auto-refetch on reconnect
      retry: 1, // Only retry once on failure
    },
  },
});

function AppContent() {
  useDeepLinking();

  return (
    <>
      <OfflineBanner />
      <MobileRouteAnimator>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/movie/:id" element={<MoviePreview />} />
            <Route path="/tvshow/:id" element={<TVShowPreview />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/tvshows" element={<TVShows />} />
            <Route path="/genres" element={<Genres />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/help" element={<Help />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/general-terms" element={<TermsAndConditions />} />

          {/* Super Admin Routes */}
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <AdminLayout />
              </SuperAdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="movies" element={<AdminMovies />} />
            <Route path="movies/add" element={<AddMovieNew />} />
            <Route path="movies/view/:id" element={<ViewMovie />} />
            <Route path="movies/edit/:id" element={<EditMovie />} />
            <Route path="tv-shows" element={<AdminTVShows />} />
            <Route path="tv-shows/add" element={<AddTVShow />} />
            <Route path="tv-shows/:showId/add-season" element={<AddSeason />} />
            <Route
              path="tv-shows/:showId/seasons/:seasonId/add-episode"
              element={<AddEpisode />}
            />
            <Route
              path="tv-shows/:showId/seasons/:seasonId/edit"
              element={<EditSeason />}
            />
            <Route
              path="tv-shows/:showId/seasons/:seasonId/episodes/:episodeId/edit"
              element={<EditEpisode />}
            />
            <Route path="tv-shows/view/:id" element={<ViewTVShow />} />
            <Route path="tv-shows/edit/:id" element={<EditTVShow />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="users" element={<Users />} />
            <Route path="finance" element={<Finance />} />
            <Route path="producers" element={<Producers />} />
            <Route path="sections" element={<Sections />} />
            <Route path="hero-slider" element={<HeroSlider />} />
            <Route path="banners" element={<Banners />} />
            <Route path="wallets" element={<Wallets />} />
            <Route path="settings" element={<Settings />} />
          </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </MobileRouteAnimator>
      <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
