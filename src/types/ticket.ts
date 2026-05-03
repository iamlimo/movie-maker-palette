// Ticket Types
export type TicketCategory = 'Payment Issue' | 'Streaming Issue' | 'Account Issue' | 'Creator Issue' | 'Abuse / Fraud';
export type TicketPriority = 'Low' | 'Medium' | 'High';
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'On Hold';
export type UserType = 'Viewer' | 'Creator';

export interface Ticket {
  id: string;
  ticket_number: string;
  user_id: string;
  assigned_to?: string;
  created_by: string;
  title: string;
  description?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  user_type: UserType;
  internal_notes?: string;
  user_message: string;
  attached_payment_id?: string;
  attached_content_id?: string;
  include_system_logs: boolean;
  is_admin_created: boolean;
  template_used?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  comment_text: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketTemplate {
  id: string;
  name: string;
  category: TicketCategory;
  title: string;
  internal_note_template?: string;
  user_message_template?: string;
  suggested_priority: TicketPriority;
  created_at: string;
  updated_at: string;
}

export interface TicketActivityLog {
  id: string;
  ticket_id: string;
  action: string;
  old_value?: string;
  new_value?: string;
  performed_by: string;
  created_at: string;
}

export interface CreateTicketFormData {
  user_id: string;
  title: string;
  description?: string;
  category: TicketCategory;
  priority: TicketPriority;
  user_type: UserType;
  internal_notes?: string;
  user_message: string;
  attached_payment_id?: string;
  attached_content_id?: string;
  include_system_logs: boolean;
  template_used?: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  role?: string;
}

export interface PaymentResult {
  id: string;
  transaction_id?: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface ContentResult {
  id: string;
  title: string;
  type: 'movie' | 'tv_show' | 'episode';
  created_at: string;
}
