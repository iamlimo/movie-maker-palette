import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatNaira } from '@/lib/priceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Copy, RefreshCw, Tag, Eye } from 'lucide-react';

interface ReferralCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  times_used: number;
  max_uses_per_user: number;
  min_purchase_amount: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface CodeUse {
  id: string;
  user_id: string;
  discount_applied: number;
  created_at: string;
}

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export default function ReferralCodes() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUses, setShowUses] = useState<string | null>(null);
  const [uses, setUses] = useState<CodeUse[]>([]);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    max_uses: '',
    max_uses_per_user: '1',
    min_purchase_amount: '',
    valid_until: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCodes(data as ReferralCode[]);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.discount_value) {
      toast({ title: 'Missing fields', description: 'Code and discount value are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const discountValue = form.discount_type === 'fixed'
      ? Math.round(parseFloat(form.discount_value) * 100) // Convert naira to kobo
      : parseFloat(form.discount_value);

    const { error } = await supabase.from('referral_codes').insert({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: discountValue,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      max_uses_per_user: parseInt(form.max_uses_per_user) || 1,
      min_purchase_amount: form.min_purchase_amount ? Math.round(parseFloat(form.min_purchase_amount) * 100) : 0,
      valid_until: form.valid_until || null,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message.includes('unique') ? 'Code already exists' : error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Code created' });
      setShowCreate(false);
      setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', max_uses_per_user: '1', min_purchase_amount: '', valid_until: '' });
      fetchCodes();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('referral_codes').update({ is_active: !current }).eq('id', id);
    fetchCodes();
  };

  const deleteCode = async (id: string) => {
    if (!confirm('Delete this referral code?')) return;
    await supabase.from('referral_codes').delete().eq('id', id);
    fetchCodes();
  };

  const viewUses = async (codeId: string) => {
    setShowUses(codeId);
    const { data } = await supabase
      .from('referral_code_uses')
      .select('*')
      .eq('code_id', codeId)
      .order('created_at', { ascending: false });
    setUses((data || []) as CodeUse[]);
  };

  const formatDiscount = (code: ReferralCode) => {
    if (code.discount_type === 'percentage') return `${code.discount_value}%`;
    return formatNaira(code.discount_value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Codes</h1>
          <p className="text-muted-foreground">Manage promo and referral codes</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Code
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Per User</TableHead>
              <TableHead>Min Purchase</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : codes.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No referral codes yet</TableCell></TableRow>
            ) : codes.map(code => (
              <TableRow key={code.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{code.code}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(code.code); toast({ title: 'Copied!' }); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={code.discount_type === 'percentage' ? 'default' : 'secondary'}>
                    {formatDiscount(code)} off
                  </Badge>
                </TableCell>
                <TableCell>{code.times_used}{code.max_uses ? `/${code.max_uses}` : ''}</TableCell>
                <TableCell>{code.max_uses_per_user}</TableCell>
                <TableCell>{code.min_purchase_amount > 0 ? formatNaira(code.min_purchase_amount) : '—'}</TableCell>
                <TableCell>{code.valid_until ? new Date(code.valid_until).toLocaleDateString() : 'No expiry'}</TableCell>
                <TableCell>
                  <Switch checked={code.is_active} onCheckedChange={() => toggleActive(code.id, code.is_active)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewUses(code.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCode(code.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Referral Code</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE20" className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setForm({ ...form, code: generateCode() })} title="Auto-generate">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v: 'percentage' | 'fixed') => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount (₦)'}</Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? '20' : '500'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Total Uses</Label>
                <Input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <Label>Max Per User</Label>
                <Input type="number" value={form.max_uses_per_user} onChange={e => setForm({ ...form, max_uses_per_user: e.target.value })} placeholder="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Purchase (₦)</Label>
                <Input type="number" value={form.min_purchase_amount} onChange={e => setForm({ ...form, min_purchase_amount: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Code'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage History Dialog */}
      <Dialog open={!!showUses} onOpenChange={() => setShowUses(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Usage History</DialogTitle></DialogHeader>
          {uses.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No uses recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uses.map(use => (
                  <TableRow key={use.id}>
                    <TableCell className="font-mono text-xs">{use.user_id.slice(0, 8)}...</TableCell>
                    <TableCell>{formatNaira(use.discount_applied)}</TableCell>
                    <TableCell>{new Date(use.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
