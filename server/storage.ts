import { 
  users, 
  familyMembers,
  accounts,
  huvudkategorier,
  underkategorier,
  categoryRules,
  transactions,
  budgetPosts,
  monthlyBudgets,
  type User, 
  type InsertUser,
  type FamilyMember,
  type InsertFamilyMember,
  type Account,
  type InsertAccount,
  type Huvudkategori,
  type InsertHuvudkategori,
  type Underkategori,
  type InsertUnderkategori,
  type CategoryRule,
  type InsertCategoryRule,
  type Transaction,
  type InsertTransaction,
  type BudgetPost,
  type InsertBudgetPost,
  type MonthlyBudget,
  type InsertMonthlyBudget
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User CRUD
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Family Member CRUD
  getFamilyMembers(userId: string): Promise<FamilyMember[]>;
  getFamilyMember(id: string): Promise<FamilyMember | undefined>;
  createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  updateFamilyMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined>;
  deleteFamilyMember(id: string): Promise<boolean>;
  
  // Account CRUD
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<boolean>;
  
  // Huvudkategori CRUD
  getHuvudkategorier(userId: string): Promise<Huvudkategori[]>;
  getHuvudkategori(id: string): Promise<Huvudkategori | undefined>;
  createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori>;
  updateHuvudkategori(id: string, kategori: Partial<InsertHuvudkategori>): Promise<Huvudkategori | undefined>;
  deleteHuvudkategori(id: string): Promise<boolean>;
  
  // Underkategori CRUD
  getUnderkategorier(userId: string): Promise<Underkategori[]>;
  getUnderkategorierByHuvudkategori(huvudkategoriId: string, userId: string): Promise<Underkategori[]>;
  getUnderkategori(id: string): Promise<Underkategori | undefined>;
  createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori>;
  updateUnderkategori(id: string, kategori: Partial<InsertUnderkategori>): Promise<Underkategori | undefined>;
  deleteUnderkategori(id: string): Promise<boolean>;
  
  // Category Rules CRUD
  getCategoryRules(userId: string): Promise<CategoryRule[]>;
  getCategoryRule(id: string): Promise<CategoryRule | undefined>;
  createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRule>;
  updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined>;
  deleteCategoryRule(id: string): Promise<boolean>;
  
  // Transaction CRUD
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  
  // Budget Posts CRUD
  getBudgetPosts(userId: string, monthKey?: string): Promise<BudgetPost[]>;
  getBudgetPost(id: string): Promise<BudgetPost | undefined>;
  createBudgetPost(post: InsertBudgetPost): Promise<BudgetPost>;
  updateBudgetPost(id: string, post: Partial<InsertBudgetPost>): Promise<BudgetPost | undefined>;
  deleteBudgetPost(id: string): Promise<boolean>;
  
  // Monthly Budget CRUD
  getMonthlyBudgets(userId: string): Promise<MonthlyBudget[]>;
  getMonthlyBudget(userId: string, monthKey: string): Promise<MonthlyBudget | undefined>;
  createMonthlyBudget(budget: InsertMonthlyBudget): Promise<MonthlyBudget>;
  updateMonthlyBudget(userId: string, monthKey: string, budget: Partial<InsertMonthlyBudget>): Promise<MonthlyBudget | undefined>;
  deleteMonthlyBudget(userId: string, monthKey: string): Promise<boolean>;
  
  // Bootstrap method to get all data at once
  bootstrap(userId: string): Promise<{
    accounts: Account[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    budgetPosts: BudgetPost[];
    monthlyBudgets: MonthlyBudget[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private accounts: Map<string, Account>;
  private huvudkategorier: Map<string, Huvudkategori>;
  private underkategorier: Map<string, Underkategori>;
  private categoryRules: Map<string, CategoryRule>;
  private transactions: Map<string, Transaction>;
  private budgetPosts: Map<string, BudgetPost>;
  private monthlyBudgets: Map<string, MonthlyBudget>;

  constructor() {
    this.users = new Map();
    this.accounts = new Map();
    this.huvudkategorier = new Map();
    this.underkategorier = new Map();
    this.categoryRules = new Map();
    this.transactions = new Map();
    this.budgetPosts = new Map();
    this.monthlyBudgets = new Map();
  }

  // Bootstrap method
  async bootstrap(userId: string): Promise<{
    accounts: Account[];
    familyMembers: FamilyMember[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    budgetPosts: BudgetPost[];
    monthlyBudgets: MonthlyBudget[];
  }> {
    return {
      accounts: await this.getAccounts(userId),
      familyMembers: await this.getFamilyMembers(userId),
      huvudkategorier: await this.getHuvudkategorier(userId),
      underkategorier: await this.getUnderkategorier(userId),
      categoryRules: await this.getCategoryRules(userId),
      transactions: await this.getTransactions(userId),
      budgetPosts: await this.getBudgetPosts(userId),
      monthlyBudgets: await this.getMonthlyBudgets(userId),
    };
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { ...insertUser };
    this.users.set(user.id, user);
    return user;
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    return Array.from(this.accounts.values()).filter(acc => acc.userId === userId);
  }

  async getAccount(id: string): Promise<Account | undefined> {
    return this.accounts.get(id);
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const id = crypto.randomUUID();
    const newAccount: Account = {
      id,
      ...account,
    };
    this.accounts.set(id, newAccount);
    return newAccount;
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const existing = this.accounts.get(id);
    if (!existing) return undefined;
    
    const updated: Account = {
      ...existing,
      ...account,
    };
    this.accounts.set(id, updated);
    return updated;
  }

  async deleteAccount(id: string): Promise<boolean> {
    return this.accounts.delete(id);
  }

  // Huvudkategori methods
  async getHuvudkategorier(userId: string): Promise<Huvudkategori[]> {
    return Array.from(this.huvudkategorier.values()).filter(kat => kat.userId === userId);
  }

  async getHuvudkategori(id: string): Promise<Huvudkategori | undefined> {
    return this.huvudkategorier.get(id);
  }

  async createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori> {
    const id = crypto.randomUUID();
    const newKategori: Huvudkategori = {
      id,
      ...kategori,
    };
    this.huvudkategorier.set(id, newKategori);
    return newKategori;
  }

  async updateHuvudkategori(id: string, kategori: Partial<InsertHuvudkategori>): Promise<Huvudkategori | undefined> {
    const existing = this.huvudkategorier.get(id);
    if (!existing) return undefined;
    
    const updated: Huvudkategori = {
      ...existing,
      ...kategori,
    };
    this.huvudkategorier.set(id, updated);
    return updated;
  }

  async deleteHuvudkategori(id: string): Promise<boolean> {
    return this.huvudkategorier.delete(id);
  }

  // Underkategori methods
  async getUnderkategorier(userId: string): Promise<Underkategori[]> {
    return Array.from(this.underkategorier.values()).filter(kat => kat.userId === userId);
  }

  async getUnderkategorierByHuvudkategori(huvudkategoriId: string, userId: string): Promise<Underkategori[]> {
    return Array.from(this.underkategorier.values()).filter(
      (sub) => sub.huvudkategoriId === huvudkategoriId && sub.userId === userId
    );
  }

  async getUnderkategori(id: string): Promise<Underkategori | undefined> {
    return this.underkategorier.get(id);
  }

  async createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori> {
    const id = crypto.randomUUID();
    const newKategori: Underkategori = {
      id,
      ...kategori,
    };
    this.underkategorier.set(id, newKategori);
    return newKategori;
  }

  async updateUnderkategori(id: string, kategori: Partial<InsertUnderkategori>): Promise<Underkategori | undefined> {
    const existing = this.underkategorier.get(id);
    if (!existing) return undefined;
    
    const updated: Underkategori = {
      ...existing,
      ...kategori,
    };
    this.underkategorier.set(id, updated);
    return updated;
  }

  async deleteUnderkategori(id: string): Promise<boolean> {
    return this.underkategorier.delete(id);
  }

  // Category Rules methods
  async getCategoryRules(userId: string): Promise<CategoryRule[]> {
    return Array.from(this.categoryRules.values()).filter(rule => rule.userId === userId);
  }

  async getCategoryRule(id: string): Promise<CategoryRule | undefined> {
    return this.categoryRules.get(id);
  }

  async createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRule> {
    const id = crypto.randomUUID();
    const newRule: CategoryRule = {
      id,
      ...rule,
    };
    this.categoryRules.set(id, newRule);
    return newRule;
  }

  async updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined> {
    const existing = this.categoryRules.get(id);
    if (!existing) return undefined;
    
    const updated: CategoryRule = {
      ...existing,
      ...rule,
    };
    this.categoryRules.set(id, updated);
    return updated;
  }

  async deleteCategoryRule(id: string): Promise<boolean> {
    return this.categoryRules.delete(id);
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(trans => trans.userId === userId);
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = crypto.randomUUID();
    const newTransaction: Transaction = {
      id,
      ...transaction,
    };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;
    
    const updated: Transaction = {
      ...existing,
      ...transaction,
    };
    this.transactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    return this.transactions.delete(id);
  }
}

// Import the database storage
import { DatabaseStorage } from "./dbStorage";

// Use database storage when DATABASE_URL is available
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
