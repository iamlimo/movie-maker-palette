# Wallet Balance Mobile Visibility & Paystack Funding Optimization

## Approved Plan Steps

- [ ] **Step 1:** Create this TODO.md ✅
- [✅] **Step 2:** Edit `src/components/Header.tsx` - Remove `{!isIOS &&}` around wallet button/link in desktop nav and mobile menu for all platforms visibility
- [✅] **Step 3:** Edit `src/pages/Wallet.tsx` - Remove `!isIOS` condition to enable 'Fund Wallet' button on iOS/native

- [✅] **Step 4:** Edit `src/components/wallet/FundWalletModal.tsx` - Add optimistic refresh, better polling (timeout 5min), improved error handling/UX

- [ ] **Step 5:** Optional: Enhance `supabase/functions/initiate-wallet-funding/index.ts` - Add idempotency check, better logging/metrics
- [ ] **Step 6:** `npx cap sync android ios` + Test on web mobile/iOS/Android emulators (balance visible everywhere, funding initiates)
- [ ] **Step 7:** Verify Paystack flow end-to-end (payment → webhook → wallet credit via `wallet_transactions`)
- [ ] **Step 8:** `npm run build && npx cap build android ios`
- [ ] **Step 9:** Update/create `WALLET_MOBILE_OPTIMIZATION.md` summary

**Final Step:** Mark ALL COMPLETE.

_Updated: $(date)_
