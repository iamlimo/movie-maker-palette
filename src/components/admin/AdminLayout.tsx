import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { 
  BarChart3, 
  Bell,
  Film, 
  Tv, 
  Users, 
  UserCheck, 
  DollarSign,
  FileText,
  Tag,
  ChevronUp,
  ChevronDown,
  User2,
  Home,
  Grid3X3,
  Image,
  Megaphone,
  Settings,
  Wallet,
  Briefcase,
  ClipboardList,
  CreditCard,
  AlertCircle
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
import { useRole } from '@/hooks/useRole';
import { ROLE_LABELS, type PageKey } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';

type SubItem = { title: string; url: string; icon: any; page: PageKey };
type Item = {
  title: string;
  icon: any;
  url?: string;
  end?: boolean;
  page?: PageKey;
  submenu?: SubItem[];
};

const sidebarItems: Item[] = [
  { title: 'Dashboard', url: '/admin', icon: BarChart3, end: true, page: 'dashboard' },
  {
    title: 'Content Management',
    icon: Film,
    submenu: [
      { title: 'Movies', url: '/admin/movies', icon: Film, page: 'movies' },
      { title: 'TV Shows', url: '/admin/tv-shows', icon: Tv, page: 'tvshows' },
    ],
  },
  {
    title: 'Homepage Management',
    icon: Home,
    submenu: [
      { title: 'Sections', url: '/admin/sections', icon: Grid3X3, page: 'sections' },
      { title: 'Hero Slider', url: '/admin/hero-slider', icon: Image, page: 'hero-slider' },
      { title: 'Banners & CTAs', url: '/admin/banners', icon: Megaphone, page: 'banners' },
    ],
  },
  {
    title: 'User Management',
    icon: Users,
    submenu: [
      { title: 'Users', url: '/admin/users', icon: Users, page: 'users' },
      { title: 'Producers', url: '/admin/producers', icon: UserCheck, page: 'producers' },
      { title: 'Submissions', url: '/admin/submissions', icon: FileText, page: 'submissions' },
    ],
  },
  { title: 'Finance', url: '/admin/finance', icon: DollarSign, page: 'finance' },
  { title: 'Rental Tracking', url: '/admin/rentals', icon: CreditCard, page: 'rentals' },
  { title: 'Wallets', url: '/admin/wallets', icon: Wallet, page: 'wallets' },
  { title: 'Referral Codes', url: '/admin/referral-codes', icon: Tag, page: 'referral-codes' },
  { title: 'Push Notifications', url: '/admin/push-notifications', icon: Bell, page: 'push-notifications' },
  {
    title: 'Support',
    icon: AlertCircle,
    submenu: [
      { title: 'Tickets', url: '/admin/tickets', icon: AlertCircle, page: 'tickets' },
      { title: 'Create Ticket', url: '/admin/tickets/create', icon: FileText, page: 'tickets' },
    ],
  },
  {
    title: 'Careers',
    icon: Briefcase,
    submenu: [
      { title: 'Job Listings', url: '/admin/job-listings', icon: Briefcase, page: 'job-listings' },
      { title: 'Applications', url: '/admin/applications', icon: ClipboardList, page: 'job-applications' },
    ],
  },
  { title: 'Settings', url: '/admin/settings', icon: Settings, page: 'settings' },
];

function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { canAccess, userRole } = useRole();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const isSubmenuActive = (submenu: any[]) => {
    return submenu.some(item => location.pathname.startsWith(item.url));
  };

  const visibleItems = sidebarItems
    .map((item) => {
      if (item.submenu) {
        const subs = item.submenu.filter((s) => canAccess(s.page));
        return subs.length ? { ...item, submenu: subs } : null;
      }
      return item.page && canAccess(item.page) ? item : null;
    })
    .filter(Boolean) as Item[];

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
              {visibleItems.map((item) => (
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
                      <NavLink to={item.url!} end={item.end}>
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
                    <span className="truncate text-xs flex items-center gap-1">
                      {userRole && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                          {ROLE_LABELS[userRole]}
                        </Badge>
                      )}
                      <span className="truncate">{profile?.email || ''}</span>
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