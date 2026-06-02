import dotenv from "dotenv";
import { Queue } from "bullmq";

dotenv.config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
if (!redisUrl) {
  throw new Error("Missing REDIS_URL or REDIS_TLS_URL for BullMQ queue connection.");
}

export const resumeReviewQueue = new Queue("resume-review", { connection: { url: redisUrl } });
export const sessionAnalyticsQueue = new Queue("session-analytics", { connection: { url: redisUrl } });
export const reportGenerationQueue = new Queue("report-generation", { connection: { url: redisUrl } });
