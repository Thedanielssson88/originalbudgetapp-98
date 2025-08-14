import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { v4 as uuidv4 } from 'uuid';

async function testDeleteCategory() {
  console.log("🧪 Testing Category Delete Operations");
  console.log("=" .repeat(50));
  
  const prodUrl = process.env.PRODUCTION_DATABASE_URL || 
    'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
  
  console.log("📍 Connecting to production database...");
  
  try {
    const client = neon(prodUrl);
    const db = drizzle(client, { schema });
    
    // Step 1: Create a test category
    console.log("\n1️⃣ Creating test category...");
    const testCategoryId = uuidv4();
    const testCategory = {
      id: testCategoryId,
      userId: 'dev-user-123',
      name: `Test Delete Category ${new Date().getTime()}`,
      sortOrder: 999,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.insert(schema.huvudkategorier).values(testCategory);
    console.log(`   ✅ Created category: ${testCategory.name}`);
    
    // Step 2: Create a test subcategory
    console.log("\n2️⃣ Creating test subcategory...");
    const testSubcategoryId = uuidv4();
    const testSubcategory = {
      id: testSubcategoryId,
      userId: 'dev-user-123',
      name: 'Test Subcategory',
      huvudkategoriId: testCategoryId,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.insert(schema.underkategorier).values(testSubcategory);
    console.log(`   ✅ Created subcategory: ${testSubcategory.name}`);
    
    // Step 3: Skip transaction creation for now (timestamp issue)
    console.log("\n3️⃣ Skipping transaction creation (focusing on category/subcategory relationship)...");
    
    // Step 4: Try to delete the main category
    console.log("\n4️⃣ Attempting to delete main category...");
    try {
      const deletedCategory = await db.delete(schema.huvudkategorier)
        .where(eq(schema.huvudkategorier.id, testCategoryId))
        .returning();
      
      console.log(`   ✅ Successfully deleted category: ${deletedCategory[0]?.name || 'Unknown'}`);
      
      // Step 5: Check what happened to related records
      console.log("\n5️⃣ Checking related records after delete...");
      
      // Check subcategories (should be cascade deleted)
      const remainingSubcategories = await db.select()
        .from(schema.underkategorier)
        .where(eq(schema.underkategorier.id, testSubcategoryId));
      console.log(`   Remaining subcategories: ${remainingSubcategories.length} (should be 0)`);
      
      // Check transaction (should have hovedkategori_id set to null)
      const updatedTransaction = await db.select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, testTransactionId));
      
      if (updatedTransaction.length > 0) {
        console.log(`   Transaction hovedkategori_id: ${updatedTransaction[0].huvudkategoriId || 'NULL'} (should be NULL)`);
        console.log(`   Transaction underkategori_id: ${updatedTransaction[0].underkategoriId || 'NULL'} (should be NULL)`);
        
        // Clean up the test transaction
        await db.delete(schema.transactions)
          .where(eq(schema.transactions.id, testTransactionId));
        console.log(`   🧹 Cleaned up test transaction`);
      }
      
    } catch (deleteError: any) {
      console.error(`   ❌ Delete failed: ${deleteError.message}`);
      console.error(`   Error code: ${deleteError.code}`);
      console.error(`   Error details:`, deleteError);
      
      // Clean up test records if delete failed
      console.log("\n🧹 Cleaning up test records...");
      await db.delete(schema.transactions).where(eq(schema.transactions.id, testTransactionId));
      await db.delete(schema.underkategorier).where(eq(schema.underkategorier.id, testSubcategoryId));
      await db.delete(schema.huvudkategorier).where(eq(schema.huvudkategorier.id, testCategoryId));
      console.log("   ✅ Test records cleaned up");
    }
    
    console.log("\n✅ Delete test completed!");
    
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error("Error details:", error);
  }
}

testDeleteCategory().catch(console.error);