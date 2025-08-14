import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testProductionDatabase() {
  if (!process.env.PRODUCTION_DATABASE_URL) {
    console.error("❌ PRODUCTION_DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("🚀 Testing Neon production database...\n");
  
  try {
    const client = neon(process.env.PRODUCTION_DATABASE_URL);
    const db = drizzle(client, { schema });
    
    // Test 1: Check database info
    const dbInfo = await client`SELECT current_database(), current_user, version()`;
    console.log("✅ Database connection successful");
    console.log("   Database:", dbInfo[0].current_database);
    console.log("   User:", dbInfo[0].current_user);
    console.log("");
    
    // Test 2: Check all tables exist
    const tables = await client`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    console.log("✅ Tables in production database:");
    tables.forEach(t => console.log(`   - ${t.tablename}`));
    console.log("");
    
    // Test 3: Count records in key tables
    const transactionCount = await client`SELECT COUNT(*) as count FROM transactions`;
    const accountCount = await client`SELECT COUNT(*) as count FROM accounts`;
    const userCount = await client`SELECT COUNT(*) as count FROM users`;
    
    console.log("✅ Record counts:");
    console.log(`   - Users: ${userCount[0].count}`);
    console.log(`   - Accounts: ${accountCount[0].count}`);
    console.log(`   - Transactions: ${transactionCount[0].count}`);
    console.log("");
    
    console.log("🎉 Production database is ready to use!");
    console.log("\n📝 Database URLs configured:");
    console.log("   Development: Uses DATABASE_URL (Replit PostgreSQL)");
    console.log("   Production: Uses PRODUCTION_DATABASE_URL (Neon)");
    console.log("\n🚀 When you deploy to production, the app will automatically use the Neon database");
    
  } catch (error) {
    console.error("❌ Error testing production database:", error);
    process.exit(1);
  }
}

testProductionDatabase();