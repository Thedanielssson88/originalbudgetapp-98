import { pgTable, text, serial, integer, boolean, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Huvudkategori (Main Category) table with UUID as primary key
export const huvudkategorier = pgTable("huvudkategorier", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Underkategori (Sub Category) table with UUID as primary key and foreign key to Huvudkategori
export const underkategorier = pgTable("underkategorier", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  huvudkategoriId: uuid("huvudkategori_id").notNull().references(() => huvudkategorier.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Category rules table for mapping bank categories to app categories
export const categoryRules = pgTable("category_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  priority: integer("priority").notNull().default(1),
  conditionType: text("condition_type").notNull(), // 'textContains', 'textStartsWith', 'categoryMatch'
  conditionValue: text("condition_value").notNull(),
  bankCategory: text("bank_category"), // For categoryMatch conditions
  bankSubCategory: text("bank_sub_category"), // For categoryMatch conditions
  huvudkategoriId: uuid("huvudkategori_id").notNull().references(() => huvudkategorier.id),
  underkategoriId: uuid("underkategori_id").references(() => underkategorier.id),
  positiveTransactionType: text("positive_transaction_type").notNull().default('Transaction'),
  negativeTransactionType: text("negative_transaction_type").notNull().default('Transaction'),
  applicableAccountIds: text("applicable_account_ids").array(), // Array of account IDs
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table to store categorized transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("account_id").notNull(),
  date: timestamp("date").notNull(),
  bankCategory: text("bank_category"),
  bankSubCategory: text("bank_sub_category"),
  description: text("description").notNull(),
  userDescription: text("user_description"),
  amount: integer("amount").notNull(), // Stored as cents
  balanceAfter: integer("balance_after"), // Stored as cents
  status: text("status").notNull().default('red'), // 'red', 'yellow', 'green'
  type: text("type").notNull().default('Transaction'),
  huvudkategoriId: uuid("huvudkategori_id").references(() => huvudkategorier.id),
  underkategoriId: uuid("underkategori_id").references(() => underkategorier.id),
  linkedTransactionId: uuid("linked_transaction_id"),
  correctedAmount: integer("corrected_amount"), // Stored as cents
  savingsTargetId: text("savings_target_id"),
  isManuallyChanged: boolean("is_manually_changed").default(false),
  importedAt: timestamp("imported_at").defaultNow(),
  fileSource: text("file_source"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for Zod validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertHuvudkategoriSchema = createInsertSchema(huvudkategorier).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUnderkategoriSchema = createInsertSchema(underkategorier).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategoryRuleSchema = createInsertSchema(categoryRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertHuvudkategori = z.infer<typeof insertHuvudkategoriSchema>;
export type Huvudkategori = typeof huvudkategorier.$inferSelect;

export type InsertUnderkategori = z.infer<typeof insertUnderkategoriSchema>;
export type Underkategori = typeof underkategorier.$inferSelect;

export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;
export type CategoryRuleDB = typeof categoryRules.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionDB = typeof transactions.$inferSelect;
