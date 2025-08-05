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
  banks,
  bankCsvMappings,
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

// Add the missing types that aren't auto-generated yet
type Bank = typeof banks.$inferSelect;
type InsertBank = typeof banks.$inferInsert;
type BankCsvMapping = typeof bankCsvMappings.$inferSelect;
type InsertBankCsvMapping = typeof bankCsvMappings.$inferInsert;

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
  getTransactionsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]>;
  
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

  // Bank CRUD
  getBanks(userId: string): Promise<Bank[]>;
  getBank(id: string): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: string, bank: Partial<InsertBank>): Promise<Bank | undefined>;
  deleteBank(id: string): Promise<boolean>;

  // Bank CSV Mapping CRUD
  getBankCsvMappings(userId: string): Promise<BankCsvMapping[]>;
  getBankCsvMappingsByBank(userId: string, bankId: string): Promise<BankCsvMapping[]>;
  getBankCsvMapping(id: string): Promise<BankCsvMapping | undefined>;
  createBankCsvMapping(mapping: InsertBankCsvMapping): Promise<BankCsvMapping>;
  updateBankCsvMapping(id: string, mapping: Partial<InsertBankCsvMapping>): Promise<BankCsvMapping | undefined>;
  deleteBankCsvMapping(id: string): Promise<boolean>;
  
  // Monthly Account Balance methods
  getMonthlyAccountBalances(userId: string): Promise<any[]>;
  saveMonthlyAccountBalance(balance: any): Promise<any>;
  upsertMonthlyAccountBalance(balance: any): Promise<any>;
  updateFaktisktKontosaldo(userId: string, monthKey: string, accountId: string, faktisktKontosaldo: number): Promise<any>;
  updateBankensKontosaldo(userId: string, monthKey: string, accountId: string, bankensKontosaldo: number): Promise<any>;

  // Bootstrap method to get all data at once
  bootstrap(userId: string): Promise<{
    accounts: Account[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    budgetPosts: BudgetPost[];
    monthlyBudgets: MonthlyBudget[];
    banks: Bank[];
    bankCsvMappings: BankCsvMapping[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private familyMembers: Map<string, FamilyMember>;
  private accounts: Map<string, Account>;
  private huvudkategorier: Map<string, Huvudkategori>;
  private underkategorier: Map<string, Underkategori>;
  private categoryRules: Map<string, CategoryRule>;
  private transactions: Map<string, Transaction>;
  private budgetPosts: Map<string, BudgetPost>;
  private monthlyBudgets: Map<string, MonthlyBudget>;
  private banks: Map<string, Bank>;
  private bankCsvMappings: Map<string, BankCsvMapping>;

  private monthlyAccountBalances: Map<string, any>;

  constructor() {
    this.users = new Map();
    this.familyMembers = new Map();
    this.accounts = new Map();
    this.huvudkategorier = new Map();
    this.underkategorier = new Map();
    this.categoryRules = new Map();
    this.transactions = new Map();
    this.budgetPosts = new Map();
    this.monthlyBudgets = new Map();
    this.banks = new Map();
    this.bankCsvMappings = new Map();
    this.monthlyAccountBalances = new Map();
  }

  // Bootstrap method
  async bootstrap(userId: string): Promise<{
    accounts: Account[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    budgetPosts: BudgetPost[];
    monthlyBudgets: MonthlyBudget[];
    banks: Bank[];
    bankCsvMappings: BankCsvMapping[];
  }> {
    return {
      accounts: await this.getAccounts(userId),
      huvudkategorier: await this.getHuvudkategorier(userId),
      underkategorier: await this.getUnderkategorier(userId),
      categoryRules: await this.getCategoryRules(userId),
      transactions: await this.getTransactions(userId),
      budgetPosts: await this.getBudgetPosts(),
      monthlyBudgets: await this.getMonthlyBudgets(userId),
      banks: await this.getBanks(userId),
      bankCsvMappings: await this.getBankCsvMappings(userId),
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

  // Family Member methods
  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    return Array.from(this.familyMembers.values()).filter(member => member.userId === userId);
  }

  async getFamilyMember(id: string): Promise<FamilyMember | undefined> {
    return this.familyMembers.get(id);
  }

  async createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const id = crypto.randomUUID();
    const newMember: FamilyMember = {
      id,
      ...member,
      createdAt: new Date(),
    };
    this.familyMembers.set(id, newMember);
    return newMember;
  }

  async updateFamilyMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined> {
    const existing = this.familyMembers.get(id);
    if (!existing) return undefined;
    
    const updated: FamilyMember = {
      ...existing,
      ...member,
    };
    this.familyMembers.set(id, updated);
    return updated;
  }

  async deleteFamilyMember(id: string): Promise<boolean> {
    return this.familyMembers.delete(id);
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
      balance: account.balance ?? 0,
      assignedTo: account.assignedTo ?? 'gemensamt',
      bankTemplateId: account.bankTemplateId ?? null,
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
      description: kategori.description ?? null,
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
      description: kategori.description ?? null,
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
      isActive: rule.isActive ?? 'true',
      huvudkategoriId: rule.huvudkategoriId ?? null,
      bankCategory: rule.bankCategory ?? null,
      bankSubCategory: rule.bankSubCategory ?? null,
      underkategoriId: rule.underkategoriId ?? null,
      positiveTransactionType: rule.positiveTransactionType ?? 'Transaction',
      negativeTransactionType: rule.negativeTransactionType ?? 'Transaction',
      applicableAccountIds: rule.applicableAccountIds ?? '[]',
      priority: rule.priority ?? 100,
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
      type: transaction.type ?? 'Transaction',
      status: transaction.status ?? 'yellow',
      balanceAfter: transaction.balanceAfter ?? 0,
      userDescription: transaction.userDescription ?? '',
      bankCategory: transaction.bankCategory ?? '',
      bankSubCategory: transaction.bankSubCategory ?? '',
      isManuallyChanged: transaction.isManuallyChanged ?? 'false',
      huvudkategoriId: transaction.huvudkategoriId ?? null,
      underkategoriId: transaction.underkategoriId ?? null,
      linkedTransactionId: transaction.linkedTransactionId ?? null,
      correctedAmount: transaction.correctedAmount ?? null,
      appCategoryId: transaction.appCategoryId ?? null,
      appSubCategoryId: transaction.appSubCategoryId ?? null,
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

  async getTransactionsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(trans => 
      trans.userId === userId &&
      trans.date >= startDate &&
      trans.date <= endDate
    );
  }

  // Bank methods - stub implementations for development
  async getBanks(userId: string): Promise<any[]> {
    return Array.from(this.banks.values()).filter((bank: any) => bank.userId === userId);
  }

  async getBank(id: string): Promise<any> {
    return this.banks.get(id);
  }

  async createBank(insertBank: any): Promise<any> {
    const bank = { id: `bank-${Date.now()}`, ...insertBank, createdAt: new Date().toISOString() };
    this.banks.set(bank.id, bank);
    return bank;
  }

  async updateBank(id: string, updateBank: any): Promise<any> {
    const bank = this.banks.get(id);
    if (bank) {
      const updated = { ...bank, ...updateBank };
      this.banks.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async deleteBank(id: string): Promise<boolean> {
    return this.banks.delete(id);
  }

  // Bank CSV Mapping methods - stub implementations
  async getBankCsvMappings(userId: string): Promise<any[]> {
    return Array.from(this.bankCsvMappings.values()).filter((mapping: any) => mapping.userId === userId);
  }

  async getBankCsvMappingsByBank(userId: string, bankId: string): Promise<any[]> {
    return Array.from(this.bankCsvMappings.values()).filter((mapping: any) => 
      mapping.userId === userId && mapping.bankId === bankId);
  }

  async getBankCsvMapping(id: string): Promise<any> {
    return this.bankCsvMappings.get(id);
  }

  async createBankCsvMapping(insertMapping: any): Promise<any> {
    const mapping = { 
      id: `mapping-${Date.now()}`, 
      ...insertMapping, 
      isActive: 'true',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.bankCsvMappings.set(mapping.id, mapping);
    return mapping;
  }

  async updateBankCsvMapping(id: string, updateMapping: any): Promise<any> {
    const mapping = this.bankCsvMappings.get(id);
    if (mapping) {
      const updated = { ...mapping, ...updateMapping, updatedAt: new Date().toISOString() };
      this.bankCsvMappings.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async deleteBankCsvMapping(id: string): Promise<boolean> {
    return this.bankCsvMappings.delete(id);
  }

  // Monthly Budget methods
  async getMonthlyBudgets(userId: string): Promise<MonthlyBudget[]> {
    return Array.from(this.monthlyBudgets.values()).filter(budget => budget.userId === userId);
  }

  async getMonthlyBudget(userId: string, monthKey: string): Promise<MonthlyBudget | undefined> {
    return Array.from(this.monthlyBudgets.values()).find(
      budget => budget.userId === userId && budget.monthKey === monthKey
    );
  }

  async createMonthlyBudget(budget: InsertMonthlyBudget): Promise<MonthlyBudget> {
    const id = crypto.randomUUID();
    const newBudget: MonthlyBudget = {
      id,
      ...budget,
      createdAt: new Date(),
      updatedAt: new Date(),
      primaryUserId: budget.primaryUserId ?? null,
      secondaryUserId: budget.secondaryUserId ?? null,
      primaryUserSalary: budget.primaryUserSalary ?? 0,
      primaryUserförsäkringskassan: budget.primaryUserförsäkringskassan ?? 0,
      primaryUserbarnbidrag: budget.primaryUserbarnbidrag ?? 0,
      secondaryUserSalary: budget.secondaryUserSalary ?? 0,
      secondaryUserförsäkringskassan: budget.secondaryUserförsäkringskassan ?? 0,
      secondaryUserbarnbidrag: budget.secondaryUserbarnbidrag ?? 0,
      dailyTransfer: budget.dailyTransfer ?? 300,
      weekendTransfer: budget.weekendTransfer ?? 540,
      primaryUserPersonalCosts: budget.primaryUserPersonalCosts ?? 0,
      primaryUserPersonalSavings: budget.primaryUserPersonalSavings ?? 0,
      secondaryUserPersonalCosts: budget.secondaryUserPersonalCosts ?? 0,
      secondaryUserPersonalSavings: budget.secondaryUserPersonalSavings ?? 0,
      andreasSalary: budget.andreasSalary ?? 0,
      andreasförsäkringskassan: budget.andreasförsäkringskassan ?? 0,
      andreasbarnbidrag: budget.andreasbarnbidrag ?? 0,
      susannaSalary: budget.susannaSalary ?? 0,
      susannaförsäkringskassan: budget.susannaförsäkringskassan ?? 0,
      susannabarnbidrag: budget.susannabarnbidrag ?? 0,
      andreasPersonalCosts: budget.andreasPersonalCosts ?? 0,
      andreasPersonalSavings: budget.andreasPersonalSavings ?? 0,
      susannaPersonalCosts: budget.susannaPersonalCosts ?? 0,
      susannaPersonalSavings: budget.susannaPersonalSavings ?? 0,
      userName1: budget.userName1 ?? 'Andreas',
      userName2: budget.userName2 ?? 'Susanna',
    };
    this.monthlyBudgets.set(id, newBudget);
    return newBudget;
  }

  async updateMonthlyBudget(userId: string, monthKey: string, budget: Partial<InsertMonthlyBudget>): Promise<MonthlyBudget | undefined> {
    const existing = Array.from(this.monthlyBudgets.values()).find(
      b => b.userId === userId && b.monthKey === monthKey
    );
    if (!existing) return undefined;
    
    const updated: MonthlyBudget = {
      ...existing,
      ...budget,
    };
    this.monthlyBudgets.set(existing.id, updated);
    return updated;
  }

  async deleteMonthlyBudget(userId: string, monthKey: string): Promise<boolean> {
    const existing = Array.from(this.monthlyBudgets.values()).find(
      b => b.userId === userId && b.monthKey === monthKey
    );
    if (!existing) return false;
    return this.monthlyBudgets.delete(existing.id);
  }

  // Monthly Account Balance methods
  async getMonthlyAccountBalances(userId: string): Promise<any[]> {
    return Array.from(this.monthlyAccountBalances.values()).filter(balance => balance.userId === userId);
  }

  async saveMonthlyAccountBalance(balance: any): Promise<any> {
    const id = crypto.randomUUID();
    const newBalance = {
      id,
      ...balance,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.monthlyAccountBalances.set(id, newBalance);
    return newBalance;
  }

  async upsertMonthlyAccountBalance(balance: any): Promise<any> {
    // Find existing balance by userId, monthKey, and accountId
    const existing = Array.from(this.monthlyAccountBalances.values()).find(
      b => b.userId === balance.userId && 
           b.monthKey === balance.monthKey && 
           b.accountId === balance.accountId
    );

    if (existing) {
      // Update existing
      const updated = {
        ...existing,
        ...balance,
        updatedAt: new Date(),
      };
      this.monthlyAccountBalances.set(existing.id, updated);
      return { balance: updated };
    } else {
      // Create new
      const created = await this.saveMonthlyAccountBalance(balance);
      return { balance: created };
    }
  }

  async updateFaktisktKontosaldo(userId: string, monthKey: string, accountId: string, faktisktKontosaldo: number): Promise<any> {
    const existing = Array.from(this.monthlyAccountBalances.values()).find(
      balance => balance.userId === userId && balance.monthKey === monthKey && balance.accountId === accountId
    );
    if (!existing) return undefined;
    
    const updated = {
      ...existing,
      faktisktKontosaldo,
      updatedAt: new Date(),
    };
    this.monthlyAccountBalances.set(existing.id, updated);
    return updated;
  }

  async updateBankensKontosaldo(userId: string, monthKey: string, accountId: string, bankensKontosaldo: number): Promise<any> {
    const existing = Array.from(this.monthlyAccountBalances.values()).find(
      balance => balance.userId === userId && balance.monthKey === monthKey && balance.accountId === accountId
    );
    if (!existing) return undefined;
    
    const updated = {
      ...existing,
      bankensKontosaldo,
      updatedAt: new Date(),
    };
    this.monthlyAccountBalances.set(existing.id, updated);
    return updated;
  }

  // Stub methods for BudgetPost - not implemented yet
  async getBudgetPosts(): Promise<any[]> {
    return [];
  }

  async getBudgetPost(): Promise<any> {
    return undefined;
  }

  async createBudgetPost(): Promise<any> {
    throw new Error("Not implemented");
  }

  async updateBudgetPost(): Promise<any> {
    return undefined;
  }

  async deleteBudgetPost(): Promise<boolean> {
    return false;
  }
}

// Import the database storage
import { DatabaseStorage } from "./dbStorage";

// Use database storage when DATABASE_URL is available
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
