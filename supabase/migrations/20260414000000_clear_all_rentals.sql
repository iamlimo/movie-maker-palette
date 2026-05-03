-- Clear all rentals to start afresh
-- This migration deletes all rental records while preserving users and content

DELETE FROM public.rentals;

-- Reset the auto-increment sequence for the rentals table
ALTER SEQUENCE public.rentals_id_seq RESTART WITH 1;
