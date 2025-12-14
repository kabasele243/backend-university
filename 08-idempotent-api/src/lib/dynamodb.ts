// src/lib/dynamodb.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "../config";

const client = new DynamoDBClient({
    region: "us-east-1",
    endpoint: config.DYNAMODB_ENDPOINT,
    credentials: {
        // These are dummy credentials for local DynamoDB
        accessKeyId: "dummy",
        secretAccessKey: "dummy",
    },
});

export const docClient = DynamoDBDocumentClient.from(client);

export const TABLE_NAME = "IdempotencyKeys";
