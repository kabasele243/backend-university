// src/lib/logger.ts
import pino from "pino";
import { config } from "../config";

export const logger = pino({
    level: config.NODE_ENV === "test" ? "silent" : config.LOG_LEVEL,
    transport:
        config.NODE_ENV === "development"
            ? {
                target: "pino-pretty",
                options: {
                    colorize: true,
                },
            }
            : undefined,
    base: {
        pid: process.pid,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});
