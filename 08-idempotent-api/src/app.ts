// src/app.ts
import express from "express";
import helmet from "helmet";
import { idempotency } from "./middleware/idempotency";
import { correlationId } from "./middleware/correlationId";
import ordersRouter from "./modules/orders/orders.routes";
import { errorHandler } from "./middleware/errorHandler";
import { config } from "./config";

export const app = express();
app.use(helmet());
app.use(correlationId);
app.use(express.json({ limit: config.REQUEST_BODY_LIMIT }));

// Rate Limiting
import { limiter } from "./middleware/rateLimit";
app.use(limiter);

// Health Checks
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", async (req, res) => {
    // Simple readiness check (can be expanded to check DB)
    res.status(200).json({ status: "ready" });
});

app.use("/orders", idempotency, ordersRouter);

// Global Error Handler (MUST be last)
app.use(errorHandler);
