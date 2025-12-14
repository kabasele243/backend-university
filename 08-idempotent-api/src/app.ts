// src/app.ts
import express from "express";
import { config } from "./config";
import { idempotency } from "./middleware/idempotency";
import ordersRouter from "./modules/orders/orders.routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());

// Apply idempotency middleware globally or to specific routes
// Here we apply it to /orders
app.use("/orders", idempotency, ordersRouter);

// Global Error Handler (MUST be last)
app.use(errorHandler);

app.listen(config.PORT, () => {
    logger.info(`Server running on http://localhost:${config.PORT}`);
});
