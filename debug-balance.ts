import { db } from './server/db';
import { budgetPosts } from './shared/schema';
import { eq } from 'drizzle-orm';

async function testBalance() {
  try {
    console.log('Testing balance operations...');
    
    // Create test balance post
    const [created] = await db.insert(budgetPosts).values({
      userId: 'dev-user-123',
      monthKey: '2025-08',
      type: 'Balance',
      description: 'Debug test',
      amount: 0,
      accountUserBalance: 99900, // 999 kr
      accountBalance: 55500,     // 555 kr
    }).returning();
    
    console.log('Created record:');
    console.log('- id:', created.id);
    console.log('- type:', created.type);
    console.log('- accountUserBalance:', created.accountUserBalance);
    console.log('- accountBalance:', created.accountBalance);
    
    // Update it
    const [updated] = await db.update(budgetPosts)
      .set({ 
        accountUserBalance: 123400 // 1234 kr
      })
      .where(eq(budgetPosts.id, created.id))
      .returning();
    
    console.log('\nUpdated record:');
    console.log('- id:', updated.id);
    console.log('- accountUserBalance:', updated.accountUserBalance);
    console.log('- accountBalance:', updated.accountBalance);
    
    // Clean up
    await db.delete(budgetPosts).where(eq(budgetPosts.id, created.id));
    console.log('\nTest complete - cleaned up');
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

testBalance();