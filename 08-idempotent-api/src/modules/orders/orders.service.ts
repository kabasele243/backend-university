// src/modules/orders/orders.service.ts
import { prisma } from "../../lib/prisma";
import { CreateOrderInput } from "./orders.schema";
import { logger } from "../../lib/logger";
import { paymentService } from "../payment/payment.service";
import { circuitBreakerFactory } from "../../lib/circuitBreaker";

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

        // 2. Process Payment via Circuit Breaker
        // We define the breaker once (conceptually), but here providing the function ensures we wrap it.
        // The factory handles caching by name "payment-service".
        const breaker = circuitBreakerFactory.getBreaker(
            "payment-service",
            paymentService.processPayment.bind(paymentService)
        );

        try {
            await breaker.fire(data.amount);
        } catch (err: any) {
            if (err.type === "OpenBreakerError") {
                // 503 Service Unavailable is the correct semantic response
                // The client should try again later (Retry-After)
                const error: any = new Error("Service temporarily unavailable");
                error.status = 503;
                throw error;
            }
            // Re-throw other errors (e.g. Validation, or actual Payment failure if we want to bubble it)
            throw err;
        }

        // 3. Database transaction
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
