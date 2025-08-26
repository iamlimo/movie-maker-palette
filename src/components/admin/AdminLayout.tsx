import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  BarChart3, 
  Film, 
  Tv, 
  Users, 
  UserCheck, 
  DollarSign,
  FileText,
  Menu,
  X
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const sidebarItems = [
  { title: 'Dashboard', url: '/admin', icon: BarChart3, end: true },
  { title: 'Movies', url: '/admin/movies', icon: Film },
  { title: 'Submissions', url: '/admin/submissions', icon: FileText },
  { title: 'TV Shows', url: '/admin/tv-shows', icon: Tv },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Producers', url: '/admin/producers', icon: UserCheck },
  { title: 'Finance', url: '/admin/finance', icon: DollarSign },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-transform duration-300",
        "lg:translate-x-0 lg:relative lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-primary">Admin Panel</h2>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="p-4 space-y-2">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                  "hover:bg-muted/50",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium" 
                    : "text-muted-foreground"
                )
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
            <div className="w-10 lg:hidden" /> {/* Spacer for mobile layout */}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}