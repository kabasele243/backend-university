import { NextFunction, Request, Response } from "express";
import { CreateOrderInput } from "./orders.schema";
import { IOrdersService } from "./orders.service";

export class OrdersController {
    constructor(private readonly ordersService: IOrdersService) { }

    async create(req: Request<{}, {}, CreateOrderInput>, res: Response, next: NextFunction) {
        try {
            // The body is already validated by middleware before it gets here (ideally)
            // But for now, we trust the types or validate manually if not using a middleware
            // We'll trust Zod middleware in routes.

            const { amount } = req.body;
            const idempotencyKey = req.headers["x-idempotency-key"] as string;

            const order = await this.ordersService.createOrder({ amount }, idempotencyKey);

            return res.status(201).json({
                message: "Order created successfully",
                orderId: order.id,
                amount: order.amount,
                status: order.status,
            });

        } catch (err) {
            next(err);
        }
    }
}

