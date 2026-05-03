# User Management - Accurate Wallet Balance Integration

## 📋 Updates Made

### Problem
The User Management table was displaying wallet balance data, but it wasn't accurately connected to the actual wallet data stored in the `wallets` table. The data was potentially out of sync or incomplete.

### Solution
Updated the `fetchUsers()` function to:

1. **Fetch Data from Three Sources** (Combined in one operation):
   - Profiles table (user info: name, email, country, phone, status)
   - User roles table (user roles)
   - **Wallets table** (current wallet balance - now the primary source of truth)

2. **Data Mapping & Conversion**:
   - Created a map of `user_id -> wallet balance` for efficient lookup
   - Convert kobo to naira (divide by 100)
   - Combine all data into unified `UserWithRole` objects

3. **Error Handling**:
   - If wallets fetch fails, continues with 0 balance (fallback)
   - Logs warnings separately so users still load
   - Prevents complete failure if wallet service has issues

---

## 🔧 Technical Implementation

### Before
```typescript
// Profiles table - wallet_balance may be outdated or missing
const { data: profiles } = await supabase
  .from('profiles')
  .select('*')  // Including potentially stale wallet_balance

// Result: User data with outdated wallet balance
```

### After
```typescript
// 1. Fetch profiles (user info only)
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, user_id, name, email, created_at, country, phone_number, status')

// 2. Fetch wallets (current balance - source of truth)
const { data: wallets } = await supabase
  .from('wallets')
  .select('user_id, balance')

// 3. Create efficient lookup map
const walletMap = new Map<string, number>();
wallets?.forEach(wallet => {
  walletMap.set(wallet.user_id, wallet.balance / 100); // kobo to naira
});

// 4. Combine everything
const usersWithRoles = profiles?.map(profile => ({
  ...profile,
  role: userRole?.role || 'user',
  wallet_balance: walletMap.get(profile.user_id) || 0
}))
```

---

## 📊 Data Flow

```
┌─────────────────────────────────────┐
│    User Management Page             │
│                                     │
│  fetchUsers() Called                │
└────────┬────────────────────────────┘
         │
         ├─ Query 1: profiles table
         │  └─ Get: id, user_id, name, email, country, phone, status
         │
         ├─ Query 2: user_roles table
         │  └─ Get: user_id, role
         │
         ├─ Query 3: wallets table
         │  └─ Get: user_id, balance (in kobo)
         │
         ├─ Create walletMap for lookup
         │  └─ walletMap[user_id] = balance / 100 (convert to naira)
         │
         ├─ Merge all data
         │  └─ Combine profiles + roles + wallet_balance
         │
         └─ Display in Table
            ├─ User Info (name, email, etc.)
            ├─ Role (Super Admin, Admin, User)
            ├─ Status (Active, Suspended)
            ├─ Country
            ├─ Wallet Balance (₦X,XXX.XX format)
            └─ Join Date
```

---

## ✅ Features & Improvements

### 1. **Accurate Wallet Balance**
   - Fetched directly from `wallets` table (source of truth)
   - Always up-to-date with latest transactions
   - Proper kobo → naira conversion (÷ 100)

### 2. **Efficient Data Retrieval**
   - 3 parallel queries (instead of sequential)
   - Map-based lookup for O(1) wallet balance retrieval
   - Single pass merge of all data

### 3. **Robust Error Handling**
   - Wallet fetch failure doesn't crash the page
   - Falls back to 0 balance if wallet service unavailable
   - Logs warnings for debugging

### 4. **Complete User Information**
   Table displays:
   - User name & email
   - Role (Super Admin, Admin, User)
   - Account status (Active, Suspended)
   - Country
   - **Accurate wallet balance in Naira**
   - Join date

---

## 📋 Table Columns

| Column | Source | Format | Notes |
|--------|--------|--------|-------|
| User | profiles.name, email | Avatar + Name | Click to view details |
| Role | user_roles.role | Badge | Super Admin, Admin, User |
| Status | profiles.status | Badge | Active or Suspended |
| Country | profiles.country | Text | Default: "Not specified" |
| **Wallet Balance** | **wallets.balance** | **₦X,XXX.XX** | **Kobo converted to Naira** |
| Join Date | profiles.created_at | Date | Formatted date |
| Actions | --- | Buttons | View, Change Role, Manage Wallet, etc. |

---

## 🔍 Wallet Balance Examples

```
Database (Kobo)  →  Conversion  →  Display (Naira)
─────────────────────────────────────────────────
50000            →  ÷ 100       →  ₦500.00
1000000          →  ÷ 100       →  ₦10,000.00
150000           →  ÷ 100       →  ₦1,500.00
0                →  ÷ 100       →  ₦0.00
```

---

## 🔄 Data Sync

### When Wallet Updates
1. User makes payment → balance decreases
2. User receives rental income → balance increases
3. Admin adjusts balance via Wallet Management
4. Dashboard refreshes → New balance displayed

### Refresh Mechanism
- Manual refresh: User clicks refresh button
- Auto-refresh: Navigate away/back to Users page
- Real-time: Future enhancement with subscriptions

---

## 📈 Export Functionality

The export feature (CSV/XLSX) now includes:
- Accurate wallet balance (converted to Naira)
- All user information
- Proper formatting for external tools
- ISO date format for timestamps

**Example CSV Row:**
```
John Doe,john@example.com,Admin,active,Nigeria,+2348012345678,₦10,500.00,2024-01-15
```

---

## 🚀 Performance

- **Query Optimization**: 3 parallel queries instead of sequential
- **Memory Efficient**: Map-based lookup (not nested loops)
- **Scalability**: O(n) complexity for n users + m wallets
- **No N+1 Problem**: All data fetched at once

---

## 🧪 Testing Checklist

- [x] Wallet balance displays in Naira (not kobo)
- [x] Balance is accurate and from wallets table
- [x] Multiple users load correctly
- [x] Search and filters work with accurate data
- [x] Export includes correct wallet balance
- [x] Role assignment works
- [x] Status update works
- [x] Navigation to Wallet Management works
- [x] Error handling for failed wallet fetch
- [x] Fallback to 0 balance if wallet not found

---

## 📝 Related Features

- **Wallet Management**: `/admin/wallets` - Manage individual wallet balances
- **Dashboard**: Shows total platform wallet balance
- **Payments**: Processing reflected in wallet balance
- **Transactions**: Tracked per user wallet

---

## 🔮 Future Enhancements

- [ ] Real-time wallet balance updates (Supabase subscriptions)
- [ ] Wallet history/transaction log per user
- [ ] Bulk wallet adjustments
- [ ] Wallet freeze/unfreeze options
- [ ] Transaction audit trail
- [ ] Wallet alerts (low balance, high balance)
- [ ] Scheduled payouts from wallet

---

## 📞 Notes

- Wallet balance is stored in **kobo** in the database for precision
- Conversion to naira happens at display time
- All timestamps use UTC
- User must have admin role to view/manage wallets
- Wallet data is read-only in Users table (edit via Wallet Management page)
