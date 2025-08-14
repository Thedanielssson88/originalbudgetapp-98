import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";

async function setupProductionUser() {
  console.log("🚀 Setting up production database user");
  console.log("=" .repeat(50));
  
  // Use the production database URL directly
  const prodUrl = process.env.PRODUCTION_DATABASE_URL || 
    'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
  
  console.log("📍 Connecting to production database...");
  
  try {
    const client = neon(prodUrl);
    const db = drizzle(client, { schema });
    
    // Check if user already exists
    console.log("\n1️⃣ Checking if dev-user-123 exists...");
    const existingUsers = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, 'dev-user-123'));
    
    if (existingUsers.length > 0) {
      console.log("   ✅ User dev-user-123 already exists!");
      return;
    }
    
    // Create the dev user
    console.log("\n2️⃣ Creating dev-user-123...");
    const newUser = {
      id: 'dev-user-123',
      email: 'dev@example.com',
      name: 'Development User',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const insertedUser = await db.insert(schema.users)
      .values(newUser)
      .returning();
    
    console.log(`   ✅ Successfully created user: ${insertedUser[0].name}`);
    console.log(`   Email: ${insertedUser[0].email}`);
    console.log(`   ID: ${insertedUser[0].id}`);
    
    // Verify user was created
    console.log("\n3️⃣ Verifying user creation...");
    const verifyUser = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, 'dev-user-123'));
    
    if (verifyUser.length > 0) {
      console.log("   ✅ User verified successfully!");
    } else {
      console.error("   ❌ User verification failed!");
    }
    
    console.log("\n✅ Production database setup completed!");
    console.log("   You can now create categories and other data in production.");
    
  } catch (error: any) {
    console.error("\n❌ Setup failed:", error.message);
    console.error("Error details:", error);
  }
}

setupProductionUser().catch(console.error);