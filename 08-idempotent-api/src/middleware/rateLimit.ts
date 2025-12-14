import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        logger.warn({ ip: req.ip }, "Rate limit exceeded");
        res.status(options.statusCode).send(options.message);
    },
});
