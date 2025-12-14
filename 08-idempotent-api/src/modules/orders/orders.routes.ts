// src/modules/orders/orders.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { OrdersController } from "./orders.controller";
import { ordersService } from "./orders.service";
import { CreateOrderSchema } from "./orders.schema";
import { ZodError } from "zod";

const router = Router();
const ordersController = new OrdersController(ordersService);

// Simple inline validation middleware
const validate = (schema: typeof CreateOrderSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
        schema.parse({
            body: req.body,
        });
        next();
    } catch (err) {
        next(err);
    }
};

router.post("/",
    validate(CreateOrderSchema),
    (req, res, next) => ordersController.create(req, res, next));

export default router;
