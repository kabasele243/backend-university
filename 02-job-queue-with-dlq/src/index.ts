import { config } from './config/index.js';

console.log('Job Queue with DLQ - Starting...');
console.log(`Environment: ${config.app.nodeEnv}`);
console.log(`AWS Region: ${config.aws.region}`);

// Entry point - will be expanded with producer/consumer logic
export { config };
