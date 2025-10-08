import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { 
  BarChart3, 
  Film, 
  Tv, 
  Users, 
  UserCheck, 
  DollarSign,
  FileText,
  ChevronUp,
  ChevronDown,
  User2,
  Home,
  Grid3X3,
  Image,
  Megaphone,
  Settings,
  Wallet
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';

const sidebarItems = [
  { title: 'Dashboard', url: '/admin', icon: BarChart3, end: true },
  { 
    title: 'Content Management', 
    icon: Film, 
    submenu: [
      { title: 'Movies', url: '/admin/movies', icon: Film },
      { title: 'TV Shows', url: '/admin/tv-shows', icon: Tv },
    ]
  },
  { 
    title: 'Homepage Management', 
    icon: Home, 
    submenu: [
      { title: 'Sections', url: '/admin/sections', icon: Grid3X3 },
      { title: 'Hero Slider', url: '/admin/hero-slider', icon: Image },
      { title: 'Banners & CTAs', url: '/admin/banners', icon: Megaphone },
    ]
  },
  { 
    title: 'User Management', 
    icon: Users, 
    submenu: [
      { title: 'Users', url: '/admin/users', icon: Users },
      { title: 'Producers', url: '/admin/producers', icon: UserCheck },
      { title: 'Submissions', url: '/admin/submissions', icon: FileText },
    ]
  },
  { title: 'Finance', url: '/admin/finance', icon: DollarSign },
  { title: 'Wallets', url: '/admin/wallets', icon: Wallet },
  { title: 'Settings', url: '/admin/settings', icon: Settings },
];

function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const isSubmenuActive = (submenu: any[]) => {
    return submenu.some(item => location.pathname.startsWith(item.url));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">S</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Admin Panel
            </span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.submenu ? (
                    <Collapsible 
                      open={openSubmenu === item.title || isSubmenuActive(item.submenu)}
                      onOpenChange={(open) => setOpenSubmenu(open ? item.title : null)}
                    >
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className="ml-4 border-l border-border pl-4">
                          {item.submenu.map((subItem) => (
                            <SidebarMenuItem key={subItem.title}>
                              <SidebarMenuButton
                                asChild
                                isActive={location.pathname.startsWith(subItem.url)}
                                tooltip={subItem.title}
                              >
                                <NavLink to={subItem.url}>
                                  <subItem.icon className="h-4 w-4" />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={item.end ? location.pathname === item.url : location.pathname.startsWith(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url} end={item.end}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <User2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {profile?.name || 'Admin'}
                    </span>
                    <span className="truncate text-xs">
                      {profile?.email || 'admin@example.com'}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={signOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <span className="text-xl font-semibold">Super Admin Dashboard</span>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}