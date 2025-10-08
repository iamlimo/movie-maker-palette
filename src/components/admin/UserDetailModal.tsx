import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, MapPin, Calendar, Wallet, Activity, ShieldCheck, Crown, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UserDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    name: string;
    email: string;
    phone_number?: string;
    country?: string;
    created_at: string;
    wallet_balance: number;
    role: 'user' | 'admin' | 'super_admin';
  } | null;
}

export const UserDetailModal = ({ open, onOpenChange, user }: UserDetailModalProps) => {
  if (!user) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <ShieldCheck className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </DialogTitle>
          <DialogDescription>
            Complete information for {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold">{user.name}</h3>
              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                {getRoleIcon(user.role)}
                {user.role.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact Information
            </h4>
            <div className="grid gap-3 pl-6">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{user.email}</span>
              </div>
              {user.phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.phone_number}</span>
                </div>
              )}
              {user.country && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.country}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Account Information */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Account Information
            </h4>
            <div className="grid gap-3 pl-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Joined:</span>
                </div>
                <span className="text-sm font-medium">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Wallet Balance:</span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  ₦{user.wallet_balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link to={`/admin/wallets?user=${user.user_id}`} onClick={() => onOpenChange(false)}>
              <Button variant="outline" size="sm">
                <Wallet className="h-4 w-4 mr-2" />
                Manage Wallet
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
