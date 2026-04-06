import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Send, Users, User, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface PushNotification {
  id: string;
  title: string;
  body: string;
  target: string;
  target_user_id: string | null;
  sent_count: number;
  created_at: string;
  data: any;
}

export default function PushNotifications() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [target, setTarget] = useState('all');
  const [targetEmail, setTargetEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [history, setHistory] = useState<PushNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('push_notifications' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setHistory(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSend = async () => {
    setSending(true);
    try {
      let targetUserId = null;

      if (target === 'user') {
        if (!targetEmail.trim()) {
          toast({ title: 'Error', description: 'Please enter a user email', variant: 'destructive' });
          setSending(false);
          return;
        }
        // Look up user by email
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', targetEmail.trim())
          .single();

        if (!profile) {
          toast({ title: 'Error', description: 'User not found with that email', variant: 'destructive' });
          setSending(false);
          return;
        }
        targetUserId = profile.user_id;
      }

      const notifData: any = {};
      if (deepLink.trim()) notifData.deepLink = deepLink.trim();

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title: title.trim(),
          body: body.trim(),
          data: notifData,
          target,
          target_user_id: targetUserId,
        },
      });

      if (error) throw error;

      toast({
        title: 'Notification sent',
        description: `Delivered to ${data?.sent_count || 0} device(s)`,
      });

      setTitle('');
      setBody('');
      setDeepLink('');
      setTarget('all');
      setTargetEmail('');
      setConfirmOpen(false);
      fetchHistory();
    } catch (err: any) {
      toast({
        title: 'Failed to send',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Push Notifications</h1>
          <p className="text-muted-foreground">Send push notifications to app users</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target Audience</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="user">Specific User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              placeholder="Notification message body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
          </div>

          {target === 'user' && (
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="deepLink">Deep Link (optional)</Label>
            <Input
              id="deepLink"
              placeholder="/movie/my-movie-slug"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              App route to navigate when notification is tapped (e.g. /movies, /movie/slug)
            </p>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button disabled={!title.trim() || !body.trim()}>
                <Bell className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Send</DialogTitle>
                <DialogDescription>
                  You're about to send a push notification to{' '}
                  {target === 'all' ? 'all users' : targetEmail || 'a specific user'}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p><strong>Title:</strong> {title}</p>
                <p><strong>Message:</strong> {body}</p>
                {deepLink && <p><strong>Deep Link:</strong> {deepLink}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? 'Sending...' : 'Confirm Send'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Notification History
            </span>
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No notifications sent yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((notif) => (
                    <TableRow key={notif.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{notif.title}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{notif.body}</TableCell>
                      <TableCell>
                        <Badge variant={notif.target === 'all' ? 'default' : 'secondary'}>
                          {notif.target === 'all' ? (
                            <><Users className="h-3 w-3 mr-1" />All</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" />User</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{notif.sent_count}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(notif.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
