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
  'Open': 'bg-blue-100 text-blue-800 border-blue-300',
  'In Progress': 'bg-purple-100 text-purple-800 border-purple-300',
  'Resolved': 'bg-green-100 text-green-800 border-green-300',
  'Closed': 'bg-gray-100 text-gray-800 border-gray-300',
  'On Hold': 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Low': 'bg-green-100 text-green-800 border-green-300',
  'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'High': 'bg-red-100 text-red-800 border-red-300',
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
    } catch (err) {
      console.error('Error fetching ticket:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch ticket details.',
      });
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

  const handleAssigneeChange = async (userId: string) => {
    if (!ticket) return;

    setUpdatingAssignee(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: userId || null })
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">Ticket not found</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
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
              <h1 className="text-3xl font-bold text-slate-900">{ticket.ticket_number}</h1>
              <p className="text-slate-600">{ticket.title}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Details Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <FileText className="w-5 h-5" />
                  Ticket Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.description && (
                  <>
                    <div>
                      <h3 className="font-medium text-slate-900 mb-2">Description</h3>
                      <p className="text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
                    </div>
                    <Separator className="bg-slate-200" />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Category</p>
                    <Badge variant="outline">{ticket.category}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">User Type</p>
                    <Badge variant="outline">{ticket.user_type}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Created</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(ticket.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">User ID</p>
                    <p className="text-xs font-mono text-slate-600">{ticket.user_id.slice(0, 8)}...</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User-facing Message */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Mail className="w-5 h-5" />
                  User-Facing Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-slate-700 whitespace-pre-wrap">{ticket.user_message}</p>
                </div>
              </CardContent>
            </Card>

            {/* Internal Notes */}
            {ticket.internal_notes && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <AlertCircle className="w-5 h-5" />
                    Internal Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-slate-700 whitespace-pre-wrap">{ticket.internal_notes}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments Section */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <MessageSquare className="w-5 h-5" />
                  Comments ({comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Comments List */}
                {comments.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No comments yet</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          comment.is_internal
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-slate-50 border-slate-200'
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-slate-400" />
                            {comment.is_internal && (
                              <Badge variant="secondary" className="text-xs">Internal</Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {comment.comment_text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="bg-slate-200" />

                {/* Add Comment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="internal-comment" className="flex items-center gap-2 cursor-pointer">
                      <input
                        id="internal-comment"
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-600">Internal comment (admin only)</span>
                    </label>
                  </div>
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-24 border-slate-300 focus:ring-blue-500"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={submittingComment || !newComment.trim()}
                    className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
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
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Status</CardTitle>
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
                  <SelectContent>
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
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Priority</CardTitle>
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
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Assigned To</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={ticket.assigned_to || ''}
                  onValueChange={handleAssigneeChange}
                  disabled={updatingAssignee}
                >
                  <SelectTrigger className="border-slate-300">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
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
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-600">Created</p>
                  <p className="font-medium text-slate-900">{formatDate(ticket.created_at)}</p>
                </div>
                <div>
                  <p className="text-slate-600">Updated</p>
                  <p className="font-medium text-slate-900">{formatDate(ticket.updated_at)}</p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <p className="text-slate-600">Resolved</p>
                    <p className="font-medium text-slate-900">{formatDate(ticket.resolved_at)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Badge */}
            {ticket.status === 'Resolved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800">Ticket Resolved</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
