import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Decide whether this invocation should apply migrations.
 *
 * Migrations run as part of `build`, which on Vercel means they run in the
 * build container for *every* deployment — including previews. When previews
 * share `DATABASE_URL` with production (the default unless per-environment
 * values are configured), a preview build would migrate the production schema
 * ahead of the code that is actually serving traffic.
 *
 * So on Vercel we only migrate for production deployments. Set
 * `RUN_MIGRATIONS=true` to force them anywhere — e.g. a preview environment
 * that is wired to its own branch database.
 *
 * @returns A reason to skip, or null to proceed
 */
function getSkipReason(): string | null {
  if (process.env.RUN_MIGRATIONS === "true") {
    return null;
  }

  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production") {
    const env = process.env.VERCEL_ENV ?? "non-production";
    return `Vercel ${env} deployment (set RUN_MIGRATIONS=true to override)`;
  }

  return null;
}

async function runMigrations() {
  const skipReason = getSkipReason();
  if (skipReason) {
    console.log(`⏭️  Skipping migrations: ${skipReason}`);
    return;
  }

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
