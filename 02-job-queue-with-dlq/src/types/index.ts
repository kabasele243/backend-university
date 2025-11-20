export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobMessage {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempt: number;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';

export interface JobResult {
  jobId: string;
  status: JobStatus;
  result?: Record<string, unknown>;
  error?: string;
  processedAt: Date;
}
