// src/modules/orders/orders.schema.ts
import { z } from "zod";

export const CreateOrderSchema = z.object({
    body: z.object({
        amount: z.number().int().positive({ message: "Amount must be a positive integer" }),
        // Add other fields like 'currency', 'items', 'customerId' etc.
    }),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>["body"];
