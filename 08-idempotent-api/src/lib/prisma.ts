// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

import { config } from "../config";

const dbUrl = new URL(config.DATABASE_URL);
dbUrl.searchParams.set("connection_limit", String(config.DATABASE_CONNECTION_LIMIT));
dbUrl.searchParams.set("pool_timeout", String(config.DATABASE_POOL_TIMEOUT));

const isDebug = ["debug", "trace"].includes(config.LOG_LEVEL);

export const prisma = new PrismaClient({
    log: isDebug ? ["query", "info", "warn", "error"] : ["warn", "error"],
    datasources: {
        db: {
            url: dbUrl.toString(),
        },
    },
});
