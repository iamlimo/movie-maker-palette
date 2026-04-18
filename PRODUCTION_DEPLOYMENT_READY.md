# TV Show Rental Optimization - Production Deployment Checklist

**Project**: TV Show Rental System - Discount & Payment Optimization  
**Date**: April 18, 2026  
**Status**: Ready for Deployment  

---

## Pre-Deployment Verification (DO BEFORE COMMITTING)

### Code Review
- [ ] Review OptimizedRentalCheckout.tsx changes
  - [ ] Auto-payment method selection logic correct
  - [ ] Discount banner displays when active
  - [ ] Both tabs show discount info
  - [ ] Wallet tab shows balance calculations
  - [ ] No console errors
  
- [ ] Review TVShowPreview.tsx changes
  - [ ] rentals array imported correctly
  - [ ] useEffect properly watches rentals
  - [ ] Access re-checking works
  - [ ] No memory leaks from useEffect
  
- [ ] Verify cloud function `process-rental`
  - [ ] Discount applied to both payment paths
  - [ ] finalPrice used, not original price
  - [ ] Wallet deduction uses finalPrice
  - [ ] Paystack initialization uses finalPrice
  - [ ] referral_code_uses table updated

### Database Verification
- [ ] referral_codes table has test codes
  ```sql
  SELECT code, discount_type, discount_value, is_active 
  FROM referral_codes 
  LIMIT 5;
  ```
- [ ] rentals table has columns: price, discount_applied, final_price
- [ ] referral_code_uses table exists and has structure
- [ ] RLS policies allow operations

### Staging Environment
- [ ] Dev server running (https://localhost:8081)
- [ ] Application loads without errors
- [ ] No 404s on component imports
- [ ] Console shows no TypeScript errors
- [ ] Hot reload working (change file, verify update)

---

## Testing Before Deployment

### Smoke Tests (5 minutes)
- [ ] Open TV show page
- [ ] Click "Rent Season"
- [ ] Apply valid discount code
- [ ] See discount banner and pricing update
- [ ] Select Wallet payment
- [ ] Verify balance after payment shown
- [ ] Select Card payment
- [ ] Verify discount applied message shown

### Functional Tests (30 minutes)
- [ ] Test with valid percentage discount
- [ ] Test with valid fixed amount discount
- [ ] Test with invalid code (error message)
- [ ] Test with expired code (error message)
- [ ] Test wallet payment with sufficient balance
- [ ] Test wallet payment with insufficient balance
- [ ] Test card payment
- [ ] Test episode rental with discount
- [ ] Verify access updates immediately after payment

### Edge Cases (15 minutes)
- [ ] Try 0% discount
- [ ] Try 100% discount (free)
- [ ] Try discount larger than price
- [ ] Try very large percentage (9999%)
- [ ] Apply discount, remove it, apply different one
- [ ] Rapid clicks on Apply button (debounced?)

### Device Testing (30 minutes)
- [ ] Desktop (1920x1080): Full experience
- [ ] Tablet (768x1024): Responsive layout
- [ ] Mobile (375x667): Touch-friendly
- [ ] Dark mode: Colors legible
- [ ] Light mode: Colors legible

### Browser Testing (15 minutes)
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Performance & Security

### Performance Checks
- [ ] Discount validation time < 100ms
- [ ] Payment processing time < 2s
- [ ] Page load time < 3s
- [ ] Access update time < 5s

### Security Checks
- [ ] Cannot apply same code twice
- [ ] Cannot access other users' codes
- [ ] Backend validates all inputs
- [ ] No SQL injection vulnerabilities
- [ ] RLS policies enforced
- [ ] Price cannot be manipulated from frontend

---

## Deployment Steps

### 1. Prepare for Deployment
```bash
git status
git checkout -b deploy/tv-rental-optimization
git diff main
```

### 2. Final Testing
```bash
npm run lint
npm run build
# Run smoke tests manually
```

### 3. Commit Changes
```bash
git add -A
git commit -m "feat: optimize tv rental discount and payment system"
git tag -a v1.2.1 -m "TV rental optimization"
```

### 4. Deploy to Staging
```bash
npm run deploy:staging
# Verify at: https://staging.example.com
# Run full test suite
```

### 5. Deploy to Production
```bash
git push origin main
npm run deploy:production
# Verify at: https://app.example.com
```

### 6. Post-Deployment Monitoring (24 hours)
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Watch for support tickets
- [ ] Review analytics
- [ ] Test actual user rentals

---

## Success Metrics

✅ **Deployment successful when**:
- [ ] 0 JavaScript console errors
- [ ] All smoke tests pass
- [ ] Discount codes apply correctly
- [ ] Both payment methods work
- [ ] Access updates within 5 seconds
- [ ] No database errors
- [ ] Performance normal
- [ ] User feedback positive

---

## Rollback Procedure

```bash
# If issues occur:
git revert HEAD
git push origin main
npm run deploy:production
```

---

**Status**: ✅ Ready for Production Deployment
