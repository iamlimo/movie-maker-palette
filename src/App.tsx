import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminMovies from "@/pages/admin/Movies";
import AddMovieNew from "@/pages/admin/AddMovieNew";
import ViewMovie from "@/pages/admin/ViewMovie";
import EditMovie from "@/pages/admin/EditMovie";
import TVShows from "@/pages/admin/TVShows";
import AddTVShow from "@/pages/admin/AddTVShow";
import AddSeason from "@/pages/admin/AddSeason";
import AddEpisode from "@/pages/admin/AddEpisode";
import ViewTVShow from "@/pages/admin/ViewTVShow";
import EditTVShow from "@/pages/admin/EditTVShow";
import Submissions from "@/pages/admin/Submissions";
import Users from "@/pages/admin/Users";
import Finance from "@/pages/admin/Finance";
import Producers from "@/pages/admin/Producers";
import Sections from "@/pages/admin/Sections";
import HeroSlider from "@/pages/admin/HeroSlider";
import Banners from "@/pages/admin/Banners";
import Settings from "@/pages/admin/Settings";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import MoviePreview from "./pages/MoviePreview";
import TVShowPreview from "./pages/TVShowPreview";
import Movies from "./pages/Movies";
import Genres from "./pages/Genres";
import Watchlist from "./pages/Watchlist";
import Help from "./pages/Help";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Docs from "./pages/Docs";


const queryClient = new QueryClient();

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/movie/:id" element={<MoviePreview />} />
            <Route path="/tvshow/:id" element={<TVShowPreview />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/genres" element={<Genres />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/help" element={<Help />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/docs" element={<Docs />} />
            
            {/* Super Admin Routes */}
            <Route path="/admin" element={
              <SuperAdminRoute>
                <AdminLayout />
              </SuperAdminRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="movies" element={<AdminMovies />} />
              <Route path="movies/add" element={<AddMovieNew />} />
              <Route path="movies/view/:id" element={<ViewMovie />} />
              <Route path="movies/edit/:id" element={<EditMovie />} />
              <Route path="tv-shows" element={<TVShows />} />
              <Route path="tv-shows/add" element={<AddTVShow />} />
              <Route path="tv-shows/:showId/add-season" element={<AddSeason />} />
              <Route path="tv-shows/:showId/seasons/:seasonId/add-episode" element={<AddEpisode />} />
              <Route path="tv-shows/view/:id" element={<ViewTVShow />} />
              <Route path="tv-shows/edit/:id" element={<EditTVShow />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="users" element={<Users />} />
              <Route path="finance" element={<Finance />} />
              <Route path="producers" element={<Producers />} />
              <Route path="sections" element={<Sections />} />
              <Route path="hero-slider" element={<HeroSlider />} />
              <Route path="banners" element={<Banners />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
