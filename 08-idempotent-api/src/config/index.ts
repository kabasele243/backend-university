// src/config/index.ts
import dotenv from "dotenv";
import { z } from "zod";

// Load .env file
dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.string().default("3000").transform(Number),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DYNAMODB_ENDPOINT: z.string().default("http://localhost:8000"),
    AWS_REGION: z.string().default("us-east-1"),
    // Database Config
    DATABASE_CONNECTION_LIMIT: z.string().default("10").transform(Number),
    DATABASE_POOL_TIMEOUT: z.string().default("10").transform(Number),
    // Circuit Breaker Config
    CB_TIMEOUT: z.string().default("5000").transform(Number),
    CB_ERROR_THRESHOLD: z.string().default("50").transform(Number),
    CB_RESET_TIMEOUT: z.string().default("10000").transform(Number),
    // Logging Config
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("debug"),
    // Application Config
    REQUEST_BODY_LIMIT: z.string().default("10kb"),
});

// Validate process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("❌ Invalid environment variables:", _env.error.format());
    process.exit(1);
}

export const config = _env.data;
