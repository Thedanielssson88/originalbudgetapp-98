import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  users,
  accounts,
  huvudkategorier,
  underkategorier,
  categoryRules,
  transactions,
  type User,
  type InsertUser,
  type Account,
  type InsertAccount,
  type Huvudkategori,
  type InsertHuvudkategori,
  type Underkategori,
  type InsertUnderkategori,
  type CategoryRule,
  type InsertCategoryRule,
  type Transaction,
  type InsertTransaction
} from "@shared/schema";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Bootstrap method
  async bootstrap(userId: string): Promise<{
    accounts: Account[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
  }> {
    const [accountsResult, huvudkategorierResult, underkategorierResult, categoryRulesResult] = await Promise.all([
      this.getAccounts(userId),
      this.getHuvudkategorier(userId),
      this.getUnderkategorier(userId),
      this.getCategoryRules(userId)
    ]);

    return {
      accounts: accountsResult,
      huvudkategorier: huvudkategorierResult,
      underkategorier: underkategorierResult,
      categoryRules: categoryRulesResult,
    };
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    return await db.select().from(accounts).where(eq(accounts.userId, userId));
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const result = await db.select().from(accounts).where(eq(accounts.id, id));
    return result[0];
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const result = await db.insert(accounts).values(account).returning();
    return result[0];
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const result = await db.update(accounts)
      .set(account)
      .where(eq(accounts.id, id))
      .returning();
    return result[0];
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  }

  // Huvudkategori methods
  async getHuvudkategorier(userId: string): Promise<Huvudkategori[]> {
    return await db.select().from(huvudkategorier).where(eq(huvudkategorier.userId, userId));
  }

  async getHuvudkategori(id: string): Promise<Huvudkategori | undefined> {
    const result = await db.select().from(huvudkategorier).where(eq(huvudkategorier.id, id));
    return result[0];
  }

  async createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori> {
    const result = await db.insert(huvudkategorier).values(kategori).returning();
    return result[0];
  }

  async updateHuvudkategori(id: string, kategori: Partial<InsertHuvudkategori>): Promise<Huvudkategori | undefined> {
    const result = await db.update(huvudkategorier)
      .set(kategori)
      .where(eq(huvudkategorier.id, id))
      .returning();
    return result[0];
  }

  async deleteHuvudkategori(id: string): Promise<boolean> {
    const result = await db.delete(huvudkategorier).where(eq(huvudkategorier.id, id)).returning();
    return result.length > 0;
  }

  // Underkategori methods
  async getUnderkategorier(userId: string): Promise<Underkategori[]> {
    return await db.select().from(underkategorier).where(eq(underkategorier.userId, userId));
  }

  async getUnderkategorierByHuvudkategori(huvudkategoriId: string, userId: string): Promise<Underkategori[]> {
    return await db.select()
      .from(underkategorier)
      .where(and(
        eq(underkategorier.huvudkategoriId, huvudkategoriId),
        eq(underkategorier.userId, userId)
      ));
  }

  async getUnderkategori(id: string): Promise<Underkategori | undefined> {
    const result = await db.select().from(underkategorier).where(eq(underkategorier.id, id));
    return result[0];
  }

  async createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori> {
    const result = await db.insert(underkategorier).values(kategori).returning();
    return result[0];
  }

  async updateUnderkategori(id: string, kategori: Partial<InsertUnderkategori>): Promise<Underkategori | undefined> {
    const result = await db.update(underkategorier)
      .set(kategori)
      .where(eq(underkategorier.id, id))
      .returning();
    return result[0];
  }

  async deleteUnderkategori(id: string): Promise<boolean> {
    const result = await db.delete(underkategorier).where(eq(underkategorier.id, id)).returning();
    return result.length > 0;
  }

  // Category Rules methods
  async getCategoryRules(userId: string): Promise<CategoryRule[]> {
    return await db.select().from(categoryRules).where(eq(categoryRules.userId, userId));
  }

  async getCategoryRule(id: string): Promise<CategoryRule | undefined> {
    const result = await db.select().from(categoryRules).where(eq(categoryRules.id, id));
    return result[0];
  }

  async createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRule> {
    const result = await db.insert(categoryRules).values(rule).returning();
    return result[0];
  }

  async updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined> {
    const result = await db.update(categoryRules)
      .set(rule)
      .where(eq(categoryRules.id, id))
      .returning();
    return result[0];
  }

  async deleteCategoryRule(id: string): Promise<boolean> {
    const result = await db.delete(categoryRules).where(eq(categoryRules.id, id)).returning();
    return result.length > 0;
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.userId, userId));
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const result = await db.update(transactions)
      .set(transaction)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id)).returning();
    return result.length > 0;
  }
}