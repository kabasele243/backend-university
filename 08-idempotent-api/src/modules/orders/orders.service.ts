// src/modules/orders/orders.service.ts
import { prisma } from "../../lib/prisma";
import { CreateOrderInput } from "./orders.schema";
import { logger } from "../../lib/logger";

export class OrdersService {
    /**
     * Creates a new order in the database.
     * This method is "pure" business logic and knows nothing about HTTP (req/res).
     */
    async createOrder(data: CreateOrderInput) {
        // 1. You could perform complex validations here (e.g., check user balance)

        logger.info({ msg: "Creating order", amount: data.amount });

        // Simulate complex/slow processing
        await new Promise((r) => setTimeout(r, 1000));

        // 2. Database transaction
        const order = await prisma.order.create({
            data: {
                amount: data.amount,
                status: "COMPLETED",
            },
        });

        logger.info({ msg: "Order Created", orderId: order.id });

        return order;
    }
}

export const ordersService = new OrdersService();
