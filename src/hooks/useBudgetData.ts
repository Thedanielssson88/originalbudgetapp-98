import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BudgetPeriod {
  id: string;
  year: number;
  month: number;
  user_id?: string;
}

export interface BudgetIncomeData {
  andreas_salary: number;
  andreas_forsakringskassan: number;
  andreas_barnbidrag: number;
  susanna_salary: number;
  susanna_forsakringskassan: number;
  susanna_barnbidrag: number;
}

export interface BudgetGroup {
  id: string;
  name: string;
  amount: number;
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
  isPersonal?: boolean;
  personName?: 'andreas' | 'susanna';
}

export interface SubCategory {
  id: string;
  name: string;
  amount: number;
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

export interface BudgetTransfers {
  dailyTransfer: number;
  weekendTransfer: number;
  transferAccount: number;
}

export interface AccountBalance {
  accountName: string;
  startingBalance: number;
  startingBalanceSet: boolean;
  finalBalance: number;
  finalBalanceSet: boolean;
  estimatedFinalBalance: number;
}

export interface BudgetConfiguration {
  accounts: string[];
  accountCategories: string[];
  accountCategoryMapping: { [accountName: string]: string };
  userNames: { userName1: string; userName2: string };
}

export interface BudgetHoliday {
  date: string;
  name: string;
}

export interface BudgetTemplate {
  id: string;
  templateName: string;
  templateData: any;
}

export const useBudgetData = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Helper function to get or create budget period
  const getOrCreateBudgetPeriod = useCallback(async (year: number, month: number): Promise<string | null> => {
    try {
      // First try to get existing period
      const { data: existingPeriod, error: selectError } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (selectError) {
        console.error('Error checking for existing period:', selectError);
        return null;
      }

      if (existingPeriod) {
        return existingPeriod.id;
      }

      // Create new period if it doesn't exist
      const { data: newPeriod, error: insertError } = await supabase
        .from('budget_periods')
        .insert({ year, month })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating budget period:', insertError);
        return null;
      }

      return newPeriod.id;
    } catch (error) {
      console.error('Error in getOrCreateBudgetPeriod:', error);
      return null;
    }
  }, []);

  // Save income data
  const saveIncomeData = useCallback(async (year: number, month: number, incomeData: BudgetIncomeData) => {
    setLoading(true);
    try {
      const budgetPeriodId = await getOrCreateBudgetPeriod(year, month);
      if (!budgetPeriodId) {
        toast({ title: "Error", description: "Failed to create budget period", variant: "destructive" });
        return false;
      }

      // Delete existing income data
      await supabase
        .from('budget_income')
        .delete()
        .eq('budget_period_id', budgetPeriodId);

      // Insert new income data
      const incomeEntries = Object.entries(incomeData).map(([income_type, amount]) => ({
        budget_period_id: budgetPeriodId,
        income_type,
        amount
      }));

      const { error } = await supabase
        .from('budget_income')
        .insert(incomeEntries);

      if (error) {
        console.error('Error saving income data:', error);
        toast({ title: "Error", description: "Failed to save income data", variant: "destructive" });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveIncomeData:', error);
      toast({ title: "Error", description: "Failed to save income data", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [getOrCreateBudgetPeriod, toast]);

  // Load income data
  const loadIncomeData = useCallback(async (year: number, month: number): Promise<BudgetIncomeData | null> => {
    try {
      const { data: period } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!period) return null;

      const { data: income, error } = await supabase
        .from('budget_income')
        .select('income_type, amount')
        .eq('budget_period_id', period.id);

      if (error) {
        console.error('Error loading income data:', error);
        return null;
      }

      const incomeData: BudgetIncomeData = {
        andreas_salary: 0,
        andreas_forsakringskassan: 0,
        andreas_barnbidrag: 0,
        susanna_salary: 0,
        susanna_forsakringskassan: 0,
        susanna_barnbidrag: 0
      };

      income?.forEach(({ income_type, amount }) => {
        if (income_type in incomeData) {
          (incomeData as any)[income_type] = Number(amount);
        }
      });

      return incomeData;
    } catch (error) {
      console.error('Error in loadIncomeData:', error);
      return null;
    }
  }, []);

  // Save budget categories (costs and savings)
  const saveBudgetCategories = useCallback(async (
    year: number, 
    month: number, 
    costGroups: BudgetGroup[], 
    savingsGroups: BudgetGroup[],
    andreasPersonalCosts: BudgetGroup[] = [],
    andreasPersonalSavings: BudgetGroup[] = [],
    susannaPersonalCosts: BudgetGroup[] = [],
    susannaPersonalSavings: BudgetGroup[] = []
  ) => {
    setLoading(true);
    try {
      const budgetPeriodId = await getOrCreateBudgetPeriod(year, month);
      if (!budgetPeriodId) {
        toast({ title: "Error", description: "Failed to create budget period", variant: "destructive" });
        return false;
      }

      // Delete existing categories and subcategories
      await supabase
        .from('budget_categories')
        .delete()
        .eq('budget_period_id', budgetPeriodId);

      // Prepare all categories
      const allCategories = [
        ...costGroups.map(cat => ({ ...cat, category_type: 'cost' as const, is_personal: false, personName: undefined })),
        ...savingsGroups.map(cat => ({ ...cat, category_type: 'savings' as const, is_personal: false, personName: undefined })),
        ...andreasPersonalCosts.map(cat => ({ ...cat, category_type: 'cost' as const, is_personal: true, personName: 'andreas' as const })),
        ...andreasPersonalSavings.map(cat => ({ ...cat, category_type: 'savings' as const, is_personal: true, personName: 'andreas' as const })),
        ...susannaPersonalCosts.map(cat => ({ ...cat, category_type: 'cost' as const, is_personal: true, personName: 'susanna' as const })),
        ...susannaPersonalSavings.map(cat => ({ ...cat, category_type: 'savings' as const, is_personal: true, personName: 'susanna' as const }))
      ];

      // Insert categories
      const categoryEntries = allCategories.map(cat => ({
        budget_period_id: budgetPeriodId,
        category_id: cat.id,
        name: cat.name,
        amount: cat.amount,
        category_type: cat.category_type,
        is_personal: cat.is_personal,
        person_name: cat.personName || null,
        account: cat.account || null,
        financed_from: cat.financedFrom || null
      }));

      const { data: insertedCategories, error: categoryError } = await supabase
        .from('budget_categories')
        .insert(categoryEntries)
        .select('id, category_id');

      if (categoryError) {
        console.error('Error saving categories:', categoryError);
        toast({ title: "Error", description: "Failed to save categories", variant: "destructive" });
        return false;
      }

      // Insert subcategories
      const subcategoryEntries: any[] = [];
      allCategories.forEach(cat => {
        if (cat.subCategories && cat.subCategories.length > 0) {
          const categoryDbId = insertedCategories.find(c => c.category_id === cat.id)?.id;
          if (categoryDbId) {
            cat.subCategories.forEach(sub => {
              subcategoryEntries.push({
                budget_category_id: categoryDbId,
                subcategory_id: sub.id,
                name: sub.name,
                amount: sub.amount,
                account: sub.account || null,
                financed_from: sub.financedFrom || null
              });
            });
          }
        }
      });

      if (subcategoryEntries.length > 0) {
        const { error: subcategoryError } = await supabase
          .from('budget_subcategories')
          .insert(subcategoryEntries);

        if (subcategoryError) {
          console.error('Error saving subcategories:', subcategoryError);
          toast({ title: "Error", description: "Failed to save subcategories", variant: "destructive" });
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in saveBudgetCategories:', error);
      toast({ title: "Error", description: "Failed to save budget categories", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [getOrCreateBudgetPeriod, toast]);

  // Load budget categories
  const loadBudgetCategories = useCallback(async (year: number, month: number) => {
    try {
      const { data: period } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!period) return null;

      const { data: categories, error: catError } = await supabase
        .from('budget_categories')
        .select(`
          id,
          category_id,
          name,
          amount,
          category_type,
          is_personal,
          person_name,
          account,
          financed_from,
          budget_subcategories (
            subcategory_id,
            name,
            amount,
            account,
            financed_from
          )
        `)
        .eq('budget_period_id', period.id);

      if (catError) {
        console.error('Error loading categories:', catError);
        return null;
      }

      const costGroups: BudgetGroup[] = [];
      const savingsGroups: BudgetGroup[] = [];
      const andreasPersonalCosts: BudgetGroup[] = [];
      const andreasPersonalSavings: BudgetGroup[] = [];
      const susannaPersonalCosts: BudgetGroup[] = [];
      const susannaPersonalSavings: BudgetGroup[] = [];

      categories?.forEach(cat => {
        const budgetGroup: BudgetGroup = {
          id: cat.category_id,
          name: cat.name,
          amount: Number(cat.amount),
          type: cat.category_type as 'cost' | 'savings',
          account: cat.account || undefined,
          financedFrom: cat.financed_from as 'Löpande kostnad' | 'Enskild kostnad' | undefined,
          subCategories: cat.budget_subcategories.map(sub => ({
            id: sub.subcategory_id,
            name: sub.name,
            amount: Number(sub.amount),
            account: sub.account || undefined,
            financedFrom: sub.financed_from as 'Löpande kostnad' | 'Enskild kostnad' | undefined
          }))
        };

        if (cat.is_personal) {
          if (cat.person_name === 'andreas') {
            if (cat.category_type === 'cost') {
              andreasPersonalCosts.push(budgetGroup);
            } else {
              andreasPersonalSavings.push(budgetGroup);
            }
          } else if (cat.person_name === 'susanna') {
            if (cat.category_type === 'cost') {
              susannaPersonalCosts.push(budgetGroup);
            } else {
              susannaPersonalSavings.push(budgetGroup);
            }
          }
        } else {
          if (cat.category_type === 'cost') {
            costGroups.push(budgetGroup);
          } else {
            savingsGroups.push(budgetGroup);
          }
        }
      });

      return {
        costGroups,
        savingsGroups,
        andreasPersonalCosts,
        andreasPersonalSavings,
        susannaPersonalCosts,
        susannaPersonalSavings
      };
    } catch (error) {
      console.error('Error in loadBudgetCategories:', error);
      return null;
    }
  }, []);

  // Save transfer data
  const saveTransferData = useCallback(async (year: number, month: number, transfers: BudgetTransfers) => {
    setLoading(true);
    try {
      const budgetPeriodId = await getOrCreateBudgetPeriod(year, month);
      if (!budgetPeriodId) {
        toast({ title: "Error", description: "Failed to create budget period", variant: "destructive" });
        return false;
      }

      const { error } = await supabase
        .from('budget_transfers')
        .upsert({
          budget_period_id: budgetPeriodId,
          daily_transfer: transfers.dailyTransfer,
          weekend_transfer: transfers.weekendTransfer,
          transfer_account: transfers.transferAccount
        }, {
          onConflict: 'budget_period_id'
        });

      if (error) {
        console.error('Error saving transfer data:', error);
        toast({ title: "Error", description: "Failed to save transfer data", variant: "destructive" });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveTransferData:', error);
      toast({ title: "Error", description: "Failed to save transfer data", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [getOrCreateBudgetPeriod, toast]);

  // Load transfer data
  const loadTransferData = useCallback(async (year: number, month: number): Promise<BudgetTransfers | null> => {
    try {
      const { data: period } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!period) return null;

      const { data: transfers, error } = await supabase
        .from('budget_transfers')
        .select('daily_transfer, weekend_transfer, transfer_account')
        .eq('budget_period_id', period.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading transfer data:', error);
        return null;
      }

      if (!transfers) return null;

      return {
        dailyTransfer: Number(transfers.daily_transfer),
        weekendTransfer: Number(transfers.weekend_transfer),
        transferAccount: Number(transfers.transfer_account)
      };
    } catch (error) {
      console.error('Error in loadTransferData:', error);
      return null;
    }
  }, []);

  // Save account balances
  const saveAccountBalances = useCallback(async (year: number, month: number, balances: AccountBalance[]) => {
    setLoading(true);
    try {
      const budgetPeriodId = await getOrCreateBudgetPeriod(year, month);
      if (!budgetPeriodId) {
        toast({ title: "Error", description: "Failed to create budget period", variant: "destructive" });
        return false;
      }

      // Delete existing balances
      await supabase
        .from('account_balances')
        .delete()
        .eq('budget_period_id', budgetPeriodId);

      // Insert new balances
      const balanceEntries = balances.map(balance => ({
        budget_period_id: budgetPeriodId,
        account_name: balance.accountName,
        starting_balance: balance.startingBalance,
        starting_balance_set: balance.startingBalanceSet,
        final_balance: balance.finalBalance,
        final_balance_set: balance.finalBalanceSet,
        estimated_final_balance: balance.estimatedFinalBalance
      }));

      const { error } = await supabase
        .from('account_balances')
        .insert(balanceEntries);

      if (error) {
        console.error('Error saving account balances:', error);
        toast({ title: "Error", description: "Failed to save account balances", variant: "destructive" });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveAccountBalances:', error);
      toast({ title: "Error", description: "Failed to save account balances", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [getOrCreateBudgetPeriod, toast]);

  // Load account balances
  const loadAccountBalances = useCallback(async (year: number, month: number): Promise<AccountBalance[] | null> => {
    try {
      const { data: period } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!period) return null;

      const { data: balances, error } = await supabase
        .from('account_balances')
        .select('*')
        .eq('budget_period_id', period.id);

      if (error) {
        console.error('Error loading account balances:', error);
        return null;
      }

      return balances?.map(balance => ({
        accountName: balance.account_name,
        startingBalance: Number(balance.starting_balance),
        startingBalanceSet: balance.starting_balance_set,
        finalBalance: Number(balance.final_balance),
        finalBalanceSet: balance.final_balance_set,
        estimatedFinalBalance: Number(balance.estimated_final_balance)
      })) || [];
    } catch (error) {
      console.error('Error in loadAccountBalances:', error);
      return null;
    }
  }, []);

  // Save budget configuration
  const saveBudgetConfiguration = useCallback(async (config: BudgetConfiguration) => {
    setLoading(true);
    try {
      const configEntries = [
        { config_type: 'accounts', config_data: config.accounts },
        { config_type: 'account_categories', config_data: config.accountCategories },
        { config_type: 'account_category_mapping', config_data: config.accountCategoryMapping },
        { config_type: 'user_names', config_data: config.userNames }
      ];

      for (const entry of configEntries) {
        const { error } = await supabase
          .from('budget_config')
          .upsert({
            config_type: entry.config_type,
            config_data: entry.config_data
          }, {
            onConflict: 'user_id,config_type'
          });

        if (error) {
          console.error(`Error saving ${entry.config_type}:`, error);
          toast({ title: "Error", description: `Failed to save ${entry.config_type}`, variant: "destructive" });
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in saveBudgetConfiguration:', error);
      toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load budget configuration
  const loadBudgetConfiguration = useCallback(async (): Promise<BudgetConfiguration | null> => {
    try {
      const { data: configs, error } = await supabase
        .from('budget_config')
        .select('config_type, config_data');

      if (error) {
        console.error('Error loading configuration:', error);
        return null;
      }

      const defaultConfig: BudgetConfiguration = {
        accounts: ['Löpande', 'Sparkonto', 'Buffert'],
        accountCategories: ['Privat', 'Gemensam', 'Sparande', 'Hushåll'],
        accountCategoryMapping: {},
        userNames: { userName1: 'Andreas', userName2: 'Susanna' }
      };

      configs?.forEach(config => {
        switch (config.config_type) {
          case 'accounts':
            defaultConfig.accounts = config.config_data;
            break;
          case 'account_categories':
            defaultConfig.accountCategories = config.config_data;
            break;
          case 'account_category_mapping':
            defaultConfig.accountCategoryMapping = config.config_data;
            break;
          case 'user_names':
            defaultConfig.userNames = config.config_data;
            break;
        }
      });

      return defaultConfig;
    } catch (error) {
      console.error('Error in loadBudgetConfiguration:', error);
      return null;
    }
  }, []);

  // Save budget calculations
  const saveBudgetCalculations = useCallback(async (year: number, month: number, calculations: any) => {
    setLoading(true);
    try {
      const budgetPeriodId = await getOrCreateBudgetPeriod(year, month);
      if (!budgetPeriodId) {
        toast({ title: "Error", description: "Failed to create budget period", variant: "destructive" });
        return false;
      }

      const { error } = await supabase
        .from('budget_calculations')
        .upsert({
          budget_period_id: budgetPeriodId,
          calculation_data: calculations
        }, {
          onConflict: 'budget_period_id'
        });

      if (error) {
        console.error('Error saving calculations:', error);
        toast({ title: "Error", description: "Failed to save calculations", variant: "destructive" });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveBudgetCalculations:', error);
      toast({ title: "Error", description: "Failed to save calculations", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [getOrCreateBudgetPeriod, toast]);

  // Load budget calculations
  const loadBudgetCalculations = useCallback(async (year: number, month: number) => {
    try {
      const { data: period } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!period) return null;

      const { data: calculations, error } = await supabase
        .from('budget_calculations')
        .select('calculation_data')
        .eq('budget_period_id', period.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading calculations:', error);
        return null;
      }

      return calculations?.calculation_data || null;
    } catch (error) {
      console.error('Error in loadBudgetCalculations:', error);
      return null;
    }
  }, []);

  // Get all saved budget periods
  const getBudgetPeriods = useCallback(async () => {
    try {
      const { data: periods, error } = await supabase
        .from('budget_periods')
        .select('year, month')
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error) {
        console.error('Error loading budget periods:', error);
        return [];
      }

      return periods || [];
    } catch (error) {
      console.error('Error in getBudgetPeriods:', error);
      return [];
    }
  }, []);

  return {
    loading,
    saveIncomeData,
    loadIncomeData,
    saveBudgetCategories,
    loadBudgetCategories,
    saveTransferData,
    loadTransferData,
    saveAccountBalances,
    loadAccountBalances,
    saveBudgetConfiguration,
    loadBudgetConfiguration,
    saveBudgetCalculations,
    loadBudgetCalculations,
    getBudgetPeriods
  };
};