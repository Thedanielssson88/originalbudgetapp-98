import { db } from './server/db';
import { budgetPosts } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function testUpdate() {
  try {
    // First, create a test budget post with Balance type
    console.log('Creating test budget post...');
    const [created] = await db
      .insert(budgetPosts)
      .values({
        userId: 'dev-user-123',
        monthKey: '2025-01',
        type: 'Balance',
        description: 'Test Balance',
        amount: 0,
        accountUserBalance: 10000, // 100 kr in öre
        accountBalance: null,
      })
      .returning();
    
    console.log('Created:', {
      id: created.id,
      type: created.type,
      accountUserBalance: created.accountUserBalance,
      accountBalance: created.accountBalance
    });
    
    // Now update it
    console.log('\nUpdating accountUserBalance to 20000...');
    const [updated] = await db
      .update(budgetPosts)
      .set({
        accountUserBalance: 20000, // 200 kr in öre
      })
      .where(eq(budgetPosts.id, created.id))
      .returning();
    
    console.log('Updated:', {
      id: updated.id,
      accountUserBalance: updated.accountUserBalance,
      accountBalance: updated.accountBalance
    });
    
    // Verify by fetching
    console.log('\nFetching to verify...');
    const [fetched] = await db
      .select()
      .from(budgetPosts)
      .where(eq(budgetPosts.id, created.id));
    
    console.log('Fetched:', {
      id: fetched.id,
      type: fetched.type,
      accountUserBalance: fetched.accountUserBalance,
      accountBalance: fetched.accountBalance
    });
    
    // Clean up
    await db.delete(budgetPosts).where(eq(budgetPosts.id, created.id));
    console.log('\nTest complete - cleaned up test data');
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

testUpdate();