import { pgTable, text, uuid, timestamp, integer, boolean, unique, index, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from 'drizzle-orm';

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Core Application Tables ---

// Family members table for managing household users
export const familyMembers = pgTable('family_members', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role', { enum: ['adult', 'child'] }).default('adult').notNull(), // 'adult' = Vuxen, 'child' = Barn
    contributesToBudget: boolean('contributes_to_budget').default(true).notNull(), // true = Ja, false = Nej
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Income sources table (Inkomstkällor)
export const inkomstkallor = pgTable('inkomstkallor', {
    id: uuid('id_inkomstkalla').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(), // e.g. "Lön", "Försäkringskassan", "Barnbidrag"
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Income source member assignments (which income sources are enabled for which family members)
export const inkomstkallorMedlem = pgTable('inkomstkallor_medlem', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    familjemedlemId: uuid('familjemedlem_id').notNull().references(() => familyMembers.id, { onDelete: 'cascade' }),
    idInkomstkalla: uuid('id_inkomstkalla').notNull().references(() => inkomstkallor.id, { onDelete: 'cascade' }),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    // Ensure unique member-income source combinations per user
    uniqueMemberIncomeSource: unique().on(table.userId, table.familjemedlemId, table.idInkomstkalla),
}));

// Account types table for categorizing accounts
export const accountTypes = pgTable('account_types', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    balance: integer('balance').default(0).notNull(),
    // Account ownership: either null/'gemensamt' or a family member UUID string
    assignedTo: text('assigned_to'), // null/'gemensamt' = shared, UUID string = specific family member
    // Bank template ID for CSV import mapping  
    bankTemplateId: text('bank_template_id'),
    // Account type reference
    accountTypeId: uuid('account_type_id').references(() => accountTypes.id, { onDelete: 'set null' }),
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
    linkedCostId: uuid('linked_cost_id'), // Links to transactions for expense coverage
    savingsTargetId: uuid('savings_target_id'), // Links to budget_posts.id for savings goals/posts
    incomeTargetId: uuid('income_target_id'), // Links to budget_posts.id for income sources - reference added below after budgetPosts definition
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
    transactionName: text('transaction_name'), // Nullable for optional rule types (treated as wildcard when null)
    ruleType: text('rule_type', { enum: ['textContains', 'textStartsWith', 'exactText', 'categoryMatch'] }), // Rule type for matching logic (nullable for existing rules)
    bankCategory: text('bank_category'), // Optional - only for exact bank category matching rules
    bankSubCategory: text('bank_sub_category'), // Optional - only for exact bank category matching rules
    // NEW: Bank category filter fields for rule conditions
    bankhuvudkategori: text('bankhuvudkategori'), // Optional - filter rules by bank main category (null = "Alla Bankkategorier")
    bankunderkategori: text('bankunderkategori'), // Optional - filter rules by bank subcategory (null = "Alla Bankunderkategorier")
    transactionDirection: text('transaction_direction', { enum: ['all', 'positive', 'negative'] }).default('all'), // NEW: Filter by transaction amount direction (nullable for migration)
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'cascade' }),
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'cascade' }),
    // Additional fields for complete rule management
    positiveTransactionType: text('positive_transaction_type').default('Transaction').notNull(),
    negativeTransactionType: text('negative_transaction_type').default('Transaction').notNull(),
    applicableAccountIds: text('applicable_account_ids').default('[]').notNull(), // JSON string of account IDs
    priority: integer('priority').default(100).notNull(),
    isActive: text('is_active').default('true').notNull(),
    autoApproval: boolean('auto_approval').default(false).notNull(), // NEW: Auto-approve transactions when rule is applied
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

// Planned transfers table for storing transfer configurations
export const plannedTransfers = pgTable('planned_transfers', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    fromAccountId: uuid('from_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // Amount in öre
    month: text('month').notNull(), // Format: YYYY-MM
    description: text('description'),
    transferType: text('transfer_type').default('monthly').notNull(), // 'monthly' or 'daily'
    dailyAmount: integer('daily_amount'), // Amount per day for daily transfers (in öre)
    transferDays: text('transfer_days'), // JSON array of weekday numbers [0-6]
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'set null' }),
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Budget posts table for storing individual budget line items
export const budgetPosts = pgTable('budget_posts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    monthKey: text('month_key').notNull(), // Format: YYYY-MM
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'cascade' }), // Nullable for transfers
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'cascade' }), // Nullable for transfers
    description: text('description').notNull(),
    name: text('name'), // For sparmål - the actual name like "Egypten"
    startDate: text('start_date'), // For sparmål - format: YYYY-MM
    endDate: text('end_date'), // For sparmål - format: YYYY-MM
    amount: integer('amount').notNull(), // For fixed monthly amounts
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }), // To account for transfers
    accountIdFrom: uuid('account_id_from').references(() => accounts.id, { onDelete: 'set null' }), // From account for transfers
    financedFrom: text('financed_from').default('Löpande kostnad').notNull(), // 'Löpande kostnad' or 'Enskild kostnad'
    transferType: text('transfer_type').default('monthly').notNull(), // 'monthly' or 'daily'
    dailyAmount: integer('daily_amount'), // For daily transfers
    transferDays: text('transfer_days'), // JSON array of weekday numbers [0-6] for daily transfers
    type: text('type').notNull(), // 'cost', 'savings', 'sparmål', 'transfer', 'Inkomst', or 'Balance'
    transactionType: text('transaction_type').default('Kostnadspost'), // Transaction type label
    budgetType: text('budget_type').default('Kostnadspost'), // Budget type label
    // New fields for income tracking
    idInkomstkalla: uuid('id_inkomstkalla').references(() => inkomstkallor.id, { onDelete: 'cascade' }), // Reference to income source
    familjemedlemId: uuid('familjemedlem_id').references(() => familyMembers.id, { onDelete: 'cascade' }), // Reference to family member
    // New fields for Balance type (Kontosaldo Kopia)
    accountUserBalance: integer('account_user_balance'), // User-entered balance (Faktiskt Kontosaldo) in öre
    accountBalance: integer('account_balance'), // Bank balance (Bankens Kontosaldo) in öre
    // Status field for sparmål completion tracking
    status: text('status').default('yellow').notNull(), // 'yellow' = active, 'green' = completed, 'red' = needs attention
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
  updatedAt: true,
});

export const insertInkomstkallSchema = createInsertSchema(inkomstkallor).omit({
  id: true,
  createdAt: true,
});

export const insertInkomstkallorMedlemSchema = createInsertSchema(inkomstkallorMedlem).omit({
  id: true,
  createdAt: true,
});

export const insertAccountTypeSchema = createInsertSchema(accountTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertPlannedTransferSchema = createInsertSchema(plannedTransfers).omit({
  id: true,
  createdAt: true,
});

// User settings table for storing application preferences
export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  settingKey: text('setting_key').notNull(),
  settingValue: text('setting_value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Ensure unique setting keys per user
  uniqueUserSettingKey: unique().on(table.userId, table.settingKey),
}));

export const insertUserSettingSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

export type InsertInkomstkall = z.infer<typeof insertInkomstkallSchema>;
export type Inkomstkall = typeof inkomstkallor.$inferSelect;

export type InsertInkomstkallorMedlem = z.infer<typeof insertInkomstkallorMedlemSchema>;
export type InkomstkallorMedlem = typeof inkomstkallorMedlem.$inferSelect;

export type InsertAccountType = z.infer<typeof insertAccountTypeSchema>;
export type AccountType = typeof accountTypes.$inferSelect;

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

export type InsertPlannedTransfer = z.infer<typeof insertPlannedTransferSchema>;
export type PlannedTransfer = typeof plannedTransfers.$inferSelect;

export type InsertUserSetting = z.infer<typeof insertUserSettingSchema>;
export type UserSetting = typeof userSettings.$inferSelect;
