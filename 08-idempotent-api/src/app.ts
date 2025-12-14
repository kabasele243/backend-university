// src/app.ts
import express from "express";
import { idempotency } from "./middleware/idempotency";
import ordersRouter from "./modules/orders/orders.routes";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();
app.use(express.json());

app.use("/orders", idempotency, ordersRouter);

// Global Error Handler (MUST be last)
app.use(errorHandler);
