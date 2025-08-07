import { db } from './server/db.js';
import { budgetPosts, accounts } from './shared/schema.js';
import { eq, and, like } from 'drizzle-orm';

async function checkAccountPosts() {
  try {
    console.log('Checking budget posts by account...\n');
    
    // Get all accounts first
    const allAccounts = await db
      .select()
      .from(accounts);
    
    console.log('Available accounts:');
    allAccounts.forEach(acc => {
      console.log(`- ${acc.name} (ID: ${acc.id})`);
    });
    
    console.log('\n-------------------\n');
    
    // For each account, show budget posts
    for (const account of allAccounts) {
      const posts = await db
        .select()
        .from(budgetPosts)
        .where(and(
          eq(budgetPosts.accountId, account.id),
          eq(budgetPosts.monthKey, '2025-08')
        ));
      
      if (posts.length > 0) {
        console.log(`\nAccount: ${account.name}`);
        console.log(`Found ${posts.length} budget posts for August 2025:`);
        
        let total = 0;
        posts.forEach(post => {
          const amountInKr = post.amount / 100;
          console.log(`  - ${post.description}: ${amountInKr.toLocaleString('sv-SE')} kr (${post.amount} öre)`);
          total += post.amount;
        });
        
        console.log(`  TOTAL: ${(total / 100).toLocaleString('sv-SE')} kr (${total} öre)`);
        console.log(`  Expected calculation: ${posts.map(p => p.amount / 100).join(' + ')} = ${total / 100} kr`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking account posts:', error);
    process.exit(1);
  }
}

checkAccountPosts();