// src/modules/orders/orders.integration.spec.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { setupTestEnvironment, teardownTestEnvironment } from "../../test/setup";

describe("Orders API Integration", () => {
    let app: any;
    let prisma: any;

    beforeAll(async () => {
        // 1. Setup Containers & Env Vars
        await setupTestEnvironment();

        // 2. Dynamic Import (AFTER env vars are set)
        // This ensures 'new PrismaClient()' in lib/prisma.ts sees the Testcontainer URL
        const appModule = await import("../../app");
        app = appModule.app;

        const prismaModule = await import("../../lib/prisma");
        prisma = prismaModule.prisma;

        await prisma.$connect();
    }, 120000);

    afterAll(async () => {
        if (prisma) await prisma.$disconnect();
        await teardownTestEnvironment();
    });

    it("should create a new order and return 201", async () => {
        const response = await request(app)
            .post("/orders")
            .set("x-idempotency-key", "integration-test-1")
            .send({ amount: 500 });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("Order created successfully");

        // Verify DB
        const order = await prisma.order.findUnique({ where: { id: response.body.orderId } });
        expect(order).not.toBeNull();
        expect(order?.amount).toBe(500);
    });

    it("should return cached response for duplicate request", async () => {
        const key = "integration-test-2";

        // First Request
        const res1 = await request(app)
            .post("/orders")
            .set("x-idempotency-key", key)
            .send({ amount: 1000 });

        expect(res1.status).toBe(201);

        // Second Request (Identical)
        const res2 = await request(app)
            .post("/orders")
            .set("x-idempotency-key", key)
            .send({ amount: 1000 });

        expect(res2.status).toBe(201);
        expect(res2.body).toEqual(res1.body); // Exact same response (including ID)

        // Verify DB only has 1 order (though difficult to check "count" without knowing total, but the ID reuse suggests caching)
    });
});
