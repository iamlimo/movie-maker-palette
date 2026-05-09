import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users as UsersIcon, UserPlus, Shield, ShieldCheck, Crown, MoreHorizontal, Calendar, Mail, Ban, CheckCircle, Trash2, Eye, Wallet as WalletIcon, Download, Headphones, TrendingUp, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/priceUtils';
import { CreateUserModal } from '@/components/admin/CreateUserModal';
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';
import { UserDetailModal } from '@/components/admin/UserDetailModal';
import { Link } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { ROLE_LABELS, type AppRole } from '@/lib/rbac';

// Helper function to convert kobo to naira
const koboToNaira = (kobo: number): number => {
  return kobo / 100;
};

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  country?: string;
  phone_number?: string;
  status?: string;
}

interface UserWallet {
  user_id: string;
  balance: number;
}

interface UserWithRole extends UserProfile {
  role: AppRole;
  wallet_balance: number;
}

const ASSIGNABLE_ROLES: AppRole[] = ['user', 'support', 'sales', 'accounting', 'admin', 'super_admin'];

export default function Users() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('user');
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const { canDo, isSuperAdmin } = useRole();
  const canManageRoles = canDo('manage-roles');

  const exportUsers = (format: 'csv' | 'xlsx') => {
    const dataToExport = filteredUsers.length > 0 ? filteredUsers : users;
    if (dataToExport.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "No users to export." });
      return;
    }

    const headers = ['Name', 'Email', 'Role', 'Status', 'Country', 'Phone', 'Wallet Balance (₦)', 'Join Date'];
    const rows = dataToExport.map(u => [
      u.name,
      u.email,
      u.role.replace('_', ' '),
      u.status || 'active',
      u.country || '',
      u.phone_number || '',
      formatNaira(u.wallet_balance),
      new Date(u.created_at).toLocaleDateString(),
    ]);

    if (format === 'csv') {
      const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Simple XLSX via XML spreadsheet format
      const xmlRows = rows.map(r =>
        `<Row>${r.map(c => `<Cell><Data ss:Type="String">${String(c).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`).join('')}</Row>`
      ).join('');
      const xmlHeader = `<Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>`;
      const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Users"><Table>${xmlHeader}${xmlRows}</Table></Worksheet></Workbook>`;
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.xls`;
      link.click();
      URL.revokeObjectURL(url);
    }

    toast({ title: "Export Complete", description: `Users exported as ${format.toUpperCase()} successfully.` });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, created_at, country, phone_number, status')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch all wallets data (with balance in kobo)
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('user_id, balance');

      if (walletsError) {
        console.warn('Warning fetching wallets:', walletsError);
        // Continue if wallets fetch fails - use 0 as default
      }

      // Create a map of user_id -> wallet balance for quick lookup
      const walletMap = new Map<string, number>();
      wallets?.forEach(wallet => {
        // Convert kobo to naira
        walletMap.set(wallet.user_id, wallet.balance / 100);
      });

      // Combine profiles with roles and wallet data
      const usersWithRoles: UserWithRole[] = profiles?.map(profile => {
        const userRole = roles?.find(role => role.user_id === profile.user_id);
        const walletBalance = walletMap.get(profile.user_id) || 0;
        
        return {
          ...profile,
          role: userRole?.role || 'user',
          wallet_balance: walletBalance
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSuspend = async (user: UserWithRole) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'suspend', user_id: user.user_id }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "User Suspended",
          description: `${user.name} has been suspended`
        });
        fetchUsers();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to suspend user"
      });
    }
  };

  const handleActivate = async (user: UserWithRole) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'activate', user_id: user.user_id }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "User Activated",
          description: `${user.name} has been activated`
        });
        fetchUsers();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to activate user"
      });
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser) return;

    try {
      setUpdating(true);
      
      const { data, error } = await supabase.rpc('update_user_role', {
        _user_id: selectedUser.user_id,
        _role: newRole
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'success' in data && data.success) {
        toast({
          title: "Success",
          description: `User role updated to ${newRole} successfully.`
        });
        
        // Update local state
        setUsers(prev => prev.map(user => 
          user.user_id === selectedUser.user_id 
            ? { ...user, role: newRole }
            : user
        ));
        
        setShowRoleDialog(false);
        setSelectedUser(null);
      } else {
        throw new Error((data && typeof data === 'object' && 'error' in data ? data.error as string : null) || 'Failed to update user role');
      }
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user role. Please try again."
      });
    } finally {
      setUpdating(false);
    }
  };

  const openRoleDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleDialog(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <ShieldCheck className="h-4 w-4" />;
      case 'support':
        return <Headphones className="h-4 w-4" />;
      case 'sales':
        return <TrendingUp className="h-4 w-4" />;
      case 'accounting':
        return <Calculator className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
      super_admin: 'bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-primary/20',
      admin: 'bg-gradient-to-r from-accent/20 to-primary/20 text-accent border-accent/20',
      support: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
      sales: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
      accounting: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
    };
    return (
      <Badge variant="secondary" className={cn('flex items-center gap-1', roleStyles[role])}>
        {getRoleIcon(role)}
        {(ROLE_LABELS[role as AppRole] ?? role).toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: users.length,
    superAdmins: users.filter(u => u.role === 'super_admin').length,
    admins: users.filter(u => u.role === 'admin').length,
    regularUsers: users.filter(u => u.role === 'user').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted/20 rounded-xl w-1/3 animate-pulse"></div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-card bg-card/50">
              <CardHeader>
                <div className="h-5 bg-muted/30 rounded w-1/2"></div>
                <div className="h-8 bg-muted/30 rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader>
            <div className="h-6 bg-muted/30 rounded w-1/4"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/20 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportUsers('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportUsers('xlsx')}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <div className="text-3xl font-bold text-foreground">{stats.total}</div>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <UsersIcon className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Super Admins</CardTitle>
              <div className="text-3xl font-bold text-foreground">{stats.superAdmins}</div>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20">
              <Crown className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
              <div className="text-3xl font-bold text-foreground">{stats.admins}</div>
            </div>
            <div className="p-3 rounded-xl bg-accent/10">
              <ShieldCheck className="h-6 w-6 text-accent" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Regular Users</CardTitle>
              <div className="text-3xl font-bold text-foreground">{stats.regularUsers}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/10">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Users Directory</CardTitle>
              <CardDescription>Search and manage user accounts</CardDescription>
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="accounting">Accounting</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/5">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Wallet Balance</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/5">
                    <TableCell>
                      <div 
                        className="flex items-center space-x-3 cursor-pointer hover:text-primary"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowDetailModal(true);
                        }}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'suspended' ? 'destructive' : 'default'}>
                        {user.status === 'suspended' ? (
                          <><Ban className="h-3 w-3 mr-1" /> Suspended</>
                        ) : (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {user.country || 'Not specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatNaira(user.wallet_balance)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setShowDetailModal(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {canManageRoles && (
                            <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                              <Shield className="h-4 w-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>
                          )}
                          <Link to={`/admin/wallets?user=${user.user_id}`}>
                            <DropdownMenuItem>
                              <WalletIcon className="h-4 w-4 mr-2" />
                              Manage Wallet
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator />
                          {user.status !== 'suspended' ? (
                            <DropdownMenuItem 
                              className="text-orange-600"
                              onClick={() => handleSuspend(user)}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="text-green-600"
                              onClick={() => handleActivate(user)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              setUserToDelete(user);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No users found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || roleFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'No users have been registered yet.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change the role for <strong>{selectedUser?.name}</strong> ({selectedUser?.email}).
              This action will immediately update their permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium mb-2 block">Select New Role:</label>
            <Select value={newRole} onValueChange={(value: AppRole) => setNewRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(r)}
                      {ROLE_LABELS[r]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {newRole === 'super_admin' && 'Full access to all admin features and settings.'}
              {newRole === 'admin' && 'Manages content, users, and operations.'}
              {newRole === 'support' && 'Handles tickets, jobs, and user assistance.'}
              {newRole === 'sales' && 'Manages marketing, sections, banners, and referral codes.'}
              {newRole === 'accounting' && 'Manages payments, payouts, refunds, and wallets.'}
              {newRole === 'user' && 'Standard customer account.'}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRoleChange}
              disabled={updating || newRole === selectedUser?.role}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              {updating ? 'Updating...' : 'Update Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Modal */}
      <CreateUserModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onUserCreated={fetchUsers}
      />

      {/* Delete User Dialog */}
      <DeleteUserDialog 
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        user={userToDelete}
        onUserDeleted={fetchUsers}
      />

      {/* User Detail Modal */}
      <UserDetailModal 
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        user={selectedUser}
      />
    </div>
  );
}