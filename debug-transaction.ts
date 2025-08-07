import { db } from './server/db.js';
import { transactions, huvudkategorier, underkategorier } from './shared/schema.js';
import { eq, and, like, gte, lte } from 'drizzle-orm';

async function debugTransaction() {
  try {
    console.log('Debugging July 3rd Stora Coop transaction...\n');
    
    // Find transactions from July 2025
    console.log('Looking for transactions in July 2025...');
    const julyTransactions = await db
      .select()
      .from(transactions)
      .where(and(
        gte(transactions.date, new Date('2025-07-01')),
        lte(transactions.date, new Date('2025-07-31'))
      ));
    
    console.log(`Found ${julyTransactions.length} transactions in July 2025`);
    
    // Look for Stora Coop transactions
    const coopTransaction = julyTransactions.filter(t => 
      t.description && t.description.toLowerCase().includes('stora coop')
    );
    
    console.log(`Found ${coopTransaction.length} Stora Coop transactions in July`);
    
    if (coopTransaction.length === 0) {
      console.log('❌ No Stora Coop transactions found in July');
      console.log('\nAll July transactions:');
      julyTransactions.slice(0, 10).forEach(t => {
        console.log(`- ${t.description} (${new Date(t.date).toISOString().split('T')[0]}) - ${t.amount / 100} kr`);
      });
      return;
    }
    
    if (coopTransaction.length === 0) {
      console.log('❌ Transaction not found in database');
      return;
    }
    
    const transaction = coopTransaction[0];
    console.log('✅ Found transaction:');
    console.log(`ID: ${transaction.id}`);
    console.log(`Description: ${transaction.description}`);
    console.log(`Date: ${transaction.date}`);
    console.log(`Amount: ${transaction.amount} (${transaction.amount / 100} kr)`);
    console.log(`Type: ${transaction.type}`);
    console.log(`Account ID: ${transaction.accountId}`);
    console.log(`App Category ID: ${transaction.appCategoryId}`);
    console.log(`App Sub Category ID: ${transaction.appSubCategoryId}`);
    console.log(`Bank Category: ${transaction.bankCategory}`);
    console.log(`Bank Sub Category: ${transaction.bankSubCategory}`);
    
    // Find the categories
    console.log('\n--- Category Information ---');
    
    if (transaction.appCategoryId) {
      const huvudkategori = await db
        .select()
        .from(huvudkategorier)
        .where(eq(huvudkategorier.id, transaction.appCategoryId));
      
      if (huvudkategori.length > 0) {
        console.log(`✅ Huvudkategori found: ${huvudkategori[0].name} (ID: ${huvudkategori[0].id})`);
      } else {
        console.log(`❌ Huvudkategori NOT found for ID: ${transaction.appCategoryId}`);
      }
    } else {
      console.log('❌ No appCategoryId set');
    }
    
    if (transaction.appSubCategoryId) {
      const underkategori = await db
        .select()
        .from(underkategorier)
        .where(eq(underkategorier.id, transaction.appSubCategoryId));
      
      if (underkategori.length > 0) {
        console.log(`✅ Underkategori found: ${underkategori[0].name} (ID: ${underkategori[0].id})`);
      } else {
        console.log(`❌ Underkategori NOT found for ID: ${transaction.appSubCategoryId}`);
      }
    } else {
      console.log('❌ No appSubCategoryId set');
    }
    
    // Check if it would be included in July budget (June 25 - July 24)
    console.log('\n--- Payday Rule Check ---');
    const transactionDate = new Date(transaction.date);
    const july2025Start = new Date('2025-06-25'); // June 25
    const july2025End = new Date('2025-07-24'); // July 24
    
    console.log(`Transaction date: ${transactionDate.toISOString().split('T')[0]}`);
    console.log(`July budget range: ${july2025Start.toISOString().split('T')[0]} to ${july2025End.toISOString().split('T')[0]}`);
    console.log(`Should be included in July budget: ${transactionDate >= july2025Start && transactionDate <= july2025End}`);
    
    // Check criteria for inclusion in calculation
    console.log('\n--- Inclusion Criteria Check ---');
    console.log(`Type === 'Transaction': ${transaction.type === 'Transaction'}`);
    console.log(`Amount < 0 (negative): ${transaction.amount < 0}`);
    console.log(`Has App Category ID: ${!!transaction.appCategoryId}`);
    console.log(`Has App Sub Category ID: ${!!transaction.appSubCategoryId}`);
    
    const shouldBeIncluded = 
      transaction.type === 'Transaction' && 
      transaction.amount < 0 && 
      (transaction.appCategoryId || transaction.appSubCategoryId);
      
    console.log(`✅ Should be included in category calculations: ${shouldBeIncluded}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error debugging transaction:', error);
    process.exit(1);
  }
}

debugTransaction();