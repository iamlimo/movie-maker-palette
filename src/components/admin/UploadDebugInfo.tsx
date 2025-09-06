import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';

export const UploadDebugInfo = () => {
  const { user, session } = useAuth();
  const { userRole, isSuperAdmin } = useRole();
  const [functionTest, setFunctionTest] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    const testFunction = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('upload-video', {
          body: {
            action: 'get_upload_info',
            fileName: 'test.jpg',
            fileSize: 1000,
            fileType: 'image/jpeg'
          }
        });
        
        if (error) {
          setFunctionTest({ success: false, error: error.message });
        } else {
          setFunctionTest({ success: true });
        }
      } catch (err) {
        setFunctionTest({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    };

    if (session && isSuperAdmin()) {
      testFunction();
    }
  }, [session, isSuperAdmin]);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Upload Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Authentication Status</p>
            <Badge variant={user ? "default" : "destructive"}>
              {user ? 'Authenticated' : 'Not Authenticated'}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm font-medium">User Role</p>
            <Badge variant={userRole === 'super_admin' ? "default" : "secondary"}>
              {userRole || 'No Role'}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm font-medium">Super Admin Check</p>
            <Badge variant={isSuperAdmin() ? "default" : "destructive"}>
              {isSuperAdmin() ? 'Yes' : 'No'}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm font-medium">Session Valid</p>
            <Badge variant={session ? "default" : "destructive"}>
              {session ? 'Valid' : 'Invalid'}
            </Badge>
          </div>
        </div>

        {functionTest && (
          <div className="mt-4 p-4 border rounded">
            <p className="text-sm font-medium mb-2">Upload Function Test</p>
            <Badge variant={functionTest.success ? "default" : "destructive"}>
              {functionTest.success ? 'Function Working' : 'Function Failed'}
            </Badge>
            {functionTest.error && (
              <p className="text-sm text-destructive mt-2">{functionTest.error}</p>
            )}
          </div>
        )}

        {user && (
          <div className="mt-4 p-4 bg-muted rounded text-xs">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Session Expires:</strong> {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};