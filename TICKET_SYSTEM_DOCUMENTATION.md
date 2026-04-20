# Support Ticket System Documentation

## Overview

The Support Ticket System is a comprehensive admin dashboard feature that allows administrators to create, manage, and resolve support tickets for users and creators. The system includes automated email notifications, ticket tracking, commenting, and status management.

## Architecture

### Database Schema

#### Tables

**1. `tickets`** - Main tickets table
- `id` (UUID): Primary key
- `ticket_number` (TEXT): Unique friendly identifier (auto-generated: TKT-YYYYMMDD-XXXXX)
- `user_id` (UUID): Reference to affected user
- `assigned_to` (UUID): Admin/support staff assigned to ticket
- `created_by` (UUID): Admin who created the ticket
- `title` (TEXT): Brief ticket title
- `description` (TEXT): Detailed description
- `category` (TEXT): One of: Payment Issue, Streaming Issue, Account Issue, Creator Issue, Abuse / Fraud
- `priority` (TEXT): One of: Low, Medium, High
- `status` (TEXT): One of: Open, In Progress, Resolved, Closed, On Hold
- `user_type` (TEXT): Viewer or Creator
- `internal_notes` (TEXT): Admin-only notes
- `user_message` (TEXT): Message sent to user
- `attached_payment_id` (UUID): Reference to payment if relevant
- `attached_content_id` (UUID): Reference to content if relevant
- `include_system_logs` (BOOLEAN): Flag for including logs
- `is_admin_created` (BOOLEAN): Always true for admin-created tickets
- `template_used` (UUID): Template ID if created from template
- `notification_sent` (BOOLEAN): Flag indicating notification was sent
- `assigned_team` (TEXT): Team assignment (e.g., "support", "finance", "dev")
- `created_at`, `updated_at`, `resolved_at` (TIMESTAMP): Timestamps

**2. `ticket_comments`** - Comments/replies on tickets
- `id` (UUID): Primary key
- `ticket_id` (UUID): FK to tickets
- `author_id` (UUID): Comment author
- `comment_text` (TEXT): Comment content
- `is_internal` (BOOLEAN): Admin-only comment flag
- `created_at`, `updated_at` (TIMESTAMP): Timestamps

**3. `ticket_templates`** - Predefined ticket templates
- `id` (UUID): Primary key
- `name` (TEXT): Template name (unique)
- `category` (TEXT): Associated category
- `title` (TEXT): Template title
- `internal_note_template` (TEXT): Template for internal notes
- `user_message_template` (TEXT): Template for user message
- `suggested_priority` (TEXT): Default priority

**4. `ticket_activity_log`** - Audit trail
- `id` (UUID): Primary key
- `ticket_id` (UUID): FK to tickets
- `action` (TEXT): Action description
- `old_value`, `new_value` (TEXT): Before/after values
- `performed_by` (UUID): User performing action
- `created_at` (TIMESTAMP): Action timestamp

**5. `email_logs`** - Email delivery tracking
- `id` (UUID): Primary key
- `ticket_id` (UUID): FK to tickets
- `recipient_email` (TEXT): Email recipient
- `subject` (TEXT): Email subject
- `template_type` (TEXT): Email template used
- `status` (TEXT): One of: pending, sent, failed, bounced
- `external_id` (TEXT): External service message ID
- `error_message` (TEXT): Error details if failed
- `sent_at` (TIMESTAMP): When email was sent
- `created_at`, `updated_at` (TIMESTAMP): Timestamps

### File Structure

```
src/
├── pages/admin/
│   ├── CreateTicket.tsx          # Form for creating tickets
│   ├── TicketsList.tsx           # List view with filters
│   └── TicketDetails.tsx         # Detailed ticket view with comments
├── types/
│   └── ticket.ts                 # TypeScript interfaces
└── components/admin/
    └── AdminLayout.tsx           # Updated sidebar with Tickets link

supabase/
├── migrations/
│   ├── 20260420000000_create_tickets_system.sql
│   └── 20260420000001_add_email_logs_table.sql
└── functions/
    └── send-ticket-notification/
        └── index.ts              # Edge function for email notifications
```

## Components

### CreateTicket Page (`CreateTicket.tsx`)

**Features:**
- User search with real-time autocomplete
- Viewer/Creator user type toggle
- Category and priority selection
- Ticket title and description
- Internal notes (admin-only)
- User-facing message
- Context attachments (payments, content)
- System logs inclusion option
- Template dropdown with auto-fill
- Duplicate ticket detection
- Real-time validation

**Key Functions:**
- `handleSelectTemplate()`: Load template data into form
- `handleAddPayment()`: Attach payment to ticket
- `handleAddContent()`: Attach content to ticket
- `checkDuplicateTicket()`: Warn if similar ticket exists
- `createTicket()`: Submit and create ticket

**Styling:**
- Gradient background (slate-50 to slate-100)
- Clean card-based layout
- Color-coded priority badges
- Accessible form controls

### TicketsList Page (`TicketsList.tsx`)

**Features:**
- Table view of all tickets
- Search by ticket number, title, or user ID
- Filter by status, priority, category
- Quick status change dropdown
- Edit, view, delete actions
- Stats cards (open, high priority, resolved, total)
- Empty state with CTA
- Date formatting (time ago)

**Performance:**
- Lazy loading with Suspense
- Optimized queries
- Index-based sorting

### TicketDetails Page (`TicketDetails.tsx`)

**Features:**
- Full ticket information display
- Status change dropdown
- Assignee selection
- Comments section (internal & public)
- Timeline view
- User-facing message display
- Internal notes display
- Add new comments
- Real-time updates

## Edge Functions

### `send-ticket-notification` Function

**Location:** `supabase/functions/send-ticket-notification/index.ts`

**Purpose:**
- Send email notifications to users when a ticket is created
- Send admin notification
- Log email events for audit trail
- Update ticket status

**Trigger:**
Called from `CreateTicket.tsx` after ticket creation

**Payload:**
```typescript
{
  ticketId: string;
  ticketNumber: string;
  userId: string;
  userEmail: string;
  ticketTitle: string;
  ticketPriority: string;
  userMessage: string;
}
```

**Email Template:**
- Professional HTML email
- Ticket details and priority
- User-facing message
- Ticket number for reference
- Call-to-action buttons

**Environment Variables Required:**
- `RESEND_API_KEY`: Resend email service API key
- `ADMIN_EMAIL`: Admin email for notifications
- `SUPABASE_URL`: Supabase URL
- `SUPABASE_ANON_KEY`: Public anon key

**Response:**
```typescript
{
  success: boolean;
  message: string;
  ticketNumber: string;
}
```

**Error Handling:**
- Graceful email failure handling
- Detailed logging
- Email log creation for tracking

## Type Definitions

### Main Types (`types/ticket.ts`)

```typescript
type TicketCategory = 'Payment Issue' | 'Streaming Issue' | 'Account Issue' | 'Creator Issue' | 'Abuse / Fraud';
type TicketPriority = 'Low' | 'Medium' | 'High';
type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'On Hold';
type UserType = 'Viewer' | 'Creator';

interface Ticket { ... }
interface TicketComment { ... }
interface TicketTemplate { ... }
interface CreateTicketFormData { ... }
interface UserSearchResult { ... }
interface PaymentResult { ... }
interface ContentResult { ... }
```

## API Integration

### Supabase Database Queries

**Create Ticket:**
```typescript
supabase.from('tickets').insert({
  user_id, created_by, title, category, priority, status,
  user_type, internal_notes, user_message, ...
}).select().single();
```

**Fetch Tickets:**
```typescript
supabase.from('tickets').select('*').order('created_at', { ascending: false });
```

**Update Status:**
```typescript
supabase.from('tickets').update({ status }).eq('id', ticketId);
```

**Add Comment:**
```typescript
supabase.from('ticket_comments').insert({
  ticket_id, author_id, comment_text, is_internal
});
```

## Row Level Security (RLS)

### Tickets Table
- **Admins:** Can view/insert/update/delete all tickets
- **Users:** Can view only their own tickets
- **Assigned staff:** Can view tickets assigned to them

### Comments Table
- **Admins:** Can view all comments (including internal)
- **Users:** Can view only non-internal comments on their tickets
- **Authors:** Can insert comments on accessible tickets

### Email Logs Table
- **Admins:** Can view all email logs
- **Other users:** No access

### Templates Table
- **Everyone:** Can view templates
- **Admins:** Can insert/update templates

## Setup Instructions

### 1. Database Setup

Run the migrations in order:
```bash
# Apply tickets system migration
supabase migration up 20260420000000_create_tickets_system

# Apply email logs migration
supabase migration up 20260420000001_add_email_logs_table
```

### 2. Environment Variables

Add to `.env.local`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
RESEND_API_KEY=your_resend_api_key
ADMIN_EMAIL=admin@yourdomain.com
```

### 3. Edge Function Deployment

Deploy the edge function:
```bash
supabase functions deploy send-ticket-notification
```

Set environment variables in Supabase:
```bash
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set ADMIN_EMAIL=admin@yourdomain.com
```

### 4. Templates Setup

Default templates are auto-created:
- Payment Failure Notice
- Refund Processing
- Content Removal Notice
- Suspicious Activity Alert

Add more via the admin panel or directly in database.

## Usage Guide

### Creating a Ticket

1. Navigate to Admin Dashboard → Support → Create Ticket
2. Search and select target user
3. Choose user type (Viewer/Creator)
4. Fill in category and priority
5. Enter ticket title and description
6. (Optional) Add internal notes
7. Enter user-facing message
8. (Optional) Attach payments/content
9. (Optional) Select template to auto-fill
10. Click "Create Ticket"
11. User receives email notification

### Managing Tickets

1. Navigate to Admin Dashboard → Support → Tickets
2. Filter by status, priority, or category
3. Search by ticket number or user ID
4. Click on ticket to view details
5. Update status or assignee
6. Add internal or public comments
7. Monitor email delivery in email_logs table

### Viewing Ticket Details

1. Click ticket in list
2. View full information, messages, notes
3. See comment history
4. Add comments or change status
5. Assign to support staff
6. Track timeline

## Best Practices

### For Admins

1. **Set priority correctly** - High for revenue-impacting issues
2. **Use templates** - Speeds up ticket creation
3. **Add internal notes** - For team reference
4. **Assign promptly** - Assign to appropriate team member
5. **Update status** - Keep status current for tracking
6. **Close resolved tickets** - Maintain clean backlog

### For Ticket Creation

1. **Be specific** - Clear title and description help resolution
2. **Include context** - Attach relevant payments/content
3. **Use user message** - Explain clearly to user
4. **Set priority appropriately** - Not everything is urgent
5. **Follow up** - Check email delivery logs

### Email Notifications

1. **Check email logs** - Monitor delivery status
2. **Handle failures** - Resend manually if needed
3. **Rate limiting** - Don't create bulk tickets too fast
4. **Template testing** - Test emails before sending bulk

## Troubleshooting

### Email Not Sending

**Check:**
1. `RESEND_API_KEY` environment variable is set
2. Email address is valid
3. Check `email_logs` table for error messages
4. Verify edge function is deployed
5. Check Supabase logs for function errors

### Ticket Not Appearing

**Check:**
1. User search is working (check profiles table)
2. RLS policies are correctly configured
3. Ticket was successfully inserted in database
4. Check for any Supabase errors in browser console

### Comments Not Loading

**Check:**
1. Ticket ID is correct
2. ticket_comments table has correct FK
3. RLS policy allows viewing
4. Check for database query errors

## Performance Optimization

- **Indexed columns:** status, priority, category, created_at, user_id, assigned_to
- **Pagination:** Implement for large ticket lists
- **Caching:** Use React Query for ticket data
- **Lazy loading:** Comments load on demand

## Security Considerations

- **RLS Enabled:** All tables have row-level security
- **Admin-only:** Sensitive operations require admin role
- **Email logs:** Audit trail of all communications
- **Rate limiting:** Consider implementing email rate limits
- **Input validation:** All forms validated before submission

## Future Enhancements

1. **Bulk ticket creation** - UI hint and functionality
2. **Ticket merging** - Combine related tickets
3. **Canned responses** - Predefined response templates
4. **SLA tracking** - Response time monitoring
5. **Ticket escalation** - Auto-escalate based on criteria
6. **Webhooks** - External system integration
7. **Mobile app** - Mobile ticket management
8. **Survey/satisfaction** - Post-resolution feedback
9. **Analytics** - Ticket metrics and reporting
10. **Assignment rules** - Auto-assign based on category/priority

## Support & Maintenance

For issues or questions:
1. Check this documentation
2. Review Supabase logs
3. Check browser console for errors
4. Review database schema
5. Contact development team

---

**Last Updated:** April 20, 2026
**Version:** 1.0.0
**Status:** Production Ready
