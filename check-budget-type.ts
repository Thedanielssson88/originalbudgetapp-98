import { db } from './server/db.js';
import { budgetPosts } from './shared/schema.js';
import { eq, and, like } from 'drizzle-orm';

async function checkBudgetType() {
  try {
    console.log('Checking budget_type field in database...\n');
    
    // First, get all budget posts to see the structure
    const allPosts = await db
      .select()
      .from(budgetPosts)
      .limit(5);
    
    console.log('Sample budget posts (first 5):');
    console.log(JSON.stringify(allPosts, null, 2));
    console.log('\n-------------------\n');
    
    // Look specifically for Alicia posts
    const aliciaPosts = await db
      .select()
      .from(budgetPosts)
      .where(like(budgetPosts.description, '%Alicia%'));
    
    console.log(`Found ${aliciaPosts.length} Alicia posts:`);
    aliciaPosts.forEach(post => {
      console.log(`\nDescription: ${post.description}`);
      console.log(`ID: ${post.id}`);
      console.log(`budget_type: ${post.budgetType}`);
      console.log(`type: ${post.type}`);
      console.log(`transactionType: ${post.transactionType}`);
      console.log(`monthKey: ${post.monthKey}`);
      console.log(`accountId: ${post.accountId}`);
    });
    
    // Check if budget_type column exists by querying column info
    console.log('\n-------------------\n');
    console.log('Checking column structure...');
    
    // Get the first post to see all available fields
    if (allPosts.length > 0) {
      console.log('\nAvailable fields in budget_posts table:');
      console.log(Object.keys(allPosts[0]));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking budget_type:', error);
    process.exit(1);
  }
}

checkBudgetType();