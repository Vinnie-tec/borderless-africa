import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });
export default defineConfig({
  // Where generated migration files will be stored.
  out: "./drizzle",

  // Where Drizzle will find our table definitions.
  schema: "./src/lib/db/schema.ts",

  dialect: "postgresql",

  // Use the direct connection for migration operations.
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});                                                                                                     