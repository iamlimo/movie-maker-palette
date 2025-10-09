-- Phase 1: Migrate all prices and amounts to kobo (multiply by 100)

-- Update content prices
UPDATE movies SET price = price * 100 WHERE price < 1000000;
UPDATE seasons SET price = price * 100 WHERE price < 1000000;
UPDATE episodes SET price = price * 100 WHERE price < 1000000;
UPDATE slider_items SET price = price * 100 WHERE price < 1000000;

-- Update existing financial records
UPDATE payments SET amount = amount * 100 WHERE amount < 1000000;
UPDATE rentals SET amount = amount * 100 WHERE amount < 1000000;
UPDATE wallets SET balance = balance * 100 WHERE balance < 1000000;
UPDATE wallet_transactions 
SET amount = amount * 100, 
    balance_before = balance_before * 100, 
    balance_after = balance_after * 100 
WHERE amount < 1000000;

-- Add comment for documentation
COMMENT ON COLUMN movies.price IS 'Price stored in kobo (1 Naira = 100 kobo)';
COMMENT ON COLUMN seasons.price IS 'Price stored in kobo (1 Naira = 100 kobo)';
COMMENT ON COLUMN episodes.price IS 'Price stored in kobo (1 Naira = 100 kobo)';
COMMENT ON COLUMN wallets.balance IS 'Balance stored in kobo (1 Naira = 100 kobo)';