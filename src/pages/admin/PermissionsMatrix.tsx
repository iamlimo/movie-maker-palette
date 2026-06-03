import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, Shield, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
  module: string;
}

const ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  sales: 'Sales',
  accounting: 'Accounting',
  support: 'Support',
  creator: 'Creator',
  user: 'User',
};

export default function PermissionsMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [mapping, setMapping] = useState<Set<string>>(new Set()); // `${role_id}:${permission_id}`
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [rolesRes, permsRes, mapRes] = await Promise.all([
        supabase.from('roles').select('id, name, description').order('name'),
        supabase.from('permissions').select('id, name, description, module').order('module').order('name'),
        supabase.from('role_permissions').select('role_id, permission_id'),
      ]);

      if (rolesRes.error) toast.error('Failed to load roles');
      if (permsRes.error) toast.error('Failed to load permissions');
      if (mapRes.error) toast.error('Failed to load role-permission mappings');

      const rs = (rolesRes.data ?? []) as Role[];
      setRoles(rs);
      setPermissions((permsRes.data ?? []) as Permission[]);
      const set = new Set<string>();
      for (const row of mapRes.data ?? []) set.add(`${row.role_id}:${row.permission_id}`);
      setMapping(set);

      if (!selectedRoleId && rs.length) {
        const preferred = rs.find((r) => r.name === 'super_admin') ?? rs[0];
        setSelectedRoleId(preferred.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const out: Record<string, Permission[]> = {};
    for (const p of permissions) {
      const m = p.module || 'Other';
      (out[m] ??= []).push(p);
    }
    return out;
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  const isChecked = (permId: string) =>
    !!selectedRoleId && mapping.has(`${selectedRoleId}:${permId}`);

  const togglePermission = async (perm: Permission, next: boolean) => {
    if (!selectedRoleId) return;
    const key = `${selectedRoleId}:${perm.id}`;

    // optimistic
    setMapping((prev) => {
      const n = new Set(prev);
      next ? n.add(key) : n.delete(key);
      return n;
    });
    setPending((prev) => new Set(prev).add(key));

    const { error } = next
      ? await supabase
          .from('role_permissions')
          .insert({ role_id: selectedRoleId, permission_id: perm.id })
      : await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRoleId)
          .eq('permission_id', perm.id);

    setPending((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });

    if (error) {
      // rollback
      setMapping((prev) => {
        const n = new Set(prev);
        next ? n.delete(key) : n.add(key);
        return n;
      });
      const isRls = /row.level security|permission denied|policy/i.test(error.message);
      toast.error(isRls ? 'Permission denied by security policy' : `Update failed: ${error.message}`);
    } else {
      toast.success(next ? `Granted ${perm.name}` : `Revoked ${perm.name}`);
    }
  };

  const countForRole = (roleId: string) => {
    let n = 0;
    for (const key of mapping) if (key.startsWith(`${roleId}:`)) n++;
    return n;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Roles & Permissions Matrix
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage permissions assigned to each role. Changes are saved instantly.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role selector */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              return (
                <Button
                  key={role.id}
                  variant={active ? 'default' : 'ghost'}
                  className={cn('w-full justify-between', active && 'shadow-sm')}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {ROLE_DISPLAY[role.name] ?? role.name}
                  </span>
                  <Badge variant={active ? 'secondary' : 'outline'}>
                    {countForRole(role.id)}
                  </Badge>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Permission matrix */}
        <div className="lg:col-span-3 space-y-4">
          {selectedRole && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Editing:&nbsp;
                  <Badge>{ROLE_DISPLAY[selectedRole.name] ?? selectedRole.name}</Badge>
                </CardTitle>
                {selectedRole.description && (
                  <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
                )}
              </CardHeader>
            </Card>
          )}

          {Object.entries(grouped).map(([module, perms]) => (
            <Card key={module}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {module}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {perms.map((perm) => {
                    const key = selectedRoleId ? `${selectedRoleId}:${perm.id}` : '';
                    const checked = isChecked(perm.id);
                    const isPending = pending.has(key);
                    return (
                      <label
                        key={perm.id}
                        className={cn(
                          'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                          checked ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40',
                          isPending && 'opacity-70',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={isPending || !selectedRoleId}
                          onCheckedChange={(v) => togglePermission(perm, !!v)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono">{perm.name}</code>
                            {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          </div>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {perm.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {!permissions.length && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No permissions defined yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}