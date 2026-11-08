REVOKE EXECUTE ON FUNCTION public.handle_rental_paid_rewards() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_referral_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_reward_voucher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward_voucher(uuid) TO authenticated;