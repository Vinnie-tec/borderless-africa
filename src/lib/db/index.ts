import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// Reuse a PostgreSQL connection pool instead of
// opening a new database connection for every query.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Export one shared Drizzle instance for the application.
export const db = drizzle(pool);