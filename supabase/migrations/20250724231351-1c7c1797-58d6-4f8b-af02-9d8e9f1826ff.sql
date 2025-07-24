-- Create comprehensive budget database schema

-- Main budget periods table (stores monthly budgets)
CREATE TABLE public.budget_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month, user_id)
);

-- Budget income table (stores all income sources per month)
CREATE TABLE public.budget_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  income_type TEXT NOT NULL, -- 'andreas_salary', 'andreas_forsakringskassan', 'andreas_barnbidrag', etc.
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_period_id, income_type)
);

-- Budget categories table (stores cost and savings categories)
CREATE TABLE public.budget_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL, -- unique identifier for the category
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  category_type TEXT NOT NULL CHECK (category_type IN ('cost', 'savings')),
  is_personal BOOLEAN NOT NULL DEFAULT false,
  person_name TEXT, -- 'andreas' or 'susanna' for personal budgets
  account TEXT,
  financed_from TEXT CHECK (financed_from IN ('Löpande kostnad', 'Enskild kostnad')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_period_id, category_id)
);

-- Budget subcategories table (stores subcategories within categories)
CREATE TABLE public.budget_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  subcategory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  account TEXT,
  financed_from TEXT CHECK (financed_from IN ('Löpande kostnad', 'Enskild kostnad')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_category_id, subcategory_id)
);

-- Budget transfers table (stores daily and weekend transfer amounts)
CREATE TABLE public.budget_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  daily_transfer DECIMAL(12,2) NOT NULL DEFAULT 0,
  weekend_transfer DECIMAL(12,2) NOT NULL DEFAULT 0,
  transfer_account DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_period_id)
);

-- Account balances table (stores account balances per month)
CREATE TABLE public.account_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  starting_balance DECIMAL(12,2) DEFAULT 0,
  starting_balance_set BOOLEAN DEFAULT false,
  final_balance DECIMAL(12,2) DEFAULT 0,
  final_balance_set BOOLEAN DEFAULT false,
  estimated_final_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_period_id, account_name)
);

-- Budget configuration table (stores accounts, categories, etc.)
CREATE TABLE public.budget_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  config_type TEXT NOT NULL, -- 'accounts', 'account_categories', 'user_names', etc.
  config_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, config_type)
);

-- Budget holidays table (stores custom holidays per month)
CREATE TABLE public.budget_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_period_id, holiday_date)
);

-- Budget calculations table (stores all calculated results per month)
CREATE TABLE public.budget_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  calculation_data JSONB NOT NULL, -- stores all calculation results
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_period_id)
);

-- Budget templates table (stores budget templates)
CREATE TABLE public.budget_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  template_name TEXT NOT NULL,
  template_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_name)
);

-- Enable Row Level Security
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user-specific access
CREATE POLICY "Users can manage their own budget periods" 
ON public.budget_periods 
FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage budget income for their periods" 
ON public.budget_income 
FOR ALL 
USING (
  budget_period_id IN (
    SELECT id FROM public.budget_periods 
    WHERE auth.uid() = user_id OR user_id IS NULL
  )
);

CREATE POLICY "Users can manage budget categories for their periods" 
ON public.budget_categories 
FOR ALL 
USING (
  budget_period_id IN (
    SELECT id FROM public.budget_periods 
    WHERE auth.uid() = user_id OR user_id IS NULL
  )
);

CREATE POLICY "Users can manage budget subcategories for their periods" 
ON public.budget_subcategories 
FOR ALL 
USING (
  budget_category_id IN (
    SELECT bc.id FROM public.budget_categories bc
    JOIN public.budget_periods bp ON bc.budget_period_id = bp.id
    WHERE auth.uid() = bp.user_id OR bp.user_id IS NULL
  )
);

CREATE POLICY "Users can manage budget transfers for their periods" 
ON public.budget_transfers 
FOR ALL 
USING (
  budget_period_id IN (
    SELECT id FROM public.budget_periods 
    WHERE auth.uid() = user_id OR user_id IS NULL
  )
);

CREATE POLICY "Users can manage account balances for their periods" 
ON public.account_balances 
FOR ALL 
USING (
  budget_period_id IN (
    SELECT id FROM public.budget_periods 
    WHERE auth.uid() = user_id OR user_id IS NULL
  )
);

CREATE POLICY "Users can manage their own budget config" 
ON public.budget_config 
FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage budget holidays for their periods" 
ON public.budget_holidays 
FOR ALL 
USING (
  budget_period_id IN (
    SELECT id FROM public.budget_periods 
    WHERE auth.uid() = user_id OR user_id IS NULL
  )
);

CREATE POLICY "Users can manage budget calculations for their periods" 
ON public.budget_calculations 
FOR ALL 
USING (
  budget_period_id IN (
    SELECT id FROM public.budget_periods 
    WHERE auth.uid() = user_id OR user_id IS NULL
  )
);

CREATE POLICY "Users can manage their own budget templates" 
ON public.budget_templates 
FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_budget_periods_updated_at
BEFORE UPDATE ON public.budget_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_income_updated_at
BEFORE UPDATE ON public.budget_income
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_categories_updated_at
BEFORE UPDATE ON public.budget_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_subcategories_updated_at
BEFORE UPDATE ON public.budget_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_transfers_updated_at
BEFORE UPDATE ON public.budget_transfers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_balances_updated_at
BEFORE UPDATE ON public.account_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_config_updated_at
BEFORE UPDATE ON public.budget_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_calculations_updated_at
BEFORE UPDATE ON public.budget_calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_templates_updated_at
BEFORE UPDATE ON public.budget_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();