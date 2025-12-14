import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const CORRELATION_ID_HEADER = "X-Correlation-ID";

export const correlationId = (req: Request, res: Response, next: NextFunction) => {
    let correlationId = req.headers[CORRELATION_ID_HEADER.toLowerCase()] as string;

    if (!correlationId) {
        correlationId = randomUUID();
    }

    // Attach to request
    req.requestId = correlationId;

    // Attach child logger with correlation ID
    req.log = logger.child({ correlationId });

    // Set header on response
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
};
