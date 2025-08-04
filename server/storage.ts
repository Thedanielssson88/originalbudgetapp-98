import { 
  users, 
  huvudkategorier,
  underkategorier,
  categoryRules,
  transactions,
  type User, 
  type InsertUser,
  type Huvudkategori,
  type InsertHuvudkategori,
  type Underkategori,
  type InsertUnderkategori,
  type CategoryRuleDB,
  type InsertCategoryRule,
  type TransactionDB,
  type InsertTransaction
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Huvudkategori CRUD
  getHuvudkategorier(): Promise<Huvudkategori[]>;
  getHuvudkategori(id: string): Promise<Huvudkategori | undefined>;
  createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori>;
  updateHuvudkategori(id: string, kategori: Partial<InsertHuvudkategori>): Promise<Huvudkategori | undefined>;
  deleteHuvudkategori(id: string): Promise<boolean>;
  
  // Underkategori CRUD
  getUnderkategorier(): Promise<Underkategori[]>;
  getUnderkategorierByHuvudkategori(huvudkategoriId: string): Promise<Underkategori[]>;
  getUnderkategori(id: string): Promise<Underkategori | undefined>;
  createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori>;
  updateUnderkategori(id: string, kategori: Partial<InsertUnderkategori>): Promise<Underkategori | undefined>;
  deleteUnderkategori(id: string): Promise<boolean>;
  
  // Category Rules CRUD
  getCategoryRules(): Promise<CategoryRuleDB[]>;
  getCategoryRule(id: string): Promise<CategoryRuleDB | undefined>;
  createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRuleDB>;
  updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRuleDB | undefined>;
  deleteCategoryRule(id: string): Promise<boolean>;
  
  // Transaction CRUD
  getTransactions(): Promise<TransactionDB[]>;
  getTransaction(id: string): Promise<TransactionDB | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<TransactionDB>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<TransactionDB | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private huvudkategorier: Map<string, Huvudkategori>;
  private underkategorier: Map<string, Underkategori>;
  private categoryRules: Map<string, CategoryRuleDB>;
  private transactions: Map<string, TransactionDB>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.huvudkategorier = new Map();
    this.underkategorier = new Map();
    this.categoryRules = new Map();
    this.transactions = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Huvudkategori methods
  async getHuvudkategorier(): Promise<Huvudkategori[]> {
    return Array.from(this.huvudkategorier.values());
  }

  async getHuvudkategori(id: string): Promise<Huvudkategori | undefined> {
    return this.huvudkategorier.get(id);
  }

  async createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newKategori: Huvudkategori = {
      id,
      ...kategori,
      createdAt: now,
      updatedAt: now,
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
      updatedAt: new Date(),
    };
    this.huvudkategorier.set(id, updated);
    return updated;
  }

  async deleteHuvudkategori(id: string): Promise<boolean> {
    return this.huvudkategorier.delete(id);
  }

  // Underkategori methods
  async getUnderkategorier(): Promise<Underkategori[]> {
    return Array.from(this.underkategorier.values());
  }

  async getUnderkategorierByHuvudkategori(huvudkategoriId: string): Promise<Underkategori[]> {
    return Array.from(this.underkategorier.values()).filter(
      (sub) => sub.huvudkategoriId === huvudkategoriId
    );
  }

  async getUnderkategori(id: string): Promise<Underkategori | undefined> {
    return this.underkategorier.get(id);
  }

  async createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newKategori: Underkategori = {
      id,
      ...kategori,
      createdAt: now,
      updatedAt: now,
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
      updatedAt: new Date(),
    };
    this.underkategorier.set(id, updated);
    return updated;
  }

  async deleteUnderkategori(id: string): Promise<boolean> {
    return this.underkategorier.delete(id);
  }

  // Category Rules methods
  async getCategoryRules(): Promise<CategoryRuleDB[]> {
    return Array.from(this.categoryRules.values());
  }

  async getCategoryRule(id: string): Promise<CategoryRuleDB | undefined> {
    return this.categoryRules.get(id);
  }

  async createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRuleDB> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newRule: CategoryRuleDB = {
      id,
      priority: rule.priority || 1,
      conditionType: rule.conditionType,
      conditionValue: rule.conditionValue,
      bankCategory: rule.bankCategory || null,
      bankSubCategory: rule.bankSubCategory || null,
      huvudkategoriId: rule.huvudkategoriId,
      underkategoriId: rule.underkategoriId || null,
      positiveTransactionType: rule.positiveTransactionType || 'Transaction',
      negativeTransactionType: rule.negativeTransactionType || 'Transaction',
      applicableAccountIds: rule.applicableAccountIds || null,
      isActive: rule.isActive !== undefined ? rule.isActive : true,
      createdAt: now,
      updatedAt: now,
    };
    this.categoryRules.set(id, newRule);
    return newRule;
  }

  async updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRuleDB | undefined> {
    const existing = this.categoryRules.get(id);
    if (!existing) return undefined;
    
    const updated: CategoryRuleDB = {
      ...existing,
      ...rule,
      updatedAt: new Date(),
    };
    this.categoryRules.set(id, updated);
    return updated;
  }

  async deleteCategoryRule(id: string): Promise<boolean> {
    return this.categoryRules.delete(id);
  }

  // Transaction methods
  async getTransactions(): Promise<TransactionDB[]> {
    return Array.from(this.transactions.values());
  }

  async getTransaction(id: string): Promise<TransactionDB | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(transaction: InsertTransaction): Promise<TransactionDB> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newTransaction: TransactionDB = {
      id,
      accountId: transaction.accountId,
      date: transaction.date,
      bankCategory: transaction.bankCategory || null,
      bankSubCategory: transaction.bankSubCategory || null,
      description: transaction.description,
      userDescription: transaction.userDescription || null,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter || null,
      status: transaction.status || 'red',
      type: transaction.type || 'Transaction',
      huvudkategoriId: transaction.huvudkategoriId || null,
      underkategoriId: transaction.underkategoriId || null,
      linkedTransactionId: transaction.linkedTransactionId || null,
      correctedAmount: transaction.correctedAmount || null,
      savingsTargetId: transaction.savingsTargetId || null,
      isManuallyChanged: transaction.isManuallyChanged || false,
      importedAt: transaction.importedAt || now,
      fileSource: transaction.fileSource || null,
      createdAt: now,
      updatedAt: now,
    };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<TransactionDB | undefined> {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;
    
    const updated: TransactionDB = {
      ...existing,
      ...transaction,
      updatedAt: new Date(),
    };
    this.transactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    return this.transactions.delete(id);
  }
}

export const storage = new MemStorage();
