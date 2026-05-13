import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BottomNav } from "@/components/mobile/BottomNav";
import { MobileRouteAnimator } from "@/components/mobile/MobileRouteAnimator";
import { Capacitor } from "@capacitor/core";
import { useDeepLinking } from "@/hooks/useDeepLinking";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { OfflineSyncStatus } from "@/components/OfflineSyncStatus";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import RoleRoute from "@/components/RoleRoute";
import { STAFF_ROLES } from "@/lib/rbac";
import AdminLayout from "@/components/admin/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

const Profile = lazy(() => import("./pages/Profile"));
const MoviePreview = lazy(() => import("./pages/MoviePreview"));
const TVShowPreview = lazy(() => import("./pages/TVShowPreview"));
const Movies = lazy(() => import("./pages/Movies"));
const TVShows = lazy(() => import("./pages/TVShows"));
const Genres = lazy(() => import("./pages/Genres"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Help = lazy(() => import("./pages/Help"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));  
const Docs = lazy(() => import("./pages/Docs"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsAndConditions = lazy(() => import("./pages/GeneralTerms"));
const Careers = lazy(() => import("./pages/Careers"));
const JobApplication = lazy(() => import("./pages/JobApplication"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Watch = lazy(() => import("./pages/Watch"));


// Lazy load ALL admin routes
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMovies = lazy(() => import("@/pages/admin/Movies"));
const AddMovieNew = lazy(() => import("@/pages/admin/AddMovieNew"));
const ViewMovie = lazy(() => import("@/pages/admin/ViewMovie"));
const EditMovie = lazy(() => import("@/pages/admin/EditMovie"));
const AdminTVShows = lazy(() => import("@/pages/admin/TVShows"));
const AddTVShow = lazy(() => import("@/pages/admin/AddTVShow"));
const AddSeason = lazy(() => import("@/pages/admin/AddSeason"));
const AddEpisode = lazy(() => import("@/pages/admin/AddEpisode"));
const EditSeason = lazy(() => import("@/pages/admin/EditSeason"));
const EditEpisode = lazy(() => import("@/pages/admin/EditEpisode"));
const ViewTVShow = lazy(() => import("@/pages/admin/ViewTVShow"));
const EditTVShow = lazy(() => import("@/pages/admin/EditTVShow"));
const Submissions = lazy(() => import("@/pages/admin/Submissions"));
const Users = lazy(() => import("@/pages/admin/Users"));
const Finance = lazy(() => import("@/pages/admin/Finance"));
const AdminRentals = lazy(() => import("@/pages/admin/Rentals"));
const Producers = lazy(() => import("@/pages/admin/Producers"));
const Sections = lazy(() => import("@/pages/admin/Sections"));
const HeroSlider = lazy(() => import("@/pages/admin/HeroSlider"));
const Banners = lazy(() => import("@/pages/admin/Banners"));
const Wallets = lazy(() => import("@/pages/admin/Wallets"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const JobListingsAdmin = lazy(() => import("@/pages/admin/JobListings"));
const JobApplicationsAdmin = lazy(
  () => import("@/pages/admin/JobApplications"),
);
const ReferralCodes = lazy(() => import("@/pages/admin/ReferralCodes"));
const CreateTicket = lazy(() => import("@/pages/admin/CreateTicket"));
const TicketsList = lazy(() => import("@/pages/admin/TicketsList"));
const TicketDetails = lazy(() => import("@/pages/admin/TicketDetails"));

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
  useServiceWorker();
  if (Capacitor.isNativePlatform()) {
    // Service worker is effectively no-op on native platforms.
    // This keeps hooks order stable.
  }


  return (
    <>
      <Analytics />
      <SpeedInsights />
      <MobileRouteAnimator>
        <Suspense
          fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              Loading...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="/movie/:slug" element={<MoviePreview />} />
            <Route path="/tvshow/:slug" element={<TVShowPreview />} />
            <Route path="/watch/:contentType/:contentId" element={<Watch />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/tvshows" element={<TVShows />} />
            <Route path="/genres" element={<Genres />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/help" element={<Help />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/about" element={<AboutUs />} />

            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/general-terms" element={<TermsAndConditions />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/careers/apply/:jobId" element={<JobApplication />} />

            {/* Super Admin Routes */}
            <Route
              path="/admin"
              element={
                <RoleRoute roles={STAFF_ROLES} redirectTo="/">
                  <AdminLayout />
                </RoleRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="movies" element={<RoleRoute page="movies"><AdminMovies /></RoleRoute>} />
              <Route path="movies/add" element={<RoleRoute page="movies"><AddMovieNew /></RoleRoute>} />
              <Route path="movies/view/:id" element={<RoleRoute page="movies"><ViewMovie /></RoleRoute>} />
              <Route path="movies/edit/:id" element={<RoleRoute page="movies"><EditMovie /></RoleRoute>} />
              <Route path="tv-shows" element={<RoleRoute page="tvshows"><AdminTVShows /></RoleRoute>} />
              <Route path="tv-shows/add" element={<RoleRoute page="tvshows"><AddTVShow /></RoleRoute>} />
              <Route
                path="tv-shows/:showId/add-season"
                element={<RoleRoute page="tvshows"><AddSeason /></RoleRoute>}
              />
              <Route
                path="tv-shows/:showId/seasons/:seasonId/add-episode"
                element={<RoleRoute page="tvshows"><AddEpisode /></RoleRoute>}
              />
              <Route
                path="tv-shows/:showId/seasons/:seasonId/edit"
                element={<RoleRoute page="tvshows"><EditSeason /></RoleRoute>}
              />
              <Route
                path="tv-shows/:showId/seasons/:seasonId/episodes/:episodeId/edit"
                element={<RoleRoute page="tvshows"><EditEpisode /></RoleRoute>}
              />

              <Route path="tv-shows/view/:id" element={<RoleRoute page="tvshows"><ViewTVShow /></RoleRoute>} />
              <Route path="tv-shows/edit/:id" element={<RoleRoute page="tvshows"><EditTVShow /></RoleRoute>} />
              <Route path="submissions" element={<RoleRoute page="submissions"><Submissions /></RoleRoute>} />
              <Route path="users" element={<RoleRoute page="users"><Users /></RoleRoute>} />
              <Route path="finance" element={<RoleRoute page="finance"><Finance /></RoleRoute>} />
              <Route path="rentals" element={<RoleRoute page="rentals"><AdminRentals /></RoleRoute>} />
              <Route path="producers" element={<RoleRoute page="producers"><Producers /></RoleRoute>} />
              <Route path="sections" element={<RoleRoute page="sections"><Sections /></RoleRoute>} />
              <Route path="hero-slider" element={<RoleRoute page="hero-slider"><HeroSlider /></RoleRoute>} />
              <Route path="banners" element={<RoleRoute page="banners"><Banners /></RoleRoute>} />
              <Route path="wallets" element={<RoleRoute page="wallets"><Wallets /></RoleRoute>} />
              <Route path="settings" element={<SuperAdminRoute><Settings /></SuperAdminRoute>} />
              <Route path="job-listings" element={<RoleRoute page="job-listings"><JobListingsAdmin /></RoleRoute>} />
              <Route path="applications" element={<RoleRoute page="job-applications"><JobApplicationsAdmin /></RoleRoute>} />
              <Route path="referral-codes" element={<RoleRoute page="referral-codes"><ReferralCodes /></RoleRoute>} />
              <Route path="tickets" element={<RoleRoute page="tickets"><TicketsList /></RoleRoute>} />
              <Route path="tickets/create" element={<RoleRoute page="tickets"><CreateTicket /></RoleRoute>} />
              <Route path="tickets/:ticketId" element={<RoleRoute page="tickets"><TicketDetails /></RoleRoute>} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </MobileRouteAnimator>
      <BottomNav />
      {!Capacitor.isNativePlatform() && <OfflineSyncStatus />}
      {/* PWA offline sync - disabled on native */}
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
