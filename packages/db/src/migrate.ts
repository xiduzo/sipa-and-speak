/**
 * Programmatic migration runner.
 * Used in the deploy pipeline (Dockerfile) to run migrations before server start.
 * Usage: bun run packages/db/src/migrate.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { seedVenues } from "./seed/venues";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required to run migrations");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
const db = drizzle(pool);

console.log("Running database migrations...");

try {
  const migrationsFolder = new URL("./migrations", import.meta.url).pathname;
  await migrate(db, { migrationsFolder });
  console.log("Migrations completed successfully");
  await seedVenues();
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
