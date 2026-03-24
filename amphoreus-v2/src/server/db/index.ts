// src/server/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error", { error: err.message });
});

pool.on("connect", () => {
  logger.debug("New database connection established");
});

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === "development" });

export type Database = typeof db;

// Graceful shutdown helper
export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}
