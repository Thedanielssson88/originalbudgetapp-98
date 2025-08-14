import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// Determine which database to use based on environment
const getDatabaseUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, use the EU production database
  if (isProduction) {
    const prodUrl = process.env.PRODUCTION_DATABASE_URL || 'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    console.log('🚀 Using production database (Neon EU)');
    return prodUrl;
  }
  
  // In development, use the current DATABASE_URL (US Neon database)
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using development database (Neon US)');
    return process.env.DATABASE_URL;
  }
  
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
};

const databaseUrl = getDatabaseUrl();
const client = neon(databaseUrl);
export const db = drizzle(client, { schema });