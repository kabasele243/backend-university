// src/scripts/init-dynamo.ts
import { CreateTableCommand, DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
    region: "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
    credentials: {
        accessKeyId: "dummy",
        secretAccessKey: "dummy",
    },
});

const TABLE_NAME = "IdempotencyKeys";

async function init() {
    try {
        const list = await client.send(new ListTablesCommand({}));
        if (list.TableNames?.includes(TABLE_NAME)) {
            console.log(`Table ${TABLE_NAME} already exists.`);
            return;
        }

        await client.send(
            new CreateTableCommand({
                TableName: TABLE_NAME,
                KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
                AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5,
                },
            })
        );
        console.log(`Created table ${TABLE_NAME}`);
    } catch (err) {
        console.error("Error initializing DynamoDB:", err);
    }
}

init();
