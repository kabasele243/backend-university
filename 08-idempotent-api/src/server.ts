// src/server.ts
import { app } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

const server = app.listen(config.PORT, () => {
    logger.info(`Server running on http://localhost:${config.PORT}`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    server.close(() => {
        logger.info("HTTP server closed.");
    });

    try {
        // Dynamic import to avoid earlier instantiation if possible, though here it doesn't matter much
        // but consistent with previous code
        await import("./lib/prisma").then(m => m.prisma.$disconnect());
        logger.info("Prisma disconnected.");
        process.exit(0);
    } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
    }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
