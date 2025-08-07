import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkTableStructure() {
  try {
    console.log('Checking budget_posts table structure in PostgreSQL...\n');
    
    // Query to get column information from PostgreSQL information_schema
    const columnInfo = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'budget_posts'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in budget_posts table:');
    console.log('================================');
    
    columnInfo.rows.forEach((col: any) => {
      console.log(`Column: ${col.column_name}`);
      console.log(`  Type: ${col.data_type}`);
      console.log(`  Nullable: ${col.is_nullable}`);
      console.log(`  Default: ${col.column_default || 'none'}`);
      console.log('---');
    });
    
    // Also show a sample row to confirm the data
    const sampleRow = await db.execute(sql`
      SELECT * FROM budget_posts 
      WHERE description LIKE '%Alicia 5%'
      LIMIT 1;
    `);
    
    if (sampleRow.rows.length > 0) {
      console.log('\nSample row (Alicia 5):');
      console.log('======================');
      const row = sampleRow.rows[0];
      Object.keys(row).forEach(key => {
        console.log(`${key}: ${row[key]}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking table structure:', error);
    process.exit(1);
  }
}

checkTableStructure();