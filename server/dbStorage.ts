import { db } from "./db";
import { eq, and, gte, lte, like, sql, or } from "drizzle-orm";
import {
  users,
  familyMembers,
  accountTypes,
  accounts,
  huvudkategorier,
  underkategorier,
  categoryRules,
  transactions,
  monthlyBudgets,
  monthlyAccountBalances,
  budgetPosts,
  banks,
  bankCsvMappings,
  plannedTransfers,
  inkomstkallor,
  inkomstkallorMedlem,
  userSettings,
  type User,
  type InsertUser,
  type FamilyMember,
  type InsertFamilyMember,
  type AccountType,
  type InsertAccountType,
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
  type MonthlyBudget,
  type InsertMonthlyBudget,
  type MonthlyAccountBalance,
  type InsertMonthlyAccountBalance,
  type PlannedTransfer,
  type InsertPlannedTransfer,
  type Inkomstkall,
  type InsertInkomstkall,
  type InkomstkallorMedlem,
  type InsertInkomstkallorMedlem,
  type UserSetting,
  type InsertUserSetting
} from "@shared/schema";

// Add the missing types that aren't auto-generated yet
type Bank = typeof banks.$inferSelect;
type InsertBank = typeof banks.$inferInsert;
type BankCsvMapping = typeof bankCsvMappings.$inferSelect;
type InsertBankCsvMapping = typeof bankCsvMappings.$inferInsert;
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Bootstrap method
  async bootstrap(userId: string): Promise<{
    accountTypes: AccountType[];
    accounts: Account[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    budgetPosts: any[];
    monthlyBudgets: MonthlyBudget[];
    banks: Bank[];
    bankCsvMappings: BankCsvMapping[];
  }> {
    // Only load recent transactions for bootstrap - last month for optimal performance
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const [accountTypesResult, accountsResult, huvudkategorierResult, underkategorierResult, categoryRulesResult, recentTransactionsResult, monthlyBudgetsResult, banksResult, bankCsvMappingsResult] = await Promise.all([
      this.getAccountTypes(userId),
      this.getAccounts(userId),
      this.getHuvudkategorier(userId),
      this.getUnderkategorier(userId),
      this.getCategoryRules(userId),
      this.getRecentTransactions(userId, oneMonthAgo),
      this.getMonthlyBudgets(userId),
      this.getBanks(userId),
      this.getBankCsvMappings(userId)
    ]);

    return {
      accountTypes: accountTypesResult,
      accounts: accountsResult,
      huvudkategorier: huvudkategorierResult,
      underkategorier: underkategorierResult,
      categoryRules: categoryRulesResult,
      transactions: recentTransactionsResult,
      budgetPosts: [], // Not implemented yet
      monthlyBudgets: monthlyBudgetsResult,
      banks: banksResult,
      bankCsvMappings: bankCsvMappingsResult,
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

  // Family member methods
  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    return await db.select().from(familyMembers).where(eq(familyMembers.userId, userId));
  }

  async getFamilyMember(id: string): Promise<FamilyMember | undefined> {
    const result = await db.select().from(familyMembers).where(eq(familyMembers.id, id));
    return result[0];
  }

  async createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const result = await db.insert(familyMembers).values(member).returning();
    return result[0];
  }

  async updateFamilyMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined> {
    const result = await db.update(familyMembers)
      .set(member)
      .where(eq(familyMembers.id, id))
      .returning();
    return result[0];
  }

  async deleteFamilyMember(id: string): Promise<boolean> {
    const result = await db.delete(familyMembers).where(eq(familyMembers.id, id)).returning();
    return result.length > 0;
  }

  // Income sources (Inkomstkällor) methods
  async getInkomstkallor(userId: string): Promise<Inkomstkall[]> {
    return await db.select().from(inkomstkallor).where(eq(inkomstkallor.userId, userId));
  }

  async getInkomstkall(id: string): Promise<Inkomstkall | undefined> {
    const result = await db.select().from(inkomstkallor).where(eq(inkomstkallor.id, id));
    return result[0];
  }

  async createInkomstkall(inkomstkall: InsertInkomstkall): Promise<Inkomstkall> {
    const result = await db.insert(inkomstkallor).values(inkomstkall).returning();
    return result[0];
  }

  async updateInkomstkall(id: string, inkomstkall: Partial<InsertInkomstkall>): Promise<Inkomstkall | undefined> {
    const result = await db.update(inkomstkallor)
      .set(inkomstkall)
      .where(eq(inkomstkallor.id, id))
      .returning();
    return result[0];
  }

  async deleteInkomstkall(id: string): Promise<boolean> {
    const result = await db.delete(inkomstkallor).where(eq(inkomstkallor.id, id)).returning();
    return result.length > 0;
  }

  // Income source member assignments methods
  async getInkomstkallorMedlem(userId: string): Promise<InkomstkallorMedlem[]> {
    return await db.select().from(inkomstkallorMedlem).where(eq(inkomstkallorMedlem.userId, userId));
  }

  async createInkomstkallorMedlem(assignment: InsertInkomstkallorMedlem): Promise<InkomstkallorMedlem> {
    const result = await db.insert(inkomstkallorMedlem).values(assignment).returning();
    return result[0];
  }

  async updateInkomstkallorMedlem(id: string, assignment: Partial<InsertInkomstkallorMedlem>): Promise<InkomstkallorMedlem | undefined> {
    const result = await db.update(inkomstkallorMedlem)
      .set(assignment)
      .where(eq(inkomstkallorMedlem.id, id))
      .returning();
    return result[0];
  }

  async deleteInkomstkallorMedlem(id: string): Promise<boolean> {
    const result = await db.delete(inkomstkallorMedlem).where(eq(inkomstkallorMedlem.id, id)).returning();
    return result.length > 0;
  }

  async deleteInkomstkallorMedlemByMemberAndSource(userId: string, familjemedlemId: string, idInkomstkalla: string): Promise<boolean> {
    const result = await db.delete(inkomstkallorMedlem)
      .where(and(
        eq(inkomstkallorMedlem.userId, userId),
        eq(inkomstkallorMedlem.familjemedlemId, familjemedlemId),
        eq(inkomstkallorMedlem.idInkomstkalla, idInkomstkalla)
      ))
      .returning();
    return result.length > 0;
  }

  // Account Types methods
  async getAccountTypes(userId: string): Promise<AccountType[]> {
    return await db.select().from(accountTypes).where(eq(accountTypes.userId, userId));
  }

  async getAccountType(id: string): Promise<AccountType | undefined> {
    const result = await db.select().from(accountTypes).where(eq(accountTypes.id, id));
    return result[0];
  }

  async createAccountType(accountType: InsertAccountType): Promise<AccountType> {
    const result = await db.insert(accountTypes).values(accountType).returning();
    return result[0];
  }

  async updateAccountType(id: string, accountType: Partial<InsertAccountType>): Promise<AccountType | undefined> {
    const result = await db.update(accountTypes)
      .set({
        ...accountType,
        updatedAt: new Date()
      })
      .where(eq(accountTypes.id, id))
      .returning();
    return result[0];
  }

  async deleteAccountType(id: string): Promise<boolean> {
    const result = await db.delete(accountTypes).where(eq(accountTypes.id, id)).returning();
    return result.length > 0;
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    console.log('Getting accounts for userId:', userId);
    const result = await db.select().from(accounts).where(eq(accounts.userId, userId));
    console.log('Found accounts:', result);
    return result;
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

  async getRecentTransactions(userId: string, fromDate: Date): Promise<Transaction[]> {
    console.log(`📊 [DB] Loading transactions from ${fromDate.toISOString()}`);
    const result = await db.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, fromDate)
        )
      )
      .orderBy(transactions.date);
    console.log(`📊 [DB] Loaded ${result.length} recent transactions`);
    return result;
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

  // NEW: Get transactions within a date range for synchronization
  async getTransactionsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    console.log(`Getting transactions for userId: ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const result = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );
    console.log(`Found ${result.length} transactions in date range`);
    return result;
  }

  async getTransactionsInDateRangeByAccount(userId: string, accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    console.log(`Getting transactions for userId: ${userId}, accountId: ${accountId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const result = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.accountId, accountId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );
    console.log(`Found ${result.length} transactions for account in date range`);
    return result;
  }

  // Monthly Budget methods
  async getMonthlyBudgets(userId: string): Promise<MonthlyBudget[]> {
    return await db.select().from(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));
  }

  async getMonthlyBudget(userId: string, monthKey: string): Promise<MonthlyBudget | undefined> {
    const result = await db.select().from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)));
    return result[0];
  }

  async createMonthlyBudget(budget: InsertMonthlyBudget): Promise<MonthlyBudget> {
    const result = await db.insert(monthlyBudgets).values(budget).returning();
    return result[0];
  }

  async updateMonthlyBudget(userId: string, monthKey: string, budget: Partial<InsertMonthlyBudget>): Promise<MonthlyBudget | undefined> {
    const result = await db.update(monthlyBudgets)
      .set({
        ...budget,
        updatedAt: new Date()
      })
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)))
      .returning();
    return result[0];
  }

  async deleteMonthlyBudget(userId: string, monthKey: string): Promise<boolean> {
    const result = await db.delete(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)))
      .returning();
    return result.length > 0;
  }

  // Bank methods
  async getBanks(userId: string): Promise<Bank[]> {
    return await db.select().from(banks).where(eq(banks.userId, userId));
  }

  async getBank(id: string): Promise<Bank | undefined> {
    const result = await db.select().from(banks).where(eq(banks.id, id));
    return result[0];
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const result = await db.insert(banks).values(insertBank).returning();
    return result[0];
  }

  async updateBank(id: string, updateBank: Partial<InsertBank>): Promise<Bank | undefined> {
    const result = await db.update(banks)
      .set(updateBank)
      .where(eq(banks.id, id))
      .returning();
    return result[0];
  }

  async deleteBank(id: string): Promise<boolean> {
    const result = await db.delete(banks).where(eq(banks.id, id)).returning();
    return result.length > 0;
  }

  // Bank CSV Mapping methods
  async getBankCsvMappings(userId: string): Promise<BankCsvMapping[]> {
    return await db.select().from(bankCsvMappings).where(eq(bankCsvMappings.userId, userId));
  }

  async getBankCsvMappingsByBank(userId: string, bankId: string): Promise<BankCsvMapping[]> {
    return await db.select().from(bankCsvMappings)
      .where(and(eq(bankCsvMappings.userId, userId), eq(bankCsvMappings.bankId, bankId)));
  }

  async getBankCsvMapping(id: string): Promise<BankCsvMapping | undefined> {
    const result = await db.select().from(bankCsvMappings).where(eq(bankCsvMappings.id, id));
    return result[0];
  }

  async createBankCsvMapping(insertMapping: InsertBankCsvMapping): Promise<BankCsvMapping> {
    const result = await db.insert(bankCsvMappings).values(insertMapping).returning();
    return result[0];
  }

  async updateBankCsvMapping(id: string, updateMapping: Partial<InsertBankCsvMapping>): Promise<BankCsvMapping | undefined> {
    const result = await db.update(bankCsvMappings)
      .set(updateMapping)
      .where(eq(bankCsvMappings.id, id))
      .returning();
    return result[0];
  }

  async deleteBankCsvMapping(id: string): Promise<boolean> {
    const result = await db.delete(bankCsvMappings).where(eq(bankCsvMappings.id, id)).returning();
    return result.length > 0;
  }

  // Budget Post methods
  async getBudgetPosts(userId: string, monthKey?: string): Promise<any[]> {
    console.log('Getting budget posts for userId:', userId, 'monthKey:', monthKey);
    
    try {
      let query = db
        .select()
        .from(budgetPosts)
        .where(eq(budgetPosts.userId, userId));
      
      if (monthKey) {
        query = query.where(eq(budgetPosts.monthKey, monthKey));
      }
      
      const results = await query;
      console.log('Found budget posts:', results.length);
      return results;
    } catch (error) {
      console.error('Error getting budget posts:', error);
      throw error;
    }
  }

  async getBudgetPost(userId: string, id: string): Promise<any> {
    console.log('Getting budget post for userId:', userId, 'id:', id);
    
    try {
      const result = await db
        .select()
        .from(budgetPosts)
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .limit(1);
      
      console.log('Found budget post:', result.length > 0 ? result[0] : 'not found');
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error('Error getting budget post:', error);
      throw error;
    }
  }

  async createBudgetPost(data: any): Promise<any> {
    console.log('Creating budget post with data:', JSON.stringify(data, null, 2));
    console.log('budgetType field value:', data.budgetType);
    
    try {
      const result = await db
        .insert(budgetPosts)
        .values(data)
        .returning();
      
      console.log('Created budget post result:', JSON.stringify(result[0], null, 2));
      console.log('Result budgetType field:', result[0].budgetType);
      return result[0];
    } catch (error) {
      console.error('Error creating budget post:', error);
      throw error;
    }
  }

  async updateBudgetPost(userId: string, id: string, data: any): Promise<any> {
    console.log('Updating budget post for userId:', userId, 'id:', id, 'data:', data);
    
    try {
      const result = await db
        .update(budgetPosts)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .returning();
      
      console.log('Updated budget post:', result.length > 0 ? result[0] : 'not found');
      if (result.length > 0) {
        console.log('Updated budget post accountUserBalance:', result[0].accountUserBalance);
        console.log('Updated budget post accountBalance:', result[0].accountBalance);
      }
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error('Error updating budget post:', error);
      throw error;
    }
  }

  async deleteBudgetPost(userId: string, id: string): Promise<boolean> {
    console.log('Deleting budget post for userId:', userId, 'id:', id);
    
    try {
      const result = await db
        .delete(budgetPosts)
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .returning();
      
      console.log('Deleted budget post:', result.length > 0);
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting budget post:', error);
      throw error;
    }
  }

  // Monthly Account Balances - stores calculated balances per month
  async getMonthlyAccountBalances(userId: string, monthKey?: string): Promise<MonthlyAccountBalance[]> {
    if (monthKey) {
      return await db.select()
        .from(monthlyAccountBalances)
        .where(
          and(
            eq(monthlyAccountBalances.userId, userId),
            eq(monthlyAccountBalances.monthKey, monthKey)
          )
        );
    } else {
      return await db.select()
        .from(monthlyAccountBalances)
        .where(eq(monthlyAccountBalances.userId, userId));
    }
  }

  async getMonthlyAccountBalance(userId: string, monthKey: string, accountId: string): Promise<MonthlyAccountBalance | undefined> {
    const result = await db.select()
      .from(monthlyAccountBalances)
      .where(
        and(
          eq(monthlyAccountBalances.userId, userId),
          eq(monthlyAccountBalances.monthKey, monthKey),
          eq(monthlyAccountBalances.accountId, accountId)
        )
      );
    return result[0];
  }

  async saveMonthlyAccountBalance(balance: InsertMonthlyAccountBalance): Promise<MonthlyAccountBalance> {
    // Use upsert logic - update if exists, insert if not
    const existing = await this.getMonthlyAccountBalance(balance.userId, balance.monthKey, balance.accountId);
    
    if (existing) {
      const result = await db.update(monthlyAccountBalances)
        .set({ 
          calculatedBalance: balance.calculatedBalance,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(monthlyAccountBalances).values(balance).returning();
      return result[0];
    }
  }

  async upsertMonthlyAccountBalance(balance: InsertMonthlyAccountBalance): Promise<{ balance: MonthlyAccountBalance, created: boolean }> {
    // Use upsert logic - update if exists, insert if not
    const existing = await this.getMonthlyAccountBalance(balance.userId, balance.monthKey, balance.accountId);
    
    if (existing) {
      const result = await db.update(monthlyAccountBalances)
        .set({ 
          calculatedBalance: balance.calculatedBalance,
          faktisktKontosaldo: balance.faktisktKontosaldo,
          bankensKontosaldo: balance.bankensKontosaldo,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return { balance: result[0], created: false };
    } else {
      const result = await db.insert(monthlyAccountBalances).values(balance).returning();
      return { balance: result[0], created: true };
    }
  }

  // Planned Transfers methods
  async getPlannedTransfers(userId: string, month?: string): Promise<PlannedTransfer[]> {
    if (month) {
      return await db.select()
        .from(plannedTransfers)
        .where(
          and(
            eq(plannedTransfers.userId, userId),
            eq(plannedTransfers.month, month)
          )
        );
    } else {
      return await db.select()
        .from(plannedTransfers)
        .where(eq(plannedTransfers.userId, userId));
    }
  }

  async createPlannedTransfer(transfer: InsertPlannedTransfer): Promise<PlannedTransfer> {
    const result = await db.insert(plannedTransfers).values(transfer).returning();
    return result[0];
  }

  async updatePlannedTransfer(id: string, transfer: Partial<InsertPlannedTransfer>): Promise<PlannedTransfer | undefined> {
    const result = await db.update(plannedTransfers)
      .set(transfer)
      .where(eq(plannedTransfers.id, id))
      .returning();
    return result[0];
  }

  async deletePlannedTransfer(id: string): Promise<void> {
    await db.delete(plannedTransfers).where(eq(plannedTransfers.id, id));
  }

  async updateFaktisktKontosaldo(userId: string, monthKey: string, accountId: string, faktisktKontosaldo: number | null): Promise<MonthlyAccountBalance | undefined> {
    console.log(`🔍 updateFaktisktKontosaldo called: userId=${userId}, monthKey=${monthKey}, accountId=${accountId}, value=${faktisktKontosaldo}`);
    const existing = await this.getMonthlyAccountBalance(userId, monthKey, accountId);
    
    console.log(`🔍 Existing record:`, existing ? { id: existing.id, currentFaktiskt: existing.faktisktKontosaldo } : 'NOT FOUND');
    
    if (existing) {
      console.log(`🔍 Updating existing record ${existing.id} with faktisktKontosaldo: ${faktisktKontosaldo}`);
      const result = await db.update(monthlyAccountBalances)
        .set({ 
          faktisktKontosaldo: faktisktKontosaldo,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      console.log(`✅ Update successful, new value:`, result[0]?.faktisktKontosaldo);
      return result[0];
    } else {
      console.log(`❌ No existing monthly balance record found for accountId=${accountId}, monthKey=${monthKey}. Creating one...`);
      // Create a new record if none exists
      const newRecord = {
        userId,
        monthKey,
        accountId,
        calculatedBalance: 0, // Default value
        faktisktKontosaldo: faktisktKontosaldo,
        bankensKontosaldo: null
      };
      console.log(`🔍 Creating new record:`, newRecord);
      const result = await db.insert(monthlyAccountBalances).values(newRecord).returning();
      console.log(`✅ Created new record:`, result[0]);
      return result[0];
    }
  }

  async updateBankensKontosaldo(userId: string, monthKey: string, accountId: string, bankensKontosaldo: number | null): Promise<MonthlyAccountBalance | undefined> {
    const existing = await this.getMonthlyAccountBalance(userId, monthKey, accountId);
    
    if (existing) {
      const result = await db.update(monthlyAccountBalances)
        .set({ 
          bankensKontosaldo: bankensKontosaldo,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return result[0];
    }
    
    return undefined;
  }

  async deleteMonthlyAccountBalance(userId: string, monthKey: string, accountId: string): Promise<boolean> {
    const result = await db.delete(monthlyAccountBalances)
      .where(
        and(
          eq(monthlyAccountBalances.userId, userId),
          eq(monthlyAccountBalances.monthKey, monthKey),
          eq(monthlyAccountBalances.accountId, accountId)
        )
      )
      .returning();
    return result.length > 0;
  }

  // User settings methods
  async getUserSettings(userId: string): Promise<UserSetting[]> {
    return await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  }

  async getUserSetting(userId: string, settingKey: string): Promise<UserSetting | undefined> {
    const result = await db.select().from(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.settingKey, settingKey)
      ));
    return result[0];
  }

  async createUserSetting(setting: InsertUserSetting): Promise<UserSetting> {
    const result = await db.insert(userSettings).values({
      ...setting,
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async updateUserSetting(userId: string, settingKey: string, settingValue: string): Promise<UserSetting | undefined> {
    const result = await db.update(userSettings)
      .set({
        settingValue,
        updatedAt: new Date()
      })
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.settingKey, settingKey)
      ))
      .returning();
    return result[0];
  }

  async upsertUserSetting(userId: string, settingKey: string, settingValue: string): Promise<UserSetting> {
    const existing = await this.getUserSetting(userId, settingKey);
    
    if (existing) {
      return await this.updateUserSetting(userId, settingKey, settingValue) as UserSetting;
    } else {
      return await this.createUserSetting({
        userId,
        settingKey,
        settingValue
      });
    }
  }

  async deleteUserSetting(userId: string, settingKey: string): Promise<boolean> {
    const result = await db.delete(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.settingKey, settingKey)
      ))
      .returning();
    return result.length > 0;
  }
}