import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production database connection (default)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Development database URLs
const DEV_DATABASE_URL = 'postgresql://neondb_owner:npg_csIURKah4TN5@ep-soft-salad-aeyhh2aj.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
const PROD_DATABASE_URL = 'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Create development database connection
const devPool = new Pool({ connectionString: DEV_DATABASE_URL });
const devDb = drizzle({ client: devPool, schema });

// Function to get the appropriate database connection based on user
export function getUserDatabase(userId?: string) {
  if (userId === 'dev-user-123') {
    console.log(`🔧 Using DEV database for user: ${userId}`);
    return devDb;
  } else {
    console.log(`🚀 Using PROD database for user: ${userId || 'anonymous'}`);
    return db;
  }
}