import { logger } from "../../lib/logger";

export class PaymentService {
    /**
     * Simulates charging a credit card.
     * Contains built-in latency and random failures to demonstrate resilience.
     */
    async processPayment(amount: number): Promise<boolean> {
        const latency = Math.floor(Math.random() * 500); // 0-500ms latency
        await new Promise(resolve => setTimeout(resolve, latency));

        // Simulate random crashes (20% chance)
        // In a real scenario, this would be an HTTP 500 or timeout from the provider
        if (Math.random() < 0.2) {
            logger.error("Payment Gateway Error: Service Unavailable");
            throw new Error("Payment Gateway Unavailable");
        }

        logger.info({ amount }, "Payment Processed Successfully");
        return true;
    }
}

export const paymentService = new PaymentService();
