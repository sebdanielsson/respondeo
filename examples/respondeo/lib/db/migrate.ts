import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URL not set — skipping migrations.");
    return;
  }

  console.log("🚀 Starting database migrations...");

  // Use a single connection for migrations (postgres.js recommendation).
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: "./drizzle/pg" });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
