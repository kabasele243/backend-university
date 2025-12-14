
import CircuitBreaker from "opossum";
import { logger } from "./logger";
import { config } from "../config";

/**
 * Singleton factory to create or retrieve circuit breakers.
 * Ensures consistent configuration and centralized event logging.
 */
class CircuitBreakerFactory {
    private static instance: CircuitBreakerFactory;
    private breakers: Map<string, CircuitBreaker> = new Map();

    private constructor() { }

    public static getInstance(): CircuitBreakerFactory {
        if (!CircuitBreakerFactory.instance) {
            CircuitBreakerFactory.instance = new CircuitBreakerFactory();
        }
        return CircuitBreakerFactory.instance;
    }

    /**
     * Wrap an async function in a Circuit Breaker.
     * @param name Name of the circuit breaker (for logging)
     * @param action The async function to wrap
     * @param options Optional overrides for this specific breaker
     */
    public getBreaker<TI extends unknown[], TR>(
        name: string,
        action: (...args: TI) => Promise<TR>,
        options?: CircuitBreaker.Options
    ): CircuitBreaker<TI, TR> {
        if (this.breakers.has(name)) {
            // In a real app we might want to ensure 'action' matches, but for now returned cached breaker
            // Use with caution: re-wrapping different functions with same name will return original breaker
            return this.breakers.get(name) as CircuitBreaker<TI, TR>;
        }

        const breakerOptions: CircuitBreaker.Options = {
            timeout: config.CB_TIMEOUT,
            errorThresholdPercentage: config.CB_ERROR_THRESHOLD,
            resetTimeout: config.CB_RESET_TIMEOUT,
            ...options
        };

        const breaker = new CircuitBreaker(action, breakerOptions);

        // --- Observability: Event Logging ---
        breaker.on("open", () => logger.warn({ breaker: name }, "🔴 Circuit Breaker OPEN"));
        breaker.on("halfOpen", () => logger.info({ breaker: name }, "🟡 Circuit Breaker HALF-OPEN"));
        breaker.on("close", () => logger.info({ breaker: name }, "🟢 Circuit Breaker CLOSED"));

        // Only log failures derived from the breaker logic if needed, 
        // but 'failure' event can be noisy if the app handles errors well. 
        // We'll log 'fallback' if we implement it.
        breaker.on("fallback", () => logger.warn({ breaker: name }, "Circuit Breaker Fallback triggered"));

        this.breakers.set(name, breaker);
        return breaker;
    }
}

export const circuitBreakerFactory = CircuitBreakerFactory.getInstance();
