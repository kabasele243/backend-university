import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // If headers are already sent, delegate to default Express handler
    if (res.headersSent) {
        return next(err);
    }

    // 1. Zod Validation Errors
    if (err instanceof ZodError) {
        logger.warn({ err }, "Validation Error");
        return res.status(400).json({
            error: "Validation Error",
            details: (err as any).errors,
        });
    }

    // 2. Generic Internal Server Error
    logger.error({ err }, "Unhandled Error");

    return res.status(500).json({
        error: "Internal Server Error",
        // requestId: req.headers["x-request-id"], 
    });
}
