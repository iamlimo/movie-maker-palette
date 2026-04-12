# Rental Payments and Finance Documentation

## Overview

This document provides comprehensive documentation for the rental payment system, financial tracking, and admin dashboard metrics in the Movie Maker Palette application.

## Table of Contents

1. [Rental Payment System Architecture](#rental-payment-system-architecture)
2. [Database Schema](#database-schema)
3. [Payment Flow](#payment-flow)
4. [Admin Dashboard Components](#admin-dashboard-components)
5. [Financial Metrics](#financial-metrics)
6. [Reconciliation Process](#reconciliation-process)
7. [Audit Trail](#audit-trail)
8. [Revenue Reporting](#revenue-reporting)
9. [Troubleshooting](#troubleshooting)

---

## Rental Payment System Architecture

### Overview

The rental payment system handles movie and TV show rentals with flexible payment methods (wallet or credit card via Paystack). The system tracks:

- **Rental Transactions**: When users rent content
- **Payment Processing**: Payment method handling and status
- **Revenue Tracking**: Platform and producer revenue splits
- **Access Management**: Expiration and access control

### Key Components

```
User Rental Request
    ↓
Payment Method Selection (Wallet / Card)
    ↓
Payment Processing
    ↓
Rental Creation & Access Grant
    ↓
Expiration Management
    ↓
Revenue Tracking & Payouts
```

---

## Database Schema

### Core Tables

#### 1. **rentals** Table
Stores all rental transactions.

```sql
CREATE TABLE public.rentals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL ('movie' | 'tv'),
  amount NUMERIC NOT NULL,
  status TEXT ('active' | 'expired'),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Fields:**
- `id`: Unique rental identifier
- `user_id`: User who rented content
- `content_id`: Movie or TV show ID
- `content_type`: Type of content ('movie' or 'tv')
- `amount`: Rental price paid
- `status`: 'active' (within rental period) or 'expired'
- `expires_at`: When rental access expires
- `created_at`: Timestamp of rental creation

**Indexes:**
- `idx_rentals_user_id` - Fast lookup by user
- `idx_rentals_content` - Fast lookup by content
- `idx_rentals_status` - Fast lookup by status
- `idx_rentals_expires_at` - Fast expiration checks

#### 2. **payments** Table
Stores all payment transactions (not just rentals).

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  purpose TEXT ('rental' | 'subscription' | etc),
  enhanced_status TEXT ('pending' | 'success' | 'failed'),
  provider TEXT ('paystack' | 'wallet'),
  provider_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Fields:**
- `id`: Unique payment identifier
- `user_id`: User who made payment
- `amount`: Payment amount in ₦
- `purpose`: Type of payment (e.g., 'rental')
- `enhanced_status`: Payment processing status
- `provider`: Payment method used
- `provider_reference`: External payment reference
- `metadata`: Additional payment info (content details, etc.)
- `created_at`: Payment timestamp

#### 3. **wallet_transactions** Table
Tracks individual wallet debits/credits.

```sql
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY,
  wallet_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type TEXT ('debit' | 'credit'),
  related_payment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 4. **finance_audit_logs** Table
Tracks all financial administrative actions.

```sql
CREATE TABLE public.finance_audit_logs (
  id UUID PRIMARY KEY,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  performed_by UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 5. **reconciliation_reports** Table
Stores reconciliation run results.

```sql
CREATE TABLE public.reconciliation_reports (
  id UUID PRIMARY KEY,
  status TEXT ('passed' | 'failed'),
  matched_records INTEGER,
  unmatched_count INTEGER,
  discrepancy_amount DECIMAL(10,2),
  reconciliation_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## Payment Flow

### Rental Payment Flow

#### 1. User Initiates Rental
- User clicks "Rent" button on movie/TV show

#### 2. Payment Method Selection
- **Wallet Payment**: Direct deduction from user's wallet
- **Card Payment**: Redirect to Paystack payment gateway

#### 3. Wallet Payment Flow
```
1. Check wallet balance ≥ rental amount
2. Create payment record (status: pending)
3. Call wallet-payment edge function
4. Deduct from wallet (wallet_transactions: type='debit')
5. Update payment status: success
6. Create rental record (status: active, expires_at: now + duration)
7. Return access to user
```

#### 4. Card Payment Flow (Paystack)
```
1. Create payment record (status: pending, provider: paystack)
2. Open Paystack payment modal
3. User enters card details on Paystack
4. Paystack processes payment
5. Return to app with verification code
6. Call verify-payment edge function
7. Update payment status: success
8. Create rental record
9. Grant access to content
```

#### 5. Payment Status Lifecycle

```
pending → success → [rental active] → [rental expires]
         → failed  → [handle retry/refund]
         → refunded → [rental revoked]
```

---

## Admin Dashboard Components

### Finance Management Dashboard

Located at: `/admin/finance`

#### Available Tabs:

### 1. **Overview Tab**
**Purpose**: High-level financial metrics and trends

**Metrics Displayed:**
- **Total Revenue**: Sum of all successful rental payments
- **Monthly Revenue**: Revenue for current calendar month
- **Revenue Growth**: YoY percentage change compared to previous month
- **Total Transactions**: Count of successful payments
- **Active Users**: Users who signed in within last 30 days
- **Pending Payouts**: Amount awaiting producer payments

**Charts:**
- **Revenue Trend**: Line chart showing daily/weekly/monthly revenue over selected period
- **Transaction Volume**: Bar chart showing number of transactions per day

**Time Range Options:**
- Last 7 days
- Last 30 days
- Last 3 months
- Last year

---

### 2. **Rentals Tab** (NEW)
**Purpose**: Detailed rental analytics and performance metrics

**Key Metrics:**
- **Total Rentals**: Number of rental transactions
- **Total Rental Revenue**: Sum of all rental amounts
- **Average Rental Price**: Mean price per rental
- **Movie Rentals**: Count of movie rentals
- **TV Rentals**: Count of TV rentals
- **Active Rentals**: Rentals within expiration date
- **Expired Rentals**: Rentals past expiration date
- **Rental Success Rate**: Percentage of successful rental creation

**Reports Available:**
- **Rental Trends**: Time-series showing rental count and revenue over time
- **Payment Methods Distribution**: Pie chart showing revenue split by payment method
- **Top 10 Rented Content**: Table of most popular content with metrics:
  - Content title and type
  - Number of rentals
  - Total revenue generated
  - Average price per rental

**Features:**
- Filterable by time range (7d, 30d, 90d, 1y)
- CSV export functionality
- Real-time refresh

---

### 3. **Transactions Tab**
**Purpose**: Detailed transaction history and auditing

**Displayed Information:**
- Transaction ID
- User name and email
- Payment amount
- Payment status
- Payment method (provider)
- Payment reference
- Transaction date/time
- Metadata (content info, etc.)

**Capabilities:**
- Search by transaction ID, user name, email, or reference
- Filter by payment status (pending, success, failed, refunded)
- Filter by payment purpose (rental, subscription, etc.)
- Pagination (20 items per page)
- Refund functionality for admin
- Transaction details view

**Actions:**
- View full transaction details
- Initiate refund (with confirmation)
- Download transaction history as CSV

---

### 4. **Payouts Tab**
**Purpose**: Producer payment management and tracking

**Information Displayed:**
- Payout ID
- Producer name and email
- Payout amount
- Status (queued, processing, completed, failed)
- Payout date
- Metadata (related rentals, commission details)

**Capabilities:**
- Filter by payout status
- Batch payout processing
- Bulk action selection
- Payout scheduling
- Manual amount adjustment

---

### 5. **Reconciliation Tab** (ENHANCED)
**Purpose**: Match payments with rentals and identify discrepancies

**Reconciliation Process:**
1. Automatically matches payments to rentals by:
   - User ID
   - Amount (within ₦1)
   - Timestamp proximity (within 5 seconds)

2. Identifies these discrepancies:
   - **Payment Without Rental**: Payment processed but no rental created
   - **Rental Without Payment**: Rental exists but no corresponding payment
   - **Amount Mismatch**: Payment and rental amounts don't match

**Metrics Displayed:**
- Total Payments: All payments in system
- Total Rentals: All rentals in system
- Matched Records: Successfully reconciled pairs
- Unmatched Payments: Payments without rentals
- Unmatched Rentals: Rentals without payments
- Reconciliation Rate: Percentage of successful matches (target: >95%)
- Total Discrepancy Amount: Sum of unmatched amounts

**Discrepancies Table:**
- Discrepancy ID
- Type (Payment Only / Rental Only / Amount Mismatch)
- Amount involved
- Associated user
- Date discovered
- Review/Resolve button

**Features:**
- One-click reconciliation run
- Historical reconciliation reports
- Export discrepancy list as CSV
- Status indicator (Good/Review Needed)
- Manual discrepancy review and marking

---

### 6. **Audit Trail Tab** (ENHANCED)
**Purpose**: Complete audit log of all financial actions

**Logged Actions:**
- Payment creation/completion/failure/refund
- Rental creation/expiration
- Payout initiation/completion
- Wallet adjustments
- Reconciliation runs
- Admin actions on financial data

**Information per Log Entry:**
- Timestamp (date and time)
- Action type
- Entity type (payment, rental, payout, wallet, etc.)
- Entity ID
- Performed by (admin email)
- Detailed changes (JSON format)

**Capabilities:**
- Search by entity ID, description, or log ID
- Filter by action type
- Filter by entity type
- Pagination with 20 logs per page
- View detailed change history
- Export audit log as CSV
- Manual refresh

**Example Audit Log Entry:**
```
Date: 2026-04-11 14:23:45
Action: Payment Completed
Entity: Payment
ID: pay_12345678
Performed By: admin@example.com
Changes: {
  "status": { "old": "pending", "new": "success" },
  "verified_at": { "old": null, "new": "2026-04-11T14:23:45Z" }
}
```

---

## Financial Metrics

### Key Metrics Definitions

#### Revenue Metrics

**Total Revenue**
- Sum of all amounts from successful payments
- Formula: `SUM(payments.amount WHERE enhanced_status = 'success')`
- Currency: Nigerian Naira (₦)

**Monthly Revenue**
- Sum of successful payments in the current calendar month
- Used for: Monthly performance tracking, trend analysis
- Resets on first day of each month

**Revenue Growth**
- Percentage change from previous month to current month
- Formula: `((current_month - previous_month) / previous_month) * 100`
- Positive: Revenue increased
- Negative: Revenue declined
- Used for: Trend analysis, performance evaluation

#### Transaction Metrics

**Total Transactions**
- Count of successful payment records
- Formula: `COUNT(payments WHERE enhanced_status = 'success')`
- Includes all payment types (rentals, subscriptions, etc.)

**Rental Success Rate**
- Percentage of payments that resulted in successful rental creation
- Formula: `(COUNT(rentals) / COUNT(payments)) * 100`
- Target: >95%
- Used for: Payment processing health check

#### User Metrics

**Active Users**
- Users who have signed in within the last 30 days
- Used for: Engagement metrics, user base analysis
- Important for calculating per-user metrics

**Total Users**
- Count of all registered user profiles
- Used for: Platform growth tracking

#### Payout Metrics

**Pending Payouts**
- Sum of payout amounts with status = 'queued'
- Used for: Financial liability tracking, producer payment planning

**Reconciliation Rate**
- Percentage of payments successfully matched with rentals
- Formula: `(matched_records / total_payments) * 100`
- Target: >95%
- Used for: System health and data integrity check

---

## Reconciliation Process

### Purpose
Ensure that every payment has a corresponding rental and vice versa, identifying and resolving discrepancies.

### Automated Reconciliation

**Matching Criteria:**
1. Same user ID
2. Amount within ₦1.00
3. Rental created within 5 seconds of payment completion

**Run Process:**
1. Click "Run Reconciliation" button
2. System fetches all payments (status='success')
3. System fetches all rentals
4. For each rental: find matching payment
5. For each unmatched item: create discrepancy record
6. Generate reconciliation report
7. Save report to `reconciliation_reports` table

### Discrepancy Types

#### Type 1: Payment Without Rental
**Cause:** Payment succeeded but rental creation failed
**Example:** User paid ₦500 for rental, but rental record wasn't created
**Resolution:** 
- Check payment logs for errors
- Manually create rental if safe
- Issue refund if rental can't be created
- Investigate root cause

#### Type 2: Rental Without Payment
**Cause:** Rental created without successful payment
**Example:** Rental exists but payment is still pending
**Resolution:**
- Check if payment is still processing
- If payment failed, revoke rental access
- Contact user if payment failed externally

#### Type 3: Amount Mismatch
**Cause:** Payment amount differs from rental amount
**Example:** Payment shows ₦1,500 but rental shows ₦1,400
**Resolution:**
- Verify which amount is correct
- Check for platform commission/fees
- Document discrepancy origin

### Manual Review

1. Click "Review" on discrepancy row
2. Examine related payment and rental records
3. Determine appropriate action:
   - Create matching record
   - Refund payment
   - Rollback rental
4. Document action in audit trail

---

## Audit Trail

### Purpose
Maintain complete record of all financial transactions and administrative actions for compliance and troubleshooting.

### Logged Events

**Automatic Logging:**
- All payments (creation, status changes, refunds)
- All rentals (creation, expiration)
- All payouts (creation, processing, completion)
- All wallet transactions (debit, credit)
- Reconciliation runs
- Refunds/chargebacks

**Manual Logging:**
- Admin adjustments to financial records
- Discrepancy resolutions
- Manual payout adjustments
- Configuration changes

### Log Entry Structure

```json
{
  "id": "log_uuid",
  "action": "payment_completed",
  "entity_type": "payment",
  "entity_id": "pay_uuid",
  "performed_by": "admin_user_id",
  "changes": {
    "status": { "old": "pending", "new": "success" },
    "verified_at": { "old": null, "new": "2026-04-11T14:23:45Z" },
    "provider_reference": { "old": null, "new": "ref_12345" }
  },
  "created_at": "2026-04-11T14:23:45Z"
}
```

### Audit Trail Access

- **View**: Navigate to Finance Management → Audit Trail tab
- **Search**: By entity ID, description, or log ID
- **Filter**: By action type or entity type
- **Export**: Download as CSV for external auditing
- **Retention**: Kept indefinitely for compliance

---

## Revenue Reporting

### Available Reports

#### 1. Financial Overview Report
**Contains:**
- Total revenue (all time)
- Monthly revenue (current month)
- Revenue trend (chart)
- Transaction volume
- Growth metrics
- Payout status

**Use Case:** Executive summary, monthly business review

#### 2. Rental Analytics Report
**Contains:**
- Rental count by type (movie/TV)
- Revenue by content
- Top performers
- Rental success rate
- Payment method breakdown
- Trend analysis

**Use Case:** Content performance analysis, strategic planning

#### 3. Transaction Report
**Contains:**
- All payment transactions
- User details
- Status breakdown
- Payment methods
- Refunds
- Failed payments

**Use Case:** Accounting, reconciliation, dispute investigation

#### 4. Reconciliation Report
**Contains:**
- Reconciliation date/time
- Match rate percentage
- Discrepancies found
- Discrepancy amounts
- Detailed discrepancy list
- Recommendations

**Use Case:** Data integrity checks, operational reviews

#### 5. Audit Trail Report
**Contains:**
- All logged financial actions
- Admin actions
- Timestamps
- Changed values
- User responsible
- Change rationale

**Use Case:** Compliance, forensic analysis, user support

### Exporting Reports

1. Select report from Finance Dashboard
2. Choose time period if applicable
3. Click "Export" button
4. Select format (CSV)
5. File downloads with naming convention: `report-type-date-range.csv`

### Report Automation

Set up scheduled reports:
1. Navigate to Admin Settings
2. Go to Finance Automation
3. Configure report schedule (daily, weekly, monthly)
4. Specify recipients (email addresses)
5. Save configuration

---

## Troubleshooting

### Common Issues

#### Issue 1: Payment Successful but Rental Not Created

**Symptoms:**
- User reports payment charged but rental not accessible
- Payment status: success, but no rental record

**Diagnosis:**
1. Check reconciliation report for "Payment Without Rental" discrepancy
2. View payment details in Transactions tab
3. Verify payment metadata contains correct content_id
4. Check for error logs in audit trail

**Resolution:**
- If content ID is valid: manually create rental record
- If content ID is invalid: refund payment
- Update payment metadata with correct information

#### Issue 2: Reconciliation Rate Below 95%

**Symptoms:**
- Reconciliation tab shows <95% success rate
- Multiple unmatched payments/rentals

**Diagnosis:**
1. Review discrepancy list
2. Check for bulk import/migration issues
3. Look for failed payment processing
4. Verify timestamp synchronization

**Resolution:**
- Address discrepancies systematically
- Check system logs for errors
- Coordinate with development team if needed
- Document all resolutions in audit trail

#### Issue 3: Revenue Numbers Don't Match

**Symptoms:**
- Dashboard revenue differs from accounting records
- Discrepancy in monthly totals

**Diagnosis:**
1. Verify time period matches
2. Check currency conversion
3. Confirm payment status filter (success only)
4. Check for duplicate records
5. Verify rental refunds are excluded

**Resolution:**
- Run reconciliation to identify mismatches
- Review payment metadata
- Check for data import errors
- Correct or clarify with finance team

#### Issue 4: Slow Dashboard Load Times

**Symptoms:**
- Finance dashboard takes >5 seconds to load
- Especially slow with large time ranges

**Diagnosis:**
1. Check database query performance
2. Review index usage
3. Check for missing indexes
4. Verify data table sizes

**Resolution:**
- Create indexes on commonly filtered fields
- Limit default date range
- Implement pagination
- Cache frequently used reports

---

## Best Practices

### For Finance Admins

1. **Daily Review**
   - Check for new discrepancies
   - Monitor transaction failures
   - Verify pending payouts

2. **Weekly Tasks**
   - Run reconciliation report
   - Review audit trail
   - Check for anomalies in revenue

3. **Monthly Tasks**
   - Generate financial reports
   - Review revenue trends
   - Process pending payouts
   - Reconcile with accounting system

4. **Documentation**
   - Document all manual adjustments in audit trail
   - Keep notes on discrepancy resolutions
   - Track recurring issues

### For Developers

1. **Error Handling**
   - Log payment failures with context
   - Include user and content identifiers
   - Capture stack traces

2. **Testing**
   - Test payment flow end-to-end
   - Verify rental creation immediately after payment
   - Test refund functionality
   - Verify reconciliation accuracy

3. **Monitoring**
   - Monitor reconciliation rate
   - Alert on failed payments
   - Track pending payouts growth
   - Monitor data consistency

---

## Contact & Support

For questions about:
- **Rental Payment System**: Contact Development Team
- **Financial Reports**: Contact Finance Team
- **Data Discrepancies**: Contact DevOps/Database Team
- **Admin Access**: Contact Super Admin

---

**Last Updated**: April 11, 2026
**Version**: 1.0
**Maintained By**: Finance & Development Teams
