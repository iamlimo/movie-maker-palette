# TODO

## admin-create-creator investigation
- [ ] Update `supabase/functions/admin-create-creator/index.ts` to add diagnostics:
  - [ ] Log request auth/role check outcomes (no secrets)
  - [ ] Separate error handling for:
    - creator_profiles insert
    - creator_activation_tokens insert
  - [ ] Improve HTTP status mapping (avoid defaulting everything to 400)
  - [ ] Return structured debug info in the error response
- [ ] Re-deploy / verify the edge function
- [ ] Retry “super admin creates a new creator” and inspect returned error payload / edge logs
