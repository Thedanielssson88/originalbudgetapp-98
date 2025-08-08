-- Add new columns to budget_posts table for Balance type
ALTER TABLE budget_posts 
ADD COLUMN IF NOT EXISTS account_user_balance INTEGER,
ADD COLUMN IF NOT EXISTS account_balance INTEGER;