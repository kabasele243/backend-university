// src/test/setup.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { execSync } from "child_process";
import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { PrismaClient } from "@prisma/client";

let postgresContainer: StartedPostgreSqlContainer;
let dynamoContainer: StartedTestContainer;
let prisma: PrismaClient;
let dynamoClient: DynamoDBClient;

export async function setupTestEnvironment() {
    // 1. Start Postgres
    postgresContainer = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("test_db")
        .withUsername("test_user")
        .withPassword("test_password")
        .start();

    const dbUrl = postgresContainer.getConnectionUri();
    process.env.DATABASE_URL = dbUrl;

    // 2. Start DynamoDB Local
    dynamoContainer = await new GenericContainer("amazon/dynamodb-local:latest")
        .withExposedPorts(8000)
        .withCommand(["-jar", "DynamoDBLocal.jar", "-sharedDb", "-inMemory"])
        .withWaitStrategy(Wait.forLogMessage("CorsParams:"))
        .start();

    const dynamoPort = dynamoContainer.getMappedPort(8000);
    const dynamoEndpoint = `http://localhost:${dynamoPort}`;
    process.env.DYNAMODB_ENDPOINT = dynamoEndpoint;

    // Set other required envs
    process.env.NODE_ENV = "test";
    process.env.PORT = "3001";

    // 3. Run Prisma Migrations
    execSync(`npx prisma db push --accept-data-loss`, {
        env: { ...process.env, DATABASE_URL: dbUrl },
    });

    // 4. Create DynamoDB Table
    dynamoClient = new DynamoDBClient({
        endpoint: dynamoEndpoint,
        region: "us-east-1",
        credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });

    await dynamoClient.send(new CreateTableCommand({
        TableName: "IdempotencyKeys",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
    }));

    return {
        dbUrl,
        dynamoEndpoint,
        postgresContainer,
        dynamoContainer
    };
}

export async function teardownTestEnvironment() {
    await postgresContainer?.stop();
    await dynamoContainer?.stop();
}
