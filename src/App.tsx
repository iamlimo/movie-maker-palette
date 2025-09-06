import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import Movies from "@/pages/admin/Movies";
import AddMovieNew from "@/pages/admin/AddMovieNew";
import TVShows from "@/pages/admin/TVShows";
import AddTVShow from "@/pages/admin/AddTVShow";
import AddSeason from "@/pages/admin/AddSeason";
import Submissions from "@/pages/admin/Submissions";
import Users from "@/pages/admin/Users";
import Finance from "@/pages/admin/Finance";
import Producers from "@/pages/admin/Producers";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";


const queryClient = new QueryClient();

const App = () => (
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
            
            {/* Super Admin Routes */}
            <Route path="/admin" element={
              <SuperAdminRoute>
                <AdminLayout />
              </SuperAdminRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="movies" element={<Movies />} />
              <Route path="movies/add" element={<AddMovieNew />} />
              <Route path="tv-shows" element={<TVShows />} />
              <Route path="tv-shows/add" element={<AddTVShow />} />
              <Route path="tv-shows/:showId/add-season" element={<AddSeason />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="users" element={<Users />} />
              <Route path="finance" element={<Finance />} />
              <Route path="producers" element={<Producers />} />
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
