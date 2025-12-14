// src/app.ts
import express from "express";
import { config } from "./config";
import { idempotency } from "./middleware/idempotency";
import ordersRouter from "./modules/orders/orders.routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());

app.use("/orders", idempotency, ordersRouter);

// Global Error Handler (MUST be last)
app.use(errorHandler);

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
