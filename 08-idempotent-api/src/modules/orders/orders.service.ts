// src/modules/orders/orders.service.ts
import { prisma } from "../../lib/prisma";
import { CreateOrderInput } from "./orders.schema";

export class OrdersService {
    /**
     * Creates a new order in the database.
     * This method is "pure" business logic and knows nothing about HTTP (req/res).
     */
    async createOrder(data: CreateOrderInput) {
        // 1. You could perform complex validations here (e.g., check user balance)

        console.log(`[Service] creating order amount=${data.amount}`);

        // Simulate complex/slow processing
        await new Promise((r) => setTimeout(r, 1000));

        // 2. Database transaction
        const order = await prisma.order.create({
            data: {
                amount: data.amount,
                status: "COMPLETED",
            },
        });

        console.log(`[Service] Order Created: ${order.id}`);

        return order;
    }
}

export const ordersService = new OrdersService();
