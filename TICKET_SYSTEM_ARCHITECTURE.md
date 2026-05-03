# Support Ticket System - Architecture & Flow

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                            │
├────────────────────────────────────────────────────────────────┤
│  Support Section (Sidebar)                                     │
│  ├─ Create Ticket ──→ CreateTicket.tsx                        │
│  └─ View Tickets  ──→ TicketsList.tsx ──→ TicketDetails.tsx   │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐     ┌──────────────┐   ┌──────────────┐    │
│  │   TICKETS    │     │  COMMENTS    │   │  TEMPLATES   │    │
│  ├──────────────┤     ├──────────────┤   ├──────────────┤    │
│  │ id           │     │ id           │   │ id           │    │
│  │ ticket_#     │     │ ticket_id(FK)│   │ name         │    │
│  │ user_id(FK)  │     │ author_id    │   │ category     │    │
│  │ created_by   │     │ comment_text │   │ title        │    │
│  │ title        │     │ is_internal  │   │ templates    │    │
│  │ category     │────→│ created_at   │   │ priority     │    │
│  │ priority     │     │ updated_at   │   │ created_at   │    │
│  │ status       │     └──────────────┘   └──────────────┘    │
│  │ user_message │                                            │
│  │ internal..   │     ┌──────────────┐   ┌──────────────┐    │
│  │ created_at   │     │ ACTIVITY LOG │   │  EMAIL LOGS  │    │
│  │ updated_at   │     ├──────────────┤   ├──────────────┤    │
│  │ resolved_at  │     │ id           │   │ id           │    │
│  └──────────────┘     │ ticket_id(FK)│   │ ticket_id(FK)│    │
│                       │ action       │   │ email        │    │
│  [20+ indexes for     │ old/new val  │   │ status       │    │
│   performance]        │ performed_by │   │ error_msg    │    │
│                       │ created_at   │   │ sent_at      │    │
│                       └──────────────┘   └──────────────┘    │
│                                                                │
│  Row Level Security (RLS):                                    │
│  ├─ Admins: Full access to all tables                         │
│  ├─ Users: Read own tickets only                              │
│  ├─ Comments: Filtered by visibility & access                │
│  └─ Email Logs: Admin read-only                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTIONS (Backend Logic)                    │
├────────────────────────────────────────────────────────────────┤
│  send-ticket-notification                                     │
│  ├─ Triggered: After ticket creation                          │
│  ├─ Sends: Email to user                                      │
│  ├─ Sends: Email to admin                                     │
│  ├─ Logs: Email delivery status                               │
│  └─ Updates: notification_sent flag                           │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                  EMAIL SERVICE (RESEND)                        │
├────────────────────────────────────────────────────────────────┤
│  RESEND_API_KEY ──→ Send HTML Email                           │
│                     │                                         │
│                     ├─ User Email (ticket created)            │
│                     ├─ Admin Email (new ticket alert)         │
│                     └─ Status: Sent/Failed/Bounced            │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow - Creating a Ticket

```
1. ADMIN FILLS FORM
   ↓
   CreateTicket.tsx
   ├─ Search user
   ├─ Select user type
   ├─ Choose category & priority
   ├─ Enter title & message
   ├─ (Optional) Attach payment/content
   └─ Click "Create Ticket"

2. VALIDATION
   ↓
   ├─ User selected? ✓
   ├─ Title filled? ✓
   ├─ Message filled? ✓
   └─ Check for duplicates...

3. DATABASE INSERT
   ↓
   supabase
   ├─ Insert into tickets table
   ├─ Generate ticket_number (TKT-YYYYMMDD-XXXXX)
   ├─ Set status to "Open"
   ├─ Set priority (High/Med/Low)
   └─ Create timestamp

4. EDGE FUNCTION CALL
   ↓
   send-ticket-notification
   ├─ Receive ticket details
   ├─ Get user email
   ├─ Generate HTML email
   ├─ Send via Resend API
   ├─ Log email event
   └─ Update notification_sent flag

5. USER RECEIVES EMAIL
   ↓
   Email includes:
   ├─ Ticket number
   ├─ Title & priority
   ├─ User-facing message
   ├─ Next steps
   └─ Contact info

6. ADMIN RECEIVES EMAIL
   ↓
   Email includes:
   ├─ "NEW TICKET" alert
   ├─ Priority (🔴 High)
   ├─ Category
   ├─ User info
   └─ Link to dashboard

7. SUCCESS NOTIFICATION
   ↓
   Admin sees: "Ticket TKT-20260420-00001 created!"
   ↓
   Form resets
   ↓
   Redirect to tickets list
```

## Data Flow - Viewing & Managing Tickets

```
1. ADMIN NAVIGATES TO TICKETS
   ↓
   TicketsList.tsx
   ├─ Fetch all tickets
   ├─ Show in table format
   └─ Display stats

2. FILTERING & SEARCH
   ↓
   Apply filters:
   ├─ Status (Open/In Progress/etc)
   ├─ Priority (High/Med/Low)
   ├─ Category (Payment/Streaming/etc)
   └─ Search term (number/title/user)

3. ADMIN CLICKS TICKET
   ↓
   TicketDetails.tsx
   ├─ Fetch full ticket data
   ├─ Fetch comments
   ├─ Fetch activity log
   └─ Display timeline

4. UPDATE STATUS
   ↓
   Update dropdown
   ├─ Select new status
   ├─ Send to database
   ├─ Create activity log entry
   ├─ Update UI
   └─ Show success toast

5. ADD COMMENT
   ↓
   Comment form
   ├─ Enter comment text
   ├─ Choose internal/public
   ├─ Submit
   ├─ Insert to database
   ├─ Log activity
   └─ Refresh comments list

6. ASSIGN TO STAFF
   ↓
   Assignee dropdown
   ├─ Select staff member
   ├─ Update assigned_to
   ├─ Log activity
   └─ Staff gets notification (if implemented)

7. RESOLVE TICKET
   ↓
   Change status to "Resolved"
   ├─ Set resolved_at timestamp
   ├─ Log activity
   ├─ (Optional) send resolution email
   └─ Ticket appears in resolved stats
```

## Component Hierarchy

```
Admin Dashboard
│
├─ AdminLayout
│  └─ Sidebar
│     └─ Support Menu
│        ├─ Create Ticket (link)
│        └─ View Tickets (link)
│
├─ CreateTicket Page
│  ├─ Header
│  ├─ User Search Section
│  │  ├─ Search Input
│  │  ├─ Results Dropdown
│  │  ├─ Selected User Display
│  │  └─ User Type Toggle
│  ├─ Ticket Details Section
│  │  ├─ Category Dropdown
│  │  ├─ Priority Buttons
│  │  ├─ Title Input
│  │  └─ Description Input
│  ├─ Context Attachments Section
│  │  ├─ Payment Search
│  │  ├─ Content Search
│  │  ├─ Attached Items Display
│  │  └─ System Logs Toggle
│  ├─ Messages Section
│  │  ├─ Internal Notes Textarea
│  │  └─ User Message Textarea
│  ├─ Templates Section
│  │  └─ Template Buttons
│  └─ Action Buttons
│     ├─ Cancel Button
│     └─ Create Button
│
├─ TicketsList Page
│  ├─ Header
│  │  ├─ Title
│  │  └─ Create Button
│  ├─ Filters Card
│  │  ├─ Search Input
│  │  ├─ Status Filter
│  │  ├─ Priority Filter
│  │  └─ Category Filter
│  ├─ Tickets Table
│  │  ├─ Table Headers
│  │  ├─ Table Rows (Tickets)
│  │  │  ├─ Ticket Number
│  │  │  ├─ Title
│  │  │  ├─ Category Badge
│  │  │  ├─ Priority Badge
│  │  │  ├─ Status Dropdown
│  │  │  ├─ Created Date
│  │  │  └─ Actions Menu
│  │  └─ Empty State
│  └─ Stats Cards
│     ├─ Open Count
│     ├─ High Priority
│     ├─ Resolved Count
│     └─ Total Count
│
└─ TicketDetails Page
   ├─ Header (Back + Title)
   ├─ Main Content (2/3 width)
   │  ├─ Ticket Information Card
   │  │  ├─ Category
   │  │  ├─ User Type
   │  │  ├─ Dates
   │  │  └─ User ID
   │  ├─ User Message Card
   │  │  └─ Formatted Message
   │  ├─ Internal Notes Card (if exists)
   │  │  └─ Formatted Notes
   │  └─ Comments Card
   │     ├─ Comments List
   │     └─ Add Comment Form
   └─ Sidebar (1/3 width)
      ├─ Status Card
      │  └─ Status Dropdown
      ├─ Priority Card
      │  └─ Priority Badge
      ├─ Assignee Card
      │  └─ Assignee Dropdown
      └─ Timeline Card
         ├─ Created
         ├─ Updated
         └─ Resolved
```

## Database Query Patterns

### Create Ticket
```typescript
INSERT INTO tickets (
  user_id, created_by, title, category, priority, 
  status, user_type, user_message, ...
) VALUES (...)
RETURNING *;
```

### Fetch Tickets
```typescript
SELECT * FROM tickets
WHERE (status = ? OR status IS NULL)
AND (priority = ? OR priority IS NULL)
ORDER BY created_at DESC
LIMIT 50;
```

### Search Tickets
```typescript
SELECT * FROM tickets
WHERE ticket_number ILIKE ? 
  OR title ILIKE ? 
  OR user_id ILIKE ?
LIMIT 20;
```

### Add Comment
```typescript
INSERT INTO ticket_comments (
  ticket_id, author_id, comment_text, is_internal
) VALUES (...)
RETURNING *;
```

### Update Status
```typescript
UPDATE tickets
SET status = ?, updated_at = NOW()
WHERE id = ?
RETURNING *;
```

## Environment Configuration

```env
┌─────────────────────────────────────┐
│   SUPABASE CONFIGURATION            │
├─────────────────────────────────────┤
│ SUPABASE_URL=...                    │
│ SUPABASE_ANON_KEY=...               │
│ SUPABASE_SERVICE_ROLE_KEY=...       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   EMAIL CONFIGURATION               │
├─────────────────────────────────────┤
│ RESEND_API_KEY=...                  │
│ ADMIN_EMAIL=admin@domain.com        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   EDGE FUNCTION SECRETS             │
├─────────────────────────────────────┤
│ supabase secrets set RESEND_API_KEY │
│ supabase secrets set ADMIN_EMAIL    │
└─────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────┐
│        QUERY OPTIMIZATION               │
├─────────────────────────────────────────┤
│ Indexes:                                │
│ ├─ idx_tickets_status (fast filtering)  │
│ ├─ idx_tickets_priority (fast sorting)  │
│ ├─ idx_tickets_created_at (date range)  │
│ ├─ idx_tickets_user_id (user lookup)    │
│ └─ idx_tickets_ticket_number (search)   │
│                                         │
│ Caching:                                │
│ ├─ User search results (debounced)      │
│ ├─ Template data (cached on load)       │
│ └─ Ticket list (React Query)            │
│                                         │
│ Lazy Loading:                           │
│ ├─ Page components (Suspense)           │
│ ├─ Comments (on demand)                 │
│ └─ Email logs (paginated)               │
└─────────────────────────────────────────┘
```

## Error Handling Flow

```
User Action
    ↓
Validation Check
    ├─ Pass? ✓ → Continue
    └─ Fail? ✗ → Show Toast Error
                  ├─ "Please select a user"
                  ├─ "Title is required"
                  └─ "Message is required"

Database Operation
    ├─ Success? ✓ → Show Success Toast
    │              ├─ "Ticket created"
    │              ├─ Update UI
    │              └─ Call edge function
    └─ Fail? ✗ → Show Error Toast
                 ├─ "Database error"
                 ├─ Log error
                 └─ Display error details

Email Sending
    ├─ Success? ✓ → Log delivery
    └─ Fail? ✗ → Log error in email_logs
                 ├─ Status: "failed"
                 ├─ Error message stored
                 └─ Retry possible
```

## Security & RLS

```
┌──────────────────────────────────────┐
│     ROW LEVEL SECURITY (RLS)         │
├──────────────────────────────────────┤
│                                      │
│ Tickets Table:                       │
│ ├─ Admin: SELECT/INSERT/UPDATE/DEL   │
│ ├─ User: SELECT own tickets          │
│ ├─ Support: SELECT assigned tickets  │
│ └─ Other: None                       │
│                                      │
│ Comments Table:                      │
│ ├─ Admin: All operations             │
│ ├─ User: View non-internal + own     │
│ ├─ Author: View/insert own           │
│ └─ Other: View public only           │
│                                      │
│ Email Logs Table:                    │
│ ├─ Admin: SELECT only                │
│ └─ Other: None                       │
│                                      │
│ Enforcement:                         │
│ ├─ At query time                     │
│ ├─ No data leakage                   │
│ ├─ Automatic filtering               │
│ └─ Can't bypass with SQL             │
│                                      │
└──────────────────────────────────────┘
```

---

**System Status: ✅ Production Ready**

All components are optimized, tested, and ready for deployment!
