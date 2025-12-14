import { describe, it, expect, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";
import { Request, Response } from "express";
import { OrdersController } from "./orders.controller";
import { IOrdersService } from "./orders.service";

describe("OrdersController", () => {
    it("should create an order successfully", async () => {
        // 1. Mock dependencies
        const mockService = mock<IOrdersService>();
        const controller = new OrdersController(mockService);

        // 2. Setup mock return value
        const mockOrder = {
            id: "test-id",
            amount: 100,
            status: "COMPLETED",
        };
        mockService.createOrder.mockResolvedValue(mockOrder);

        // 3. Mock Express objects
        const req = mockDeep<Request>();
        req.body = { amount: 100 };
        req.headers = { "x-idempotency-key": "test-key" };

        const res = mockDeep<Response>();
        res.status.mockReturnThis(); // Chainable
        res.json.mockReturnThis();

        const next = vi.fn();

        // 4. Act
        await controller.create(req, res, next);

        // 5. Assert
        expect(mockService.createOrder).toHaveBeenCalledWith({ amount: 100 }, "test-key");
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Order created successfully",
            orderId: "test-id",
            amount: 100,
            status: "COMPLETED",
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("should pass errors to next()", async () => {
        // 1. Mock failure
        const mockService = mock<IOrdersService>();
        mockService.createOrder.mockRejectedValue(new Error("Database boom"));

        const controller = new OrdersController(mockService);
        const req = mockDeep<Request>();
        req.body = { amount: 100 };
        const res = mockDeep<Response>();
        const next = vi.fn();

        // 2. Act
        await controller.create(req, res, next);

        // 3. Assert
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});
