import { pgTable, text, uuid, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- User Table (assuming you have one for auth) ---
export const users = pgTable('users', {
    id: text('id').primaryKey(), // ID from your authentication provider
});

// --- Core Application Tables ---

// Family members table for managing household users
export const familyMembers = pgTable('family_members', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    balance: integer('balance').default(0).notNull(),
    // Account ownership: either 'gemensamt' or a family member ID
    assignedTo: text('assigned_to').default('gemensamt'), // 'gemensamt' or familyMember.id
    // Bank template ID for CSV import mapping  
    bankTemplateId: text('bank_template_id'),
});

// Monthly account balances calculated from last transaction before 25th
export const monthlyAccountBalances = pgTable('monthly_account_balances', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    monthKey: text('month_key').notNull(), // Format: "YYYY-MM" (e.g., "2025-08")
    accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    calculatedBalance: integer('calculated_balance').notNull(), // Balance in öre calculated from last transaction before 25th
    faktisktKontosaldo: integer('faktiskt_kontosaldo'), // User inputted actual balance in öre, nullable
    bankensKontosaldo: integer('bankens_kontosaldo'), // Balance in öre from CSV import (last transaction before payday), nullable
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    // Ensure unique month-account combinations per user
    uniqueUserMonthAccount: unique().on(table.userId, table.monthKey, table.accountId),
}));

export const huvudkategorier = pgTable('huvudkategorier', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
});

export const underkategorier = pgTable('underkategorier', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    huvudkategoriId: uuid('huvudkategori_id').notNull().references(() => huvudkategorier.id, { onDelete: 'cascade' }),
});

export const transactions = pgTable('transactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    date: timestamp('date', { mode: 'date' }).notNull(),
    balanceAfter: integer('balance_after').default(0).notNull(),
    userDescription: text('user_description').default('').notNull(),
    bankCategory: text('bank_category').default('').notNull(),
    bankSubCategory: text('bank_sub_category').default('').notNull(),
    type: text('type').default('Transaction').notNull(),
    status: text('status').default('yellow').notNull(),
    linkedTransactionId: uuid('linked_transaction_id'),
    correctedAmount: integer('corrected_amount'),
    isManuallyChanged: text('is_manually_changed').default('false').notNull(),
    appCategoryId: uuid('app_category_id').references(() => huvudkategorier.id, { onDelete: 'set null' }),
    appSubCategoryId: uuid('app_sub_category_id').references(() => underkategorier.id, { onDelete: 'set null' }),
    // Keep legacy references for backward compatibility
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'set null' }),
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'set null' }),
});

export const categoryRules = pgTable('category_rules', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ruleName: text('rule_name').notNull(),
    transactionName: text('transaction_name').notNull(),
    bankCategory: text('bank_category'), // Optional - only for exact bank category matching rules
    bankSubCategory: text('bank_sub_category'), // Optional - only for exact bank category matching rules
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'cascade' }),
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'cascade' }),
    // Additional fields for complete rule management
    positiveTransactionType: text('positive_transaction_type').default('Transaction').notNull(),
    negativeTransactionType: text('negative_transaction_type').default('Transaction').notNull(),
    applicableAccountIds: text('applicable_account_ids').default('[]').notNull(), // JSON string of account IDs
    priority: integer('priority').default(100).notNull(),
    isActive: text('is_active').default('true').notNull(),
});

// Banks table for storing bank information
export const banks = pgTable('banks', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Bank CSV mappings table for storing column mappings per bank
export const bankCsvMappings = pgTable('bank_csv_mappings', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bankId: uuid('bank_id').notNull().references(() => banks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // Mapping name/description
    // Column mappings - store the column index or name from CSV/XLSX
    dateColumn: text('date_column'), // Which column contains date
    descriptionColumn: text('description_column'), // Which column contains description  
    amountColumn: text('amount_column'), // Which column contains amount
    balanceColumn: text('balance_column'), // Which column contains balance/saldo
    bankCategoryColumn: text('bank_category_column'), // Which column contains bank category
    bankSubCategoryColumn: text('bank_sub_category_column'), // Which column contains bank subcategory
    isActive: text('is_active').default('true').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Budget posts table for storing individual budget line items
export const budgetPosts = pgTable('budget_posts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    monthKey: text('month_key').notNull(), // Format: YYYY-MM
    huvudkategoriId: uuid('huvudkategori_id').notNull().references(() => huvudkategorier.id, { onDelete: 'cascade' }),
    underkategoriId: uuid('underkategori_id').notNull().references(() => underkategorier.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amount: integer('amount').notNull(), // For fixed monthly amounts
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    financedFrom: text('financed_from').default('Löpande kostnad').notNull(), // 'Löpande kostnad' or 'Enskild kostnad'
    transferType: text('transfer_type').default('monthly').notNull(), // 'monthly' or 'daily'
    dailyAmount: integer('daily_amount'), // For daily transfers
    transferDays: text('transfer_days'), // JSON array of weekday numbers [0-6] for daily transfers
    type: text('type').notNull(), // 'cost' or 'savings'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const monthlyBudgets = pgTable('monthly_budgets', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    monthKey: text('month_key').notNull(), // Format: YYYY-MM
    // Dynamic user income fields - use family member IDs
    primaryUserId: uuid('primary_user_id').references(() => familyMembers.id, { onDelete: 'set null' }),
    secondaryUserId: uuid('secondary_user_id').references(() => familyMembers.id, { onDelete: 'set null' }),
    primaryUserSalary: integer('primary_user_salary').default(0).notNull(),
    primaryUserförsäkringskassan: integer('primary_user_forsakringskassan').default(0).notNull(),
    primaryUserbarnbidrag: integer('primary_user_barnbidrag').default(0).notNull(),
    secondaryUserSalary: integer('secondary_user_salary').default(0).notNull(),
    secondaryUserförsäkringskassan: integer('secondary_user_forsakringskassan').default(0).notNull(),
    secondaryUserbarnbidrag: integer('secondary_user_barnbidrag').default(0).notNull(),
    dailyTransfer: integer('daily_transfer').default(300).notNull(),
    weekendTransfer: integer('weekend_transfer').default(540).notNull(),
    primaryUserPersonalCosts: integer('primary_user_personal_costs').default(0).notNull(),
    primaryUserPersonalSavings: integer('primary_user_personal_savings').default(0).notNull(),
    secondaryUserPersonalCosts: integer('secondary_user_personal_costs').default(0).notNull(),
    secondaryUserPersonalSavings: integer('secondary_user_personal_savings').default(0).notNull(),
    // Keep legacy fields for backward compatibility during migration
    andreasSalary: integer('andreas_salary').default(0).notNull(),
    andreasförsäkringskassan: integer('andreas_forsakringskassan').default(0).notNull(),
    andreasbarnbidrag: integer('andreas_barnbidrag').default(0).notNull(),
    susannaSalary: integer('susanna_salary').default(0).notNull(),
    susannaförsäkringskassan: integer('susanna_forsakringskassan').default(0).notNull(),
    susannabarnbidrag: integer('susanna_barnbidrag').default(0).notNull(),
    andreasPersonalCosts: integer('andreas_personal_costs').default(0).notNull(),
    andreasPersonalSavings: integer('andreas_personal_savings').default(0).notNull(),
    susannaPersonalCosts: integer('susanna_personal_costs').default(0).notNull(),
    susannaPersonalSavings: integer('susanna_personal_savings').default(0).notNull(),
    userName1: text('user_name_1').default('Andreas').notNull(),
    userName2: text('user_name_2').default('Susanna').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Insert schemas for Zod validation
export const insertUserSchema = createInsertSchema(users);

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
});

export const insertHuvudkategoriSchema = createInsertSchema(huvudkategorier).omit({
  id: true,
});

export const insertUnderkategoriSchema = createInsertSchema(underkategorier).omit({
  id: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
});

export const insertCategoryRuleSchema = createInsertSchema(categoryRules).omit({
  id: true,
});

export const insertBudgetPostSchema = createInsertSchema(budgetPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyBudgetSchema = createInsertSchema(monthlyBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyAccountBalanceSchema = createInsertSchema(monthlyAccountBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankSchema = createInsertSchema(banks).omit({
  id: true,
  createdAt: true,
});

export const insertBankCsvMappingSchema = createInsertSchema(bankCsvMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export type InsertHuvudkategori = z.infer<typeof insertHuvudkategoriSchema>;
export type Huvudkategori = typeof huvudkategorier.$inferSelect;

export type InsertUnderkategori = z.infer<typeof insertUnderkategoriSchema>;
export type Underkategori = typeof underkategorier.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;
export type CategoryRule = typeof categoryRules.$inferSelect;

export type InsertBudgetPost = z.infer<typeof insertBudgetPostSchema>;
export type BudgetPost = typeof budgetPosts.$inferSelect;

export type InsertMonthlyBudget = z.infer<typeof insertMonthlyBudgetSchema>;
export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;

export type InsertMonthlyAccountBalance = z.infer<typeof insertMonthlyAccountBalanceSchema>;
export type MonthlyAccountBalance = typeof monthlyAccountBalances.$inferSelect;
