import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { v4 as uuidv4 } from 'uuid';

async function testProductionWrite() {
  console.log("🧪 Testing Production Database Write Capabilities");
  console.log("=" .repeat(50));
  
  // Use the production database URL directly
  const prodUrl = process.env.PRODUCTION_DATABASE_URL || 
    'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
  
  console.log("📍 Database URL:", prodUrl.replace(/:[^@]+@/, ':***@'));
  
  try {
    const client = neon(prodUrl);
    const db = drizzle(client, { schema });
    
    // Test 1: Read existing categories
    console.log("\n1️⃣ Testing READ operation...");
    const categories = await db.select().from(schema.huvudkategorier);
    console.log(`   ✅ Successfully read ${categories.length} categories`);
    
    // Test 2: Create a test category
    console.log("\n2️⃣ Testing WRITE operation...");
    const testCategoryId = uuidv4();
    const testCategory = {
      id: testCategoryId,
      userId: 'dev-user-123',
      name: `Test Category ${new Date().getTime()}`,
      sortOrder: 999,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const inserted = await db.insert(schema.huvudkategorier)
        .values(testCategory)
        .returning();
      console.log(`   ✅ Successfully created category: ${inserted[0].name}`);
      
      // Test 3: Update the test category
      console.log("\n3️⃣ Testing UPDATE operation...");
      const updated = await db.update(schema.huvudkategorier)
        .set({ name: `Updated ${testCategory.name}` })
        .where(eq(schema.huvudkategorier.id, testCategoryId))
        .returning();
      console.log(`   ✅ Successfully updated category: ${updated[0].name}`);
      
      // Test 4: Delete the test category
      console.log("\n4️⃣ Testing DELETE operation...");
      const deleted = await db.delete(schema.huvudkategorier)
        .where(eq(schema.huvudkategorier.id, testCategoryId))
        .returning();
      console.log(`   ✅ Successfully deleted test category`);
      
    } catch (writeError: any) {
      console.error("   ❌ Write operation failed:", writeError.message);
      console.error("   Error details:", writeError);
      
      // Check if it's a permission issue
      if (writeError.message.includes('permission') || writeError.message.includes('denied')) {
        console.error("\n⚠️  Database permission issue detected!");
        console.error("   The database user may not have write permissions.");
      }
    }
    
    // Test 5: Check database connection info
    console.log("\n5️⃣ Checking database connection info...");
    const result = await client`SELECT current_database(), current_user, version()`;
    console.log(`   Database: ${result[0].current_database}`);
    console.log(`   User: ${result[0].current_user}`);
    console.log(`   Version: ${result[0].version.split(',')[0]}`);
    
    // Test 6: Check user permissions
    console.log("\n6️⃣ Checking user permissions...");
    const permissions = await client`
      SELECT has_table_privilege(current_user, 'huvudkategorier', 'INSERT') as can_insert,
             has_table_privilege(current_user, 'huvudkategorier', 'UPDATE') as can_update,
             has_table_privilege(current_user, 'huvudkategorier', 'DELETE') as can_delete,
             has_table_privilege(current_user, 'huvudkategorier', 'SELECT') as can_select
    `;
    console.log(`   Can INSERT: ${permissions[0].can_insert}`);
    console.log(`   Can UPDATE: ${permissions[0].can_update}`);
    console.log(`   Can DELETE: ${permissions[0].can_delete}`);
    console.log(`   Can SELECT: ${permissions[0].can_select}`);
    
    console.log("\n✅ All tests completed!");
    
  } catch (error: any) {
    console.error("\n❌ Connection failed:", error.message);
    console.error("Error details:", error);
    
    if (error.message.includes('SASL')) {
      console.error("\n⚠️  Authentication issue detected!");
      console.error("   Check that your database credentials are correct.");
    }
  }
}

testProductionWrite().catch(console.error);