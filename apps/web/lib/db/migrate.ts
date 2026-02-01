import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { SQL } from "bun";

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("🚀 Starting database migrations...");

  const client = new SQL(process.env.DATABASE_URL);
  const db = drizzle({ client });

  try {
    await migrate(db, { migrationsFolder: "./drizzle/pg" });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigrations();
