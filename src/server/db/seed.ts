// src/server/db/seed.ts
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, closeDatabase } from "./index.js";
import { users } from "./schema.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const BCRYPT_ROUNDS = 12;

async function seed() {
    logger.info("Starting database seed...");

    const adminPassword = env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword) {
        logger.error(
            "ADMIN_INITIAL_PASSWORD environment variable is required for seeding"
        );
        process.exit(1);
    }

    // Idempotency check — skip if admin already exists
    const [existingAdmin] = await db
        .select()
        .from(users)
        .where(eq(users.username, "admin"))
        .limit(1);

    if (existingAdmin) {
        logger.info("Admin user already exists, skipping seed");
        await closeDatabase();
        return;
    }

    // Hash with bcrypt before storing
    const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    const [admin] = await db
        .insert(users)
        .values({
            username: "admin",
            password: hashedPassword,
            fullName: "System Administrator",
            role: "admin",
            email: null,
            active: true,
        })
        .returning();

    logger.info("Admin user created", {
        id: admin.id,
        username: admin.username,
        role: admin.role,
    });

    logger.info("Seed completed successfully");
    await closeDatabase();
}

seed().catch((err) => {
    logger.error("Seed failed", { error: err.message });
    process.exit(1);
});
