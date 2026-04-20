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
import { Search, X, AlertCircle, Check, Loader2, Mail, User, FileText, Tag, Clock, Send, Link2, DollarSign, Zap, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketCategory, TicketPriority, UserType, UserSearchResult, PaymentResult, ContentResult, TicketTemplate } from '@/types/ticket';

const CATEGORIES: TicketCategory[] = ['Payment Issue', 'Streaming Issue', 'Account Issue', 'Creator Issue', 'Abuse / Fraud'];
const PRIORITIES: { label: string; value: TicketPriority; color: string }[] = [
  { label: 'Low', value: 'Low', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' },
  { label: 'Medium', value: 'Medium', color: 'bg-amber-500/20 text-amber-300 border-amber-400/50' },
  { label: 'High', value: 'High', color: 'bg-red-500/20 text-red-300 border-red-400/50' },
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

  // Helper function to check if string looks like a UUID
  const isLikelyUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
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
        // Build filter string - only include UUID check if search looks like UUID
        let filterString = `email.ilike.%${userSearch}%,name.ilike.%${userSearch}%`;
        if (isLikelyUUID(userSearch)) {
          filterString += `,user_id.eq.${userSearch}`;
        }

        // Search in profiles table for email, username, or ID
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, email, name')
          .or(filterString)
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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Create Support Ticket</h1>
              <p className="text-purple-200 text-sm mt-1">Assist users or creators with their issues</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Left Side (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Target User Section */}
            <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl hover:shadow-orange-500/10 transition-all duration-300">
              <CardHeader className="pb-4 border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <User className="w-5 h-5 text-orange-400" />
                  </div>
                  Select User
                </CardTitle>
                <CardDescription className="text-orange-200">Choose the user this ticket is for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* User Search */}
                <div className="space-y-2">
                  <Label className="text-white font-semibold">Search by email, username, or ID</Label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-orange-300" />
                    <Input
                      type="text"
                      placeholder="Type to search..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      className="pl-12 bg-white/5 border-orange-400/30 text-white placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-500/20 transition-all"
                    />
                    {searchingUsers && (
                      <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />
                    )}
                  </div>

                  {showUserDropdown && userSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-orange-400/30 rounded-xl shadow-2xl z-50 overflow-hidden">
                      {userSearchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => {
                            setSelectedUser(result);
                            setUserSearch('');
                            setShowUserDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-orange-500/20 border-b border-orange-400/10 last:border-0 transition-colors group"
                        >
                          <div className="font-medium text-white group-hover:text-orange-300">{result.username || 'User'}</div>
                          <div className="text-sm text-orange-300">{result.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected User Display */}
                {selectedUser && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-400/30 rounded-xl p-4 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{selectedUser.username || 'User'}</div>
                        <div className="text-sm text-orange-300">{selectedUser.email}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUser(null)}
                      className="text-orange-300 hover:text-white hover:bg-orange-500/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* User Type Toggle */}
                <div className="pt-2 space-y-3">
                  <Label className="text-white font-semibold">User Type</Label>
                  <div className="flex gap-2">
                    {['Viewer', 'Creator'].map((type) => (
                      <Button
                        key={type}
                        variant={userType === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setUserType(type as UserType)}
                        className={cn(
                          'flex-1 font-medium transition-all',
                          userType === type
                            ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white border-0 shadow-lg'
                            : 'bg-white/5 border-orange-400/30 text-orange-200 hover:bg-white/10 hover:border-orange-400/50'
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
            <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl hover:shadow-orange-500/10 transition-all duration-300">
              <CardHeader className="pb-4 border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <FileText className="w-5 h-5 text-orange-400" />
                  </div>
                  Ticket Details
                </CardTitle>
                <CardDescription className="text-orange-200">Define the issue and set priority</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div className="space-y-2">
                    <Label className="text-white font-semibold flex items-center gap-2">
                      <Tag className="w-4 h-4 text-orange-400" />
                      Category
                    </Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as TicketCategory)}>
                      <SelectTrigger className="bg-white/5 border-orange-400/30 text-white focus:border-orange-400 focus:ring-orange-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-orange-400/30">
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-white hover:bg-orange-500/20">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label className="text-white font-semibold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-400" />
                      Priority
                    </Label>
                    <div className="flex gap-2">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setPriority(p.value)}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all border',
                            priority === p.value
                              ? `${p.color} border-current shadow-lg scale-105`
                              : 'bg-white/5 border-orange-400/30 text-orange-200 hover:bg-white/10'
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
                  <Label className="text-white font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    Ticket Title
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Brief description of the issue..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-white/5 border-orange-400/30 text-white placeholder:text-orange-400 focus:border-orange-400 focus:ring-orange-500/20"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-white font-semibold">Description</Label>
                  <Textarea
                    placeholder="Additional details about the issue..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24 bg-white/5 border-orange-400/30 text-white placeholder:text-orange-400 focus:border-orange-400 focus:ring-orange-500/20 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Messages Section */}
            <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl hover:shadow-orange-500/10 transition-all duration-300">
              <CardHeader className="pb-4 border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Mail className="w-5 h-5 text-green-400" />
                  </div>
                  Messages & Communication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {/* Internal Note */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-orange-400" />
                    <Label className="text-white font-semibold">Internal Note</Label>
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-0">Admin Only</Badge>
                  </div>
                  <Textarea
                    placeholder="Private notes - not visible to the user..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="min-h-24 bg-white/5 border-orange-400/30 text-white placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-500/20 resize-none"
                  />
                </div>

                <Separator className="bg-white/10" />

                {/* User-facing Message */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-white font-semibold flex items-center gap-2">
                      <Send className="w-4 h-4 text-green-400" />
                      User-Facing Message
                      <span className="text-red-400">*</span>
                    </Label>
                    {userMessage.length > 0 && (
                      <span className="text-xs text-orange-300">
                        {userMessage.length} / 1000 characters
                      </span>
                    )}
                  </div>
                  <Textarea
                    placeholder="This message will be sent to the user via email..."
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    maxLength={1000}
                    className="min-h-32 bg-white/5 border-orange-400/30 text-white placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-500/20 resize-none"
                  />
                  <p className="text-xs text-orange-300">This message will be included in the notification email.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Side (1/3) */}
          <div className="space-y-6">
            {/* Context Attachments */}
            <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl">
              <CardHeader className="pb-4 border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-white text-base">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* Attach Payment */}
                <div className="space-y-2">
                  <Label className="text-white font-semibold text-sm">Payment</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-orange-400" />
                    <Input
                      type="text"
                      placeholder="Transaction ID..."
                      value={paymentSearch}
                      onChange={(e) => {
                        setPaymentSearch(e.target.value);
                        setShowPaymentDropdown(true);
                      }}
                      onFocus={() => setShowPaymentDropdown(true)}
                      className="pl-10 bg-white/5 border-orange-400/30 text-white placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-500/20 text-sm"
                    />

                    {showPaymentDropdown && paymentResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-orange-400/30 rounded-lg shadow-xl z-40 overflow-hidden">
                        {paymentResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleAddPayment(result)}
                            className="w-full text-left px-3 py-2 hover:bg-orange-500/20 border-b border-orange-400/10 last:border-0 transition-colors text-sm"
                          >
                            <div className="font-medium text-white">{result.transaction_id}</div>
                            <div className="text-xs text-orange-300">₦{(result.amount / 100).toLocaleString()}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Attach Content */}
                <div className="space-y-2">
                  <Label className="text-white font-semibold text-sm">Content</Label>
                  <div className="relative">
                    <Play className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-orange-400" />
                    <Input
                      type="text"
                      placeholder="Movie or show..."
                      value={contentSearch}
                      onChange={(e) => {
                        setContentSearch(e.target.value);
                        setShowContentDropdown(true);
                      }}
                      onFocus={() => setShowContentDropdown(true)}
                      className="pl-10 bg-white/5 border-orange-400/30 text-white placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-500/20 text-sm"
                    />

                    {showContentDropdown && contentResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-orange-400/30 rounded-lg shadow-xl z-40 overflow-hidden">
                        {contentResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleAddContent(result)}
                            className="w-full text-left px-3 py-2 hover:bg-orange-500/20 border-b border-orange-400/10 last:border-0 transition-colors text-sm"
                          >
                            <div className="font-medium text-white flex items-center gap-2">
                              {result.type === 'movie' ? '🎬' : '📺'} {result.title}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Attached Items */}
                {attachedItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <p className="text-white font-semibold text-sm">Attached</p>
                    <div className="space-y-1.5">
                      {attachedItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-orange-500/10 border border-orange-400/30 rounded-lg px-3 py-2 group hover:bg-orange-500/20 transition-all"
                        >
                          <span className="text-xs text-orange-200">{item.title}</span>
                          <button
                            onClick={() => handleRemoveAttachment(item.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-orange-400 hover:text-orange-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* System Logs */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <Switch
                      checked={includeSystemLogs}
                      onCheckedChange={setIncludeSystemLogs}
                      id="system-logs"
                      className="data-[state=checked]:bg-purple-600"
                    />
                    <Label htmlFor="system-logs" className="text-white text-sm font-medium cursor-pointer flex-1">
                      Include System Logs
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Templates */}
            <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl">
              <CardHeader className="pb-4 border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-white text-base">
                  <Clock className="w-4 h-4 text-pink-400" />
                  Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-6">
                {templates.length > 0 ? (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        onClick={() => handleSelectTemplate(template.id)}
                        className={cn(
                          'justify-start text-left w-full h-auto p-3 transition-all text-sm',
                          templateUsed === template.id
                            ? 'bg-gradient-to-r from-orange-500/30 to-orange-600/30 border-orange-400/50 text-white'
                            : 'bg-white/5 border-orange-400/30 text-orange-200 hover:bg-white/10 hover:border-orange-400/50'
                        )}
                      >
                        <div className="text-left">
                          <div className="font-medium">{template.title}</div>
                          <div className="text-xs opacity-75">{template.category}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-purple-300 text-sm text-center py-4">No templates available</p>
                )}
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className="border-0 bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-xl shadow-2xl border border-orange-400/30">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-orange-400" />
                    <span className="text-white font-semibold">Ready to Create?</span>
                  </div>
                  <div className="space-y-1.5 text-sm text-orange-200">
                    <div className={selectedUser ? 'flex items-center gap-2 text-orange-300' : 'opacity-50'}>
                      <Check className="w-3.5 h-3.5" />
                      User selected
                    </div>
                    <div className={title ? 'flex items-center gap-2 text-orange-300' : 'opacity-50'}>
                      <Check className="w-3.5 h-3.5" />
                      Title filled
                    </div>
                    <div className={userMessage ? 'flex items-center gap-2 text-orange-300' : 'opacity-50'}>
                      <Check className="w-3.5 h-3.5" />
                      Message ready
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons - Sticky Footer */}
        <div className="sticky bottom-0 flex gap-3 justify-end bg-gradient-to-t from-black to-transparent p-6 -mx-4 px-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/tickets')}
            className="border-orange-400/30 text-orange-200 hover:bg-white/10 hover:border-orange-400/50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedUser || !title || !userMessage}
            className="bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Create Ticket
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Duplicate Alert */}
      <AlertDialog open={duplicateCheckAlert} onOpenChange={setDuplicateCheckAlert}>
        <AlertDialogContent className="bg-slate-900 border-orange-400/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              Duplicate Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="text-orange-200">
              A ticket with the title "{title}" is already open for this user ({existingTicket}). Do you want to create anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-orange-400/30 text-orange-200 hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateCheckAlert(false);
                createTicket();
              }}
              className="bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800"
            >
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
