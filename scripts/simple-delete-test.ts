import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { v4 as uuidv4 } from 'uuid';

async function simpleDeleteTest() {
  console.log("🧪 Simple Category Delete Test");
  console.log("=" .repeat(40));
  
  const prodUrl = process.env.PRODUCTION_DATABASE_URL || 
    'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
  
  try {
    const client = neon(prodUrl);
    const db = drizzle(client, { schema });
    
    // Create test category
    const categoryId = uuidv4();
    await db.insert(schema.huvudkategorier).values({
      id: categoryId,
      userId: 'dev-user-123',
      name: `Test Category ${Date.now()}`,
      sortOrder: 999,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("✅ Created test category");
    
    // Create test subcategory
    const subcategoryId = uuidv4();
    await db.insert(schema.underkategorier).values({
      id: subcategoryId,
      userId: 'dev-user-123',
      name: 'Test Subcategory',
      huvudkategoriId: categoryId,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("✅ Created test subcategory");
    
    // Try to delete main category
    console.log("\n🗑️  Attempting to delete main category...");
    try {
      const deleted = await db.delete(schema.huvudkategorier)
        .where(eq(schema.huvudkategorier.id, categoryId))
        .returning();
      
      console.log("✅ Category deleted successfully!");
      
      // Check if subcategory was cascade deleted
      const remainingSub = await db.select()
        .from(schema.underkategorier)
        .where(eq(schema.underkategorier.id, subcategoryId));
      
      console.log(`📊 Remaining subcategories: ${remainingSub.length} (should be 0)`);
      
    } catch (deleteError: any) {
      console.error("❌ Delete failed!");
      console.error(`Error: ${deleteError.message}`);
      console.error(`Code: ${deleteError.code}`);
      
      // Clean up
      await db.delete(schema.underkategorier).where(eq(schema.underkategorier.id, subcategoryId));
      await db.delete(schema.huvudkategorier).where(eq(schema.huvudkategorier.id, categoryId));
      console.log("🧹 Cleaned up test records");
    }
    
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
  }
}

simpleDeleteTest().catch(console.error);