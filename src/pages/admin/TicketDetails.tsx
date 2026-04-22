import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Loader2, Send, MessageSquare, Mail, FileText, AlertCircle, Clock, User, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Ticket, TicketComment, TicketStatus } from '@/types/ticket';

const STATUS_COLORS: Record<TicketStatus, string> = {
  'Open': 'bg-white/10 text-white border-white/20',
  'In Progress': 'bg-white/10 text-white border-white/20',
  'Resolved': 'bg-white/10 text-white border-white/20',
  'Closed': 'bg-white/10 text-white border-white/20',
  'On Hold': 'bg-white/10 text-white border-white/20',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Low': 'bg-white/10 text-white border-white/20',
  'Medium': 'bg-white/10 text-white border-white/20',
  'High': 'bg-white/10 text-white border-white/20',
};

export default function TicketDetails() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
      fetchComments();
      fetchUsers();
    }
  }, [ticketId]);

const fetchTicket = async () => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) throw error;

    setTicket(data);

    // 👇 fetch user after
    if (data?.user_id) {
      const { data: user } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', data.user_id)
        .single();

      setUserProfile(user);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};
  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, name')
        .limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !profile) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          author_id: profile.user_id,
          comment_text: newComment,
          is_internal: isInternalComment,
        });

      if (error) throw error;

      setNewComment('');
      await fetchComments();

      toast({
        title: 'Success',
        description: 'Comment added successfully.',
      });
    } catch (err: any) {
      console.error('Error adding comment:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to add comment.',
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, status: newStatus });

      toast({
        title: 'Success',
        description: 'Status updated successfully.',
      });
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to update status.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

 const handleAssigneeChange = async (userId: string | null) => {
  if (!ticket) return;

  setUpdatingAssignee(true);
  try {
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: userId })
      .eq('id', ticket.id);

    if (error) throw error;

    setTicket({ ...ticket, assigned_to: userId || undefined });

    toast({
      title: 'Success',
      description: 'Assignee updated successfully.',
    });
  } catch (err: any) {
    console.error('Error updating assignee:', err);
    toast({
      variant: 'destructive',
      title: 'Error',
      description: err.message || 'Failed to update assignee.',
    });
  } finally {
    setUpdatingAssignee(false);
  }
};

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black to-slate-900 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-orange-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Ticket not found</h1>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/tickets')}
              className="mt-6 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tickets
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/tickets')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">{ticket.ticket_number}</h1>
              <p className="text-orange-300">{ticket.title}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Details Card */}
            <Card className="border border-white/10 bg-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5 text-white/70" />
                  Ticket Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.description && (
                  <>
                    <div>
                      <h3 className="font-medium text-white/70 mb-2">Description</h3>
                      <p className="text-white/60 whitespace-pre-wrap">{ticket.description}</p>
                    </div>
                    <Separator className="bg-white/10" />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-white/50">Category</p>
                    <Badge variant="outline" className="text-white/70 border-white/20 bg-white/5">{ticket.category}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">User Type</p>
                    <Badge variant="outline" className="text-white/70 border-white/20 bg-white/5">{ticket.user_type}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Created</p>
                    <p className="text-sm font-medium text-white/70">{formatDate(ticket.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">User ID</p>
                    <p className="text-xs font-mono text-white/50">{userProfile?.name || userProfile?.email || 'Unknown User'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User-facing Message */}
            <Card className="border border-white/10 bg-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Mail className="w-5 h-5 text-white/70" />
                  User-Facing Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-white/70 whitespace-pre-wrap">{ticket.user_message}</p>
                </div>
              </CardContent>
            </Card>

            {/* Internal Notes */}
            {ticket.internal_notes && (
              <Card className="border border-white/10 bg-black">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <AlertCircle className="w-5 h-5 text-white/70" />
                    Internal Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <p className="text-white/70 whitespace-pre-wrap">{ticket.internal_notes}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments Section */}
            <Card className="border border-white/10 bg-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MessageSquare className="w-5 h-5 text-white/70" />
                  Comments ({comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Comments List */}
                {comments.length === 0 ? (
                  <p className="text-white/50 text-sm text-center py-8">No comments yet</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          comment.is_internal
                            ? 'bg-white/10 border-white/20'
                            : 'bg-white/5 border-white/10'
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-white/50" />
                            {comment.is_internal && (
                              <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-white/20">Internal</Badge>
                            )}
                          </div>
                          <span className="text-xs text-white/50">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-white/70 whitespace-pre-wrap">
                          {comment.comment_text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="bg-white/10" />

                {/* Add Comment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="internal-comment" className="flex items-center gap-2 cursor-pointer">
                      <input
                        id="internal-comment"
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="rounded border-white/20 bg-white/5 text-white"
                      />
                      <span className="text-sm text-white/70">Internal comment (admin only)</span>
                    </label>
                  </div>
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-24 border-white/10 bg-white/5 text-white placeholder-white/40 focus:ring-white/10 focus:border-white/20"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={submittingComment || !newComment.trim()}
                    className="gap-2 bg-white text-black hover:bg-white/90"
                  >
                    {submittingComment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Add Comment
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border border-white/10 bg-black">
              <CardHeader>
                <CardTitle className="text-white">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={ticket.status}
                  onValueChange={(value) => handleStatusChange(value as TicketStatus)}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className={cn('border-2', STATUS_COLORS[ticket.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Priority & Category */}
            <Card className="border border-white/10 bg-black">
              <CardHeader>
                <CardTitle className="text-white">Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  className={cn('text-xs border w-full justify-center py-2', PRIORITY_COLORS[ticket.priority])}
                  variant="outline"
                >
                  {ticket.priority}
                </Badge>
              </CardContent>
            </Card>

            {/* Assignee Card */}
          <Card className="border border-white/10 bg-black">
  <CardHeader>
    <CardTitle className="text-white">Assigned To</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    <Select
      value={ticket.assigned_to ?? 'unassigned'} // ✅ never empty string
      onValueChange={(value) =>
        handleAssigneeChange(value === 'unassigned' ? null : value)
      }
      disabled={updatingAssignee}
    >
      <SelectTrigger className="border-white/10 bg-white/5 text-white">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>

      <SelectContent className="bg-black border-white/10">
        <SelectItem value="unassigned">Unassigned</SelectItem> {/* ✅ FIX */}

        {users.map((user) => (
          <SelectItem key={user.user_id} value={user.user_id}>
            {user.name || user.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
            {/* Timeline */}
            <Card className="border border-white/10 bg-black">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-white/70" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-white/50">Created</p>
                  <p className="font-medium text-white/70">{formatDate(ticket.created_at)}</p>
                </div>
                <div>
                  <p className="text-white/50">Updated</p>
                  <p className="font-medium text-white/70">{formatDate(ticket.updated_at)}</p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <p className="text-white/50">Resolved</p>
                    <p className="font-medium text-white/70">{formatDate(ticket.resolved_at)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Badge */}
            {ticket.status === 'Resolved' && (
              <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-center">
                <CheckCircle className="w-6 h-6 text-white/70 mx-auto mb-2" />
                <p className="text-sm font-medium text-white/70">Ticket Resolved</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
