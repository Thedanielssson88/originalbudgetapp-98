import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function pushProductionSchema() {
  if (!process.env.PRODUCTION_DATABASE_URL) {
    console.error("❌ PRODUCTION_DATABASE_URL is not set in .env file");
    process.exit(1);
  }

  console.log("🚀 Connecting to Neon production database...");
  
  try {
    const client = neon(process.env.PRODUCTION_DATABASE_URL);
    const db = drizzle(client, { schema });
    
    console.log("✅ Successfully connected to Neon production database");
    console.log("📋 Schema will be pushed using drizzle-kit");
    console.log("\nRun: npm run db:push:production\n");
    
    // Test the connection with a simple query
    const result = await client`SELECT current_database(), current_user, version()`;
    console.log("Database info:", result[0]);
    
  } catch (error) {
    console.error("❌ Error connecting to production database:", error);
    process.exit(1);
  }
}

pushProductionSchema();