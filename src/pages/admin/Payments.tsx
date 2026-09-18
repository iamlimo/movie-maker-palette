import React, { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import AdminSyncPaystackButton from '@/components/admin/AdminSyncPaystackButton';
import { useToast } from '@/hooks/use-toast';

export default function Payments() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runSearch = async () => {
    if (!query) return toast({ title: 'Enter reference or id' });
    setLoading(true);
    try {
      // Try exact id or intent_id first, then provider_reference ilike
      const { data: byId } = await supabase
        .from('payments')
        .select('*')
        .or(`id.eq.${query},intent_id.eq.${query}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (byId && byId.length > 0) {
        setResults(byId);
      } else {
        const { data: byRef } = await supabase
          .from('payments')
          .select('*')
          .ilike('provider_reference', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(50);
        setResults(byRef || []);
      }
    } catch (err) {
      console.error('payments search error', err);
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      const start = p * pageSize;
      const end = start + pageSize - 1;
      const { data } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .range(start, end);
      setResults(data || []);
      setPage(p);
    } catch (err) {
      console.error('payments page load error', err);
      toast({ title: 'Failed to load payments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Load first page by default
  React.useEffect(() => { loadPage(0); }, []);

  return (
    <AdminLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Admin Payments</CardTitle>
            <CardDescription>Search payments by reference, intent id, or payment id</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Enter reference or id" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button onClick={runSearch} disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>
            </div>

            {results.length === 0 ? (
              <div className="text-sm text-muted-foreground">No results</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th>id</th>
                      <th>user_id</th>
                      <th>purpose</th>
                      <th>amount</th>
                      <th>status</th>
                      <th>provider_ref</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2 font-mono text-xs">{p.id}</td>
                        <td className="py-2">{p.user_id}</td>
                        <td className="py-2">{p.purpose}</td>
                        <td className="py-2">{(p.amount/100).toFixed(2)}</td>
                        <td className="py-2">{p.enhanced_status}</td>
                        <td className="py-2">{p.provider_reference || p.intent_id}</td>
                        <td className="py-2">
                          <AdminSyncPaystackButton reference={p.provider_reference || p.intent_id || p.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">Page: {page + 1}</div>
              <div className="flex gap-2">
                <Button disabled={loading || page <= 0} onClick={() => loadPage(page - 1)}>Prev</Button>
                <Button disabled={loading || results.length < pageSize} onClick={() => loadPage(page + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
