# Rental Flow Refactor TODO

- [x] Read the concerned frontend and backend rental files
- [x] Identify polling/duplicate-access logic
- [x] Locate the actual rental hook files and integration points
- [x] Find all live references to the legacy rental/payment-verification components
- [x] Read remaining callers that depend on the legacy rental button
- [x] Remove polling-based verification from rental components and hook
- [ ] Simplify access decisions to backend entitlements only
- [ ] Update TV/Movie/Episode rental call sites to use the canonical flow
- [ ] Remove or deprecate legacy polling verification hook
- [ ] Verify TypeScript/build and confirm rental UI behavior
