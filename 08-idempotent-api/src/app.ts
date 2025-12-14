// src/app.ts
import express from "express";
import { config } from "./config";
import { idempotency } from "./middleware/idempotency";
import ordersRouter from "./modules/orders/orders.routes";

const app = express();
app.use(express.json());

// Apply idempotency middleware globally or to specific routes
// Here we apply it to /orders
app.use("/orders", idempotency, ordersRouter);

app.listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
});
