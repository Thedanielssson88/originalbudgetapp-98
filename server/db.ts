import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// Determine which database to use based on environment
const getDatabaseUrl = (): string => {
  // In production (when deployed), use PRODUCTION_DATABASE_URL if available
  if (process.env.PRODUCTION_DATABASE_URL && process.env.NODE_ENV === 'production') {
    console.log('🚀 Using production database (Neon)');
    return process.env.PRODUCTION_DATABASE_URL;
  }
  
  // In development or if no production URL is set, use the regular DATABASE_URL
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using development database (Replit PostgreSQL)');
    return process.env.DATABASE_URL;
  }
  
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
};

const databaseUrl = getDatabaseUrl();
const client = neon(databaseUrl);
export const db = drizzle(client, { schema });