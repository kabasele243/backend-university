// src/app.ts
import express from "express";
import { idempotency } from "./middleware/idempotency";
import ordersRouter from "./modules/orders/orders.routes";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();
app.use(express.json());

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
