// src/modules/orders/orders.controller.ts
import { Request, Response } from "express";
import { CreateOrderInput } from "./orders.schema";
import { ordersService } from "./orders.service";
import { logger } from "../../lib/logger";

export class OrdersController {
    async create(req: Request<{}, {}, CreateOrderInput>, res: Response) {
        try {
            // The body is already validated by middleware before it gets here (ideally)
            // But for now, we trust the types or validate manually if not using a middleware
            // We'll trust Zod middleware in routes.

            const { amount } = req.body;

            const order = await ordersService.createOrder({ amount });

            // Simulate network delay sending response
            await new Promise((r) => setTimeout(r, 500));

            return res.status(201).json({
                message: "Order created successfully",
                orderId: order.id,
                amount: order.amount,
                status: order.status,
            });

        } catch (err) {
            logger.error({ err }, "Error creating order");
            // In production, next(err) to global error handler
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }
}

export const ordersController = new OrdersController();
