-- Add income_target_id column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS income_target_id UUID REFERENCES budget_posts(id) ON DELETE SET NULL;