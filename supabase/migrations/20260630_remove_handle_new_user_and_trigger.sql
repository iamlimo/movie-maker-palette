BEGIN;

-- Rollback migration: remove signup trigger and function created for phone persistence
-- This file drops the trigger on auth.users and the public.handle_new_user() function.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user();

COMMIT;
