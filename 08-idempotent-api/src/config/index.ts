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
});

// Validate process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("❌ Invalid environment variables:", _env.error.format());
    process.exit(1);
}

export const config = _env.data;
