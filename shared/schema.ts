import { pgTable, text, uuid, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- User Table (assuming you have one for auth) ---
export const users = pgTable('users', {
    id: text('id').primaryKey(), // ID from your authentication provider
});

// --- Core Application Tables ---

export const accounts = pgTable('accounts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    balance: integer('balance').default(0).notNull(),
});

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
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'set null' }),
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'set null' }),
});

export const categoryRules = pgTable('category_rules', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ruleName: text('rule_name').notNull(),
    transactionName: text('transaction_name').notNull(),
    huvudkategoriId: uuid('huvudkategori_id').references(() => huvudkategorier.id, { onDelete: 'cascade' }),
    underkategoriId: uuid('underkategori_id').references(() => underkategorier.id, { onDelete: 'cascade' }),
});

// Insert schemas for Zod validation
export const insertUserSchema = createInsertSchema(users);

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

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
