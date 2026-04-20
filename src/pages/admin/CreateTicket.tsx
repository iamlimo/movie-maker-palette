import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, X, AlertCircle, Check, Loader2, Mail, User, FileText, Tag, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketCategory, TicketPriority, UserType, UserSearchResult, PaymentResult, ContentResult, TicketTemplate } from '@/types/ticket';

const CATEGORIES: TicketCategory[] = ['Payment Issue', 'Streaming Issue', 'Account Issue', 'Creator Issue', 'Abuse / Fraud'];
const PRIORITIES: { label: string; value: TicketPriority; color: string }[] = [
  { label: 'Low', value: 'Low', color: 'bg-green-100 text-green-800 border-green-300' },
  { label: 'Medium', value: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { label: 'High', value: 'High', color: 'bg-red-100 text-red-800 border-red-300' },
];

interface AttachedItem {
  id: string;
  type: 'payment' | 'content';
  title: string;
}

export default function CreateTicket() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Form state
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [userType, setUserType] = useState<UserType>('Viewer');
  const [category, setCategory] = useState<TicketCategory>('Payment Issue');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [includeSystemLogs, setIncludeSystemLogs] = useState(false);
  const [templateUsed, setTemplateUsed] = useState<string>('');

  // Search and dropdown states
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentResults, setPaymentResults] = useState<PaymentResult[]>([]);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);

  const [contentSearch, setContentSearch] = useState('');
  const [contentResults, setContentResults] = useState<ContentResult[]>([]);
  const [showContentDropdown, setShowContentDropdown] = useState(false);

  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [duplicateCheckAlert, setDuplicateCheckAlert] = useState(false);
  const [existingTicket, setExistingTicket] = useState<string | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  // Debounced user search
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (userSearch.trim().length < 2) {
        setUserSearchResults([]);
        return;
      }

      setSearchingUsers(true);
      try {
        // Search in profiles table for email, username, or ID
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, email, name')
          .or(`email.ilike.%${userSearch}%,name.ilike.%${userSearch}%,user_id.eq.${userSearch}`)
          .limit(10);

        if (error) throw error;

        const results: UserSearchResult[] = data?.map(profile => ({
          id: profile.user_id,
          email: profile.email,
          username: profile.name,
        })) || [];

        setUserSearchResults(results);
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [userSearch]);

  // Debounced payment search
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (paymentSearch.trim().length < 2) {
        setPaymentResults([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('payments')
          .select('id, amount, status, created_at, transaction_id')
          .or(`id.eq.${paymentSearch},transaction_id.ilike.%${paymentSearch}%`)
          .limit(10);

        if (error) throw error;

        const results: PaymentResult[] = data?.map(payment => ({
          id: payment.id,
          transaction_id: payment.transaction_id,
          amount: payment.amount,
          status: payment.status,
          created_at: payment.created_at,
        })) || [];

        setPaymentResults(results);
      } catch (err) {
        console.error('Error searching payments:', err);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [paymentSearch]);

  // Debounced content search
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (contentSearch.trim().length < 2) {
        setContentResults([]);
        return;
      }

      try {
        // Search in both movies and tv_shows
        const [moviesResult, tvShowsResult] = await Promise.all([
          supabase
            .from('movies')
            .select('id, title, created_at')
            .ilike('title', `%${contentSearch}%`)
            .limit(5),
          supabase
            .from('tv_shows')
            .select('id, title, created_at')
            .ilike('title', `%${contentSearch}%`)
            .limit(5),
        ]);

        const results: ContentResult[] = [
          ...(moviesResult.data?.map(movie => ({
            id: movie.id,
            title: movie.title,
            type: 'movie' as const,
            created_at: movie.created_at,
          })) || []),
          ...(tvShowsResult.data?.map(show => ({
            id: show.id,
            title: show.title,
            type: 'tv_show' as const,
            created_at: show.created_at,
          })) || []),
        ];

        setContentResults(results);
      } catch (err) {
        console.error('Error searching content:', err);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [contentSearch]);

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTemplateUsed(templateId);
      setTitle(template.title);
      if (template.internal_note_template) setInternalNotes(template.internal_note_template);
      if (template.user_message_template) setUserMessage(template.user_message_template);
      setPriority(template.suggested_priority);
      setCategory(template.category as TicketCategory);
    }
  };

  const handleAddPayment = (payment: PaymentResult) => {
    if (!attachedItems.find(item => item.id === payment.id)) {
      setAttachedItems([
        ...attachedItems,
        {
          id: payment.id,
          type: 'payment',
          title: `Payment: ₦${(payment.amount / 100).toLocaleString('en-NG')} - ${payment.status}`,
        },
      ]);
    }
    setPaymentSearch('');
    setPaymentResults([]);
    setShowPaymentDropdown(false);
  };

  const handleAddContent = (content: ContentResult) => {
    if (!attachedItems.find(item => item.id === content.id)) {
      setAttachedItems([
        ...attachedItems,
        {
          id: content.id,
          type: 'content',
          title: `${content.type === 'movie' ? '🎬' : '📺'} ${content.title}`,
        },
      ]);
    }
    setContentSearch('');
    setContentResults([]);
    setShowContentDropdown(false);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedItems(attachedItems.filter(item => item.id !== id));
  };

  const checkDuplicateTicket = async (): Promise<string | null> => {
    if (!selectedUser || !title) return null;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('ticket_number, status')
        .eq('user_id', selectedUser.id)
        .eq('title', title)
        .eq('status', 'Open')
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0].ticket_number : null;
    } catch (err) {
      console.error('Error checking duplicate:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a user.' });
      return;
    }

    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a ticket title.' });
      return;
    }

    if (!userMessage.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a user-facing message.' });
      return;
    }

    // Check for duplicates
    const duplicateTicket = await checkDuplicateTicket();
    if (duplicateTicket) {
      setExistingTicket(duplicateTicket);
      setDuplicateCheckAlert(true);
      return;
    }

    await createTicket();
  };

  const createTicket = async () => {
    if (!selectedUser || !profile) return;

    setSubmitting(true);
    try {
      // Get attached IDs
      const attachedPaymentId = attachedItems.find(item => item.type === 'payment')?.id;
      const attachedContentId = attachedItems.find(item => item.type === 'content')?.id;

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          user_id: selectedUser.id,
          created_by: profile.user_id,
          title,
          description,
          category,
          priority,
          user_type: userType,
          internal_notes: internalNotes,
          user_message: userMessage,
          attached_payment_id: attachedPaymentId,
          attached_content_id: attachedContentId,
          include_system_logs: includeSystemLogs,
          template_used: templateUsed,
          status: 'Open',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Call edge function to send email notification
      try {
        const response = await fetch(
          `${supabase.supabaseUrl}/functions/v1/send-ticket-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              ticketId: ticket.id,
              ticketNumber: ticket.ticket_number,
              userId: selectedUser.id,
              userEmail: selectedUser.email,
              ticketTitle: title,
              ticketPriority: priority,
              userMessage,
            }),
          }
        );

        if (!response.ok) {
          console.warn('Email notification failed:', await response.text());
        }
      } catch (err) {
        console.warn('Error sending notification:', err);
      }

      toast({
        title: 'Success',
        description: `Ticket ${ticket.ticket_number} created successfully! User will be notified.`,
      });

      // Reset form
      setSelectedUser(null);
      setTitle('');
      setDescription('');
      setInternalNotes('');
      setUserMessage('');
      setAttachedItems([]);
      setIncludeSystemLogs(false);
      setTemplateUsed('');
      setPriority('Medium');
      setCategory('Payment Issue');

      // Navigate to tickets list after delay
      setTimeout(() => {
        navigate('/admin/tickets');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to create ticket.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const priorityConfig = PRIORITIES.find(p => p.value === priority);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Create Ticket</h1>
          <p className="text-slate-600">Proactively assist users or creators</p>
        </div>

        <div className="grid gap-6">
          {/* Target User Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <User className="w-5 h-5" />
                Target User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User Search */}
              <div className="space-y-2">
                <Label htmlFor="user-search" className="text-slate-700 font-medium">
                  Search by email, username, or ID
                </Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="user-search"
                      type="text"
                      placeholder="Search user..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      className="pl-10 border-slate-300 focus:ring-blue-500"
                    />
                    {searchingUsers && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                    )}
                  </div>

                  {showUserDropdown && userSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50">
                      {userSearchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => {
                            setSelectedUser(result);
                            setUserSearch('');
                            setShowUserDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="font-medium text-slate-900">{result.username || 'No name'}</div>
                          <div className="text-sm text-slate-500">{result.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected User Display */}
              {selectedUser && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{selectedUser.username || 'User'}</div>
                      <div className="text-sm text-slate-600">{selectedUser.email}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* User Type Toggle */}
              <div className="flex items-center gap-4 pt-2">
                <Label className="text-slate-700 font-medium">User Type:</Label>
                <div className="flex gap-2">
                  {['Viewer', 'Creator'].map((type) => (
                    <Button
                      key={type}
                      variant={userType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUserType(type as UserType)}
                      className={cn(
                        'px-4',
                        userType === type
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Details Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="w-5 h-5" />
                Ticket Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-slate-700 font-medium">
                    Category
                  </Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as TicketCategory)}>
                    <SelectTrigger id="category" className="border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Priority</Label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          'px-4 py-2 rounded-lg border-2 font-medium transition-all',
                          priority === p.value
                            ? p.color + ' border-current'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-700 font-medium">
                  Ticket Title *
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Brief description of the issue..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-slate-300 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700 font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Additional details about the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24 border-slate-300 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Context Attachment Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Tag className="w-5 h-5" />
                Context Attachments
              </CardTitle>
              <CardDescription>Optional: Attach relevant payments or content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Attach Payment */}
              <div className="space-y-2">
                <Label htmlFor="payment-search" className="text-slate-700 font-medium">
                  Attach Payment (by transaction ID)
                </Label>
                <div className="relative">
                  <Input
                    id="payment-search"
                    type="text"
                    placeholder="Search transaction ID..."
                    value={paymentSearch}
                    onChange={(e) => {
                      setPaymentSearch(e.target.value);
                      setShowPaymentDropdown(true);
                    }}
                    onFocus={() => setShowPaymentDropdown(true)}
                    className="border-slate-300 focus:ring-blue-500"
                  />

                  {showPaymentDropdown && paymentResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50">
                      {paymentResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleAddPayment(result)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-slate-900">
                                ₦{(result.amount / 100).toLocaleString('en-NG')}
                              </div>
                              <div className="text-sm text-slate-500">
                                ID: {result.transaction_id || result.id.slice(0, 8)}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {result.status}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attach Content */}
              <div className="space-y-2">
                <Label htmlFor="content-search" className="text-slate-700 font-medium">
                  Attach Content (by title)
                </Label>
                <div className="relative">
                  <Input
                    id="content-search"
                    type="text"
                    placeholder="Search movie or show..."
                    value={contentSearch}
                    onChange={(e) => {
                      setContentSearch(e.target.value);
                      setShowContentDropdown(true);
                    }}
                    onFocus={() => setShowContentDropdown(true)}
                    className="border-slate-300 focus:ring-blue-500"
                  />

                  {showContentDropdown && contentResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50">
                      {contentResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleAddContent(result)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="flex gap-2">
                            <span>{result.type === 'movie' ? '🎬' : '📺'}</span>
                            <div>
                              <div className="font-medium text-slate-900">{result.title}</div>
                              <div className="text-sm text-slate-500">
                                {result.type === 'movie' ? 'Movie' : 'TV Show'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attached Items Display */}
              {attachedItems.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="text-slate-700 font-medium">Attached Items:</Label>
                  <div className="flex flex-wrap gap-2">
                    {attachedItems.map((item) => (
                      <Badge
                        key={item.id}
                        variant="secondary"
                        className="px-3 py-1 flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors"
                      >
                        {item.title}
                        <button
                          onClick={() => handleRemoveAttachment(item.id)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* System Logs */}
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={includeSystemLogs}
                  onCheckedChange={setIncludeSystemLogs}
                  id="system-logs"
                />
                <Label htmlFor="system-logs" className="text-slate-700 cursor-pointer">
                  Include system logs
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Messages Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Mail className="w-5 h-5" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Internal Note */}
              <div className="space-y-2">
                <Label htmlFor="internal-notes" className="text-slate-700 font-medium">
                  Internal Note (Admin Only)
                </Label>
                <Textarea
                  id="internal-notes"
                  placeholder="For admin reference only - not visible to user..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="min-h-24 border-slate-300 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <Separator className="bg-slate-200" />

              {/* User-facing Message */}
              <div className="space-y-2">
                <Label htmlFor="user-message" className="text-slate-700 font-medium">
                  User-Facing Message * {userMessage.length > 0 && <span className="text-xs text-slate-500">({userMessage.length} characters)</span>}
                </Label>
                <Textarea
                  id="user-message"
                  placeholder="Message the user will receive..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  className="min-h-32 border-slate-300 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Template Section */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Clock className="w-5 h-5" />
                Quick Templates
              </CardTitle>
              <CardDescription>Auto-fill fields with predefined templates</CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {templates.map((template) => (
                    <Button
                      key={template.id}
                      variant="outline"
                      onClick={() => handleSelectTemplate(template.id)}
                      className={cn(
                        'justify-start text-left h-auto p-3 hover:bg-blue-50 border-slate-300',
                        templateUsed === template.id && 'bg-blue-100 border-blue-300'
                      )}
                    >
                      <div>
                        <div className="font-medium text-slate-900">{template.name}</div>
                        <div className="text-xs text-slate-500">{template.category}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No templates available</p>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end sticky bottom-0 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/tickets')}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedUser || !title}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Create Ticket
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Duplicate Alert */}
      <AlertDialog open={duplicateCheckAlert} onOpenChange={setDuplicateCheckAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Potential Duplicate Ticket
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              A ticket with the title "{title}" is already open for this user ({existingTicket}). Do you want to create anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateCheckAlert(false);
                createTicket();
              }}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
