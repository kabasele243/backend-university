import dotenv from 'dotenv';

dotenv.config();

export const config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  sqs: {
    queueUrl: process.env.SQS_QUEUE_URL || '',
    dlqUrl: process.env.SQS_DLQ_URL || '',
    visibilityTimeout: parseInt(process.env.VISIBILITY_TIMEOUT || '30', 10),
    pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000', 10),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'job_queue',
    connectionString: process.env.DATABASE_URL,
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
  },
};
