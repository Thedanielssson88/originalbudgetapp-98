import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Use DATABASE_URL (which can be overridden for production)
const databaseUrl = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or PRODUCTION_DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
