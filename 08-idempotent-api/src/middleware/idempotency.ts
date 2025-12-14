// src/middleware/idempotency.ts
import { Request, Response, NextFunction } from "express";
import { docClient, TABLE_NAME } from "../lib/dynamodb";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

type IdempotencyState = "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface IdempotencyRecord {
    id: string;
    status: IdempotencyState;
    responseBody?: any;
    responseStatus?: number;
    createdAt: number;
    ttl: number; // For DynamoDB TTL
}

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["x-idempotency-key"] as string;

    if (!key) {
        return next(); // Or return 400 if you want to enforce it
    }

    const id = `idem#${key}`;

    try {
        // 1. Try to acquire lock (Atomic "INSERT via PutItem if not exists")
        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    id,
                    status: "IN_PROGRESS",
                    createdAt: Date.now(),
                    ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h expiration
                },
                ConditionExpression: "attribute_not_exists(id)",
            })
        );

        // Lock acquired! We are the first.
        // Hook into response to save the result
        const originalSend = res.send;
        const originalJson = res.json;

        let responseBody: any;

        // Override res.json/send directly
        res.json = function (body) {
            responseBody = body;
            return originalJson.call(this, body);
        };

        res.send = function (body) {
            if (typeof body === "string") {
                try {
                    responseBody = JSON.parse(body);
                } catch {
                    responseBody = body;
                }
            } else {
                responseBody = body;
            }
            return originalSend.call(this, body);
        };

        // When request finishes, update DynamoDB
        res.on("finish", async () => {
            // If we crashed or errored, we might want to release the lock or mark FAILED.
            // For now, let's assume if status is 2xx/3xx/4xx we save it.
            if (res.statusCode >= 500) {
                // Server error: Release lock so they can retry? 
                // Or mark FAILED? Let's mark FAILED and allow retry logic to handle it if needed.
                // Actually, deleting it often better for 500s so retry works.
                // But for this demo, let's just save the 500 response.
            }

            try {
                await docClient.send(
                    new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { id },
                        UpdateExpression: "SET #s = :s, responseBody = :b, responseStatus = :st",
                        ExpressionAttributeNames: { "#s": "status" },
                        ExpressionAttributeValues: {
                            ":s": "COMPLETED",
                            ":b": responseBody,
                            ":st": res.statusCode
                        }
                    })
                )
            } catch (err) {
                console.error("Failed to save idempotency result", err);
            }
        });

        next();

    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            // Lock failed - resource exists. Check its state.
            const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }));

            if (!Item) {
                // Should happen rarely (TTL expired between check?)
                return next();
            }

            if (Item.status === "IN_PROGRESS") {
                return res.status(409).json({ error: "Request in progress" });
            }

            if (Item.status === "COMPLETED") {
                return res.status(Item.responseStatus || 200).json(Item.responseBody);
            }
        }

        console.error("Idempotency Error:", err);
        next(err);
    }
};
