import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// Determine which database to use based on environment
const getDatabaseUrl = (): string => {
  // For now, always use your Neon production database since it has your real data
  // The current DATABASE_URL is your Neon database with 3840 transactions
  if (process.env.DATABASE_URL) {
    console.log('🚀 Using production database (Neon) - your real data');
    return process.env.DATABASE_URL;
  }
  
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
};

const databaseUrl = getDatabaseUrl();
const client = neon(databaseUrl);
export const db = drizzle(client, { schema });