import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, MoreHorizontal, Eye, Edit, Trash2, MessageSquare, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from '@/types/ticket';

const STATUS_COLORS: Record<TicketStatus, string> = {
  'Open': 'bg-blue-100 text-blue-800 border-blue-300',
  'In Progress': 'bg-purple-100 text-purple-800 border-purple-300',
  'Resolved': 'bg-green-100 text-green-800 border-green-300',
  'Closed': 'bg-gray-100 text-gray-800 border-gray-300',
  'On Hold': 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  'Low': 'bg-green-100 text-green-800 border-green-300',
  'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'High': 'bg-red-100 text-red-800 border-red-300',
};

export default function TicketsList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_number,
          title,
          user_id,
          created_by,
          assigned_to,
          category,
          priority,
          status,
          user_type,
          description,
          internal_notes,
          user_message,
          created_at,
          updated_at,
          resolved_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch tickets.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketToDelete.id);

      if (error) throw error;

      setTickets(tickets.filter(t => t.id !== ticketToDelete.id));
      toast({
        title: 'Success',
        description: `Ticket ${ticketToDelete.ticket_number} deleted successfully.`,
      });
      setShowDeleteDialog(false);
    } catch (err: any) {
      console.error('Error deleting ticket:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to delete ticket.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(
        tickets.map(t =>
          t.id === ticketId ? { ...t, status: newStatus } : t
        )
      );

      toast({
        title: 'Success',
        description: 'Ticket status updated.',
      });
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to update status.',
      });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchSearch =
      ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

    return matchSearch && matchStatus && matchPriority && matchCategory;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-white">Support Tickets</h1>
            <p className="text-orange-200">Manage user and creator support tickets</p>
          </div>
          <Button
            onClick={() => navigate('/admin/tickets/create')}
            className="bg-orange-600 text-white hover:bg-orange-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Ticket
          </Button>
        </div>

        {/* Filters Card */}
        <Card className="border-orange-400/30 shadow-sm bg-white/5 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-orange-400" />
                <Input
                  type="text"
                  placeholder="Search ticket number, title, or user ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-orange-400/30 bg-white/5 text-white placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-500/20"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] border-orange-400/30 bg-white/5 text-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px] border-orange-400/30 bg-white/5 text-white">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px] border-orange-400/30 bg-white/5 text-white">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Payment Issue">Payment Issue</SelectItem>
                  <SelectItem value="Streaming Issue">Streaming Issue</SelectItem>
                  <SelectItem value="Account Issue">Account Issue</SelectItem>
                  <SelectItem value="Creator Issue">Creator Issue</SelectItem>
                  <SelectItem value="Abuse / Fraud">Abuse / Fraud</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card className="border-orange-400/30 shadow-sm overflow-hidden bg-white/5 backdrop-blur-xl border">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="w-12 h-12 text-orange-300 mb-4" />
              <h3 className="text-lg font-medium text-orange-100 mb-1">No tickets found</h3>
              <p className="text-orange-200 mb-6">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first ticket to get started'}
              </p>
              <Button
                onClick={() => navigate('/admin/tickets/create')}
                className="bg-orange-600 text-white hover:bg-orange-700 gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Ticket
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-orange-400/30 bg-orange-500/10">
                    <TableHead className="text-orange-300 font-semibold">Ticket</TableHead>
                    <TableHead className="text-orange-300 font-semibold">Title</TableHead>
                    <TableHead className="text-orange-300 font-semibold">Category</TableHead>
                    <TableHead className="text-orange-300 font-semibold">Priority</TableHead>
                    <TableHead className="text-orange-300 font-semibold">Status</TableHead>
                    <TableHead className="text-orange-300 font-semibold">Created</TableHead>
                    <TableHead className="text-orange-300 font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id} className="border-b border-orange-400/20 hover:bg-orange-500/10 transition-colors">
                      <TableCell className="font-mono text-sm text-orange-400 font-medium">
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium text-white truncate">{ticket.title}</div>
                          <div className="text-xs text-orange-300">{ticket.user_type}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs text-white border-orange-400/30 bg-orange-500/10">
                          {ticket.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn('text-xs border', PRIORITY_COLORS[ticket.priority])}
                          variant="outline"
                        >
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'text-xs border',
                                STATUS_COLORS[ticket.status]
                              )}
                            >
                              {ticket.status}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {['Open', 'In Progress', 'Resolved', 'On Hold', 'Closed'].map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => handleStatusChange(ticket.id, status as TicketStatus)}
                                className={ticket.status === status ? 'bg-slate-100' : ''}
                              >
                                {status}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-400" />
                          {getTimeAgo(ticket.created_at)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/admin/tickets/${ticket.id}/edit`)}
                              className="gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                            >
                              <MessageSquare className="w-4 h-4" />
                              View Comments
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setTicketToDelete(ticket);
                                setShowDeleteDialog(true);
                              }}
                              className="gap-2 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Stats */}
        {filteredTickets.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-orange-400/30 shadow-sm bg-white/5 backdrop-blur-xl border">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-400">
                  {filteredTickets.filter(t => t.status === 'Open').length}
                </div>
                <p className="text-sm text-orange-200 mt-1">Open Tickets</p>
              </CardContent>
            </Card>
            <Card className="border-orange-400/30 shadow-sm bg-white/5 backdrop-blur-xl border">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-400">
                  {filteredTickets.filter(t => t.priority === 'High').length}
                </div>
                <p className="text-sm text-orange-200 mt-1">High Priority</p>
              </CardContent>
            </Card>
            <Card className="border-orange-400/30 shadow-sm bg-white/5 backdrop-blur-xl border">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-400">
                  {filteredTickets.filter(t => t.status === 'Resolved').length}
                </div>
                <p className="text-sm text-orange-200 mt-1">Resolved</p>
              </CardContent>
            </Card>
            <Card className="border-orange-400/30 shadow-sm bg-white/5 backdrop-blur-xl border">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-400">
                  {filteredTickets.length}
                </div>
                <p className="text-sm text-orange-200 mt-1">Total Tickets</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Delete Alert Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-orange-400/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-300">Delete Ticket</AlertDialogTitle>
            <AlertDialogDescription className="text-orange-200">>
              Are you sure you want to delete ticket {ticketToDelete?.ticket_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-orange-400/30 text-orange-200 hover:bg-orange-500/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTicket}
              disabled={deleting}
              className="bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
