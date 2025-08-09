UPDATE category_rules SET transaction_direction = 'all' WHERE transaction_direction IS NULL;

-- Create account_types table
CREATE TABLE IF NOT EXISTS account_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add account_type_id column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type_id UUID REFERENCES account_types(id) ON DELETE SET NULL;

-- Add auto_approval column to category_rules table
ALTER TABLE category_rules ADD COLUMN IF NOT EXISTS auto_approval BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE category_rules ADD COLUMN rule_type TEXT CHECK (rule_type IN ('textContains', 'textStartsWith', 'exactText', 'categoryMatch')) DEFAULT 'textContains';

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT user_settings_user_id_setting_key_unique UNIQUE (user_id, setting_key)
);

-- Add the unique constraint to inkomstkallor_medlem table (if it doesn't exist)
DO $$ BEGIN
  ALTER TABLE inkomstkallor_medlem 
  ADD CONSTRAINT inkomstkallor_medlem_user_id_familjemedlem_id_id_inkomstkalla_unique 
  UNIQUE (user_id, familjemedlem_id, id_inkomstkalla);
EXCEPTION 
  WHEN duplicate_table THEN 
    -- Constraint already exists, do nothing
    RAISE NOTICE 'Unique constraint already exists';
END $$;
