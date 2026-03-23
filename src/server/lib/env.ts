import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_PORT: z.coerce.number().default(3000),

  DATABASE_URL: z
    .string()
    .url()
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL connection string"),

  REDIS_URL: z.string().url().startsWith("redis://"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "\n❌ Invalid environment variables:\n",
      result.error.flatten().fieldErrors
    );
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
