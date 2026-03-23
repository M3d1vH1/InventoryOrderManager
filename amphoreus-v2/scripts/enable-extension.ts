import { sql } from "drizzle-orm";
import { db } from "../src/server/db/index.js";

async function main() {
    console.log("Enabling pg_trgm extension...");
    try {
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
        console.log("Success: pg_trgm extension enabled.");
    } catch (err) {
        console.error("Error enabling extension:", err);
    }
}

main().then(() => process.exit(0));
