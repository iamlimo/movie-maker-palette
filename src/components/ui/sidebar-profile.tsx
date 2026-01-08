import React from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings, 
  Heart, 
  History, 
  BarChart3, 
  ChevronLeft,
  Menu,
  X,
  Shield
} from 'lucide-react';

interface ProfileSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Dashboard & stats' },
  { id: 'profile', label: 'Personal Info', icon: User, description: 'Edit your profile' },
  { id: 'preferences', label: 'Preferences', icon: Settings, description: 'App settings' },
  { id: 'favorites', label: 'My List', icon: Heart, description: 'Favorites & pinned' },
  { id: 'history', label: 'Watch History', icon: History, description: 'Your viewing activity' },
  { id: 'account', label: 'Account', icon: Shield, description: 'Security & deletion' },
];

export function ProfileSidebar({ 
  activeTab, 
  onTabChange, 
  isCollapsed, 
  onToggleCollapse, 
  className 
}: ProfileSidebarProps) {
  return (
    <div className={cn(
      "flex flex-col bg-card border-r border-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-foreground">Profile</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start transition-all duration-200",
                isCollapsed ? "px-2" : "px-3",
                isActive && "bg-primary/10 text-primary border-l-4 border-primary"
              )}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={18} className={cn(
                "flex-shrink-0",
                !isCollapsed && "mr-3"
              )} />
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div className="font-medium">{tab.label}</div>
                  <div className="text-xs text-muted-foreground">{tab.description}</div>
                </div>
              )}
              {!isCollapsed && isActive && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  Active
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
    </div>
  );
}