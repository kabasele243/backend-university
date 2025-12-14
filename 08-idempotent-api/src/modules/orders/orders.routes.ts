// src/modules/orders/orders.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { ordersController } from "./orders.controller";
import { CreateOrderSchema } from "./orders.schema";
import { ZodError } from "zod";

const router = Router();

// Simple inline validation middleware
const validate = (schema: typeof CreateOrderSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
        schema.parse({
            body: req.body,
        });
        next();
    } catch (err) {
        if (err instanceof ZodError) {
            return res.status(400).json({ errors: (err as ZodError).errors });
        }
        next(err);
    }
};

router.post("/", validate(CreateOrderSchema), (req, res) => ordersController.create(req, res));

export default router;
