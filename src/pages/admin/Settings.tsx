import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, KeyRound, ShieldCheck, FileText } from 'lucide-react';
import PermissionsMatrix from './PermissionsMatrix';
import AuditLogs from './AuditLogs';
import ReportsCompliance from './ReportsCompliance';

const VALID_TABS = ['general', 'permissions', 'audit', 'compliance'] as const;
type SettingsTab = typeof VALID_TABS[number];

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as SettingsTab | null;
  const initial: SettingsTab = requested && VALID_TABS.includes(requested) ? requested : 'general';

  const handleChange = (value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">System configuration, permissions, and audit trail</p>
      </div>

      <Tabs value={initial} onValueChange={handleChange} className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general" className="gap-2"><SettingsIcon className="h-4 w-4" /> General</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><KeyRound className="h-4 w-4" /> Permissions</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><ShieldCheck className="h-4 w-4" /> Audit Logs</TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2"><FileText className="h-4 w-4" /> Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>System-wide configuration and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                General settings panel coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsMatrix />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogs />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ReportsCompliance />
        </TabsContent>
      </Tabs>
    </div>
  );
}
