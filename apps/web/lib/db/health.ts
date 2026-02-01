import { db } from "./index";
import { sql } from "drizzle-orm";

export interface DatabaseHealthStatus {
  connected: boolean;
  error?: string;
}

// Check if we're in Next.js build phase (no database needed)
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL;

/**
 * Check if the database connection is healthy
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  // Skip health check during build - no database connection needed
  if (isBuildPhase) {
    return { connected: true };
  }

  try {
    // Simple query to test connection
    await db.execute(sql`SELECT 1`);

    return {
      connected: true,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown database error";
    console.error("Database health check failed:", error);

    return {
      connected: false,
      error,
    };
  }
}

/**
 * Type guard to check if an error is a database connection error
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const connectionErrorPatterns = [
    "ECONNREFUSED",
    "connection refused",
    "could not connect",
    "Connection terminated",
    "ETIMEDOUT",
    "connect ENOENT",
    "no pg_hba.conf entry",
    "password authentication failed",
    "database .* does not exist",
    "getaddrinfo",
    "ENOTFOUND",
  ];

  return connectionErrorPatterns.some((pattern) =>
    error.message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

/**
 * Get a user-friendly error message for database errors
 */
export function getDatabaseErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unexpected database error occurred";
  }

  if (error.message.includes("ECONNREFUSED")) {
    return "Cannot connect to PostgreSQL database. Please ensure the database server is running.";
  }

  if (error.message.includes("password authentication failed")) {
    return "Database authentication failed. Please check your credentials.";
  }

  if (error.message.includes("does not exist")) {
    return "The specified database does not exist. Please create it or check your configuration.";
  }

  if (error.message.includes("ETIMEDOUT")) {
    return "Database connection timed out. Please check your network and database server.";
  }

  return `Database error: ${error.message}`;
}
