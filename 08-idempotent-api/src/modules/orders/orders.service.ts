// src/modules/orders/orders.service.ts
import { prisma } from "../../lib/prisma";
import { CreateOrderInput } from "./orders.schema";
import { logger } from "../../lib/logger";

export interface IOrdersService {
    createOrder(data: CreateOrderInput, idempotencyKey?: string): Promise<{ id: string; amount: number; status: string }>;
}

export class OrdersService implements IOrdersService {
    /**
     * Creates a new order in the database.
     * This method is "pure" business logic and knows nothing about HTTP (req/res).
     */
    async createOrder(data: CreateOrderInput, idempotencyKey?: string) {
        // 1. You could perform complex validations here (e.g., check user balance)

        logger.info({ msg: "Creating order", amount: data.amount });

        // 2. Database transaction
        const order = await prisma.order.create({
            data: {
                amount: data.amount,
                status: "COMPLETED",
                idempotencyKey,
            },
        });

        logger.info({ msg: "Order Created", orderId: order.id });

        return order;
    }
}

export const ordersService = new OrdersService();
