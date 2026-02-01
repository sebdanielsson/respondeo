import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";
import * as schema from "./schema";

if (!process.env.DATABASE_URL && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = new SQL(process.env.DATABASE_URL!);

export const db = drizzle({ client, schema });
