import { Redis } from '@upstash/redis';
import { ScrapedJob } from './scraper';

// Initialize Redis client - will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Key prefixes
const KEYS = {
  POSTED_ALL: 'jobs:posted:all', // Set of all job IDs ever posted
  TODAY_PENDING: (date: string) => `jobs:today:pending:${date}`,
  JOB_DATA: (id: string) => `job:${id}`,
  HISTORY: (date: string) => `history:${date}`,
};

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a job has ever been posted
 */
export async function isJobPosted(jobId: string): Promise<boolean> {
  const result = await redis.sismember(KEYS.POSTED_ALL, jobId);
  return result === 1;
}

/**
 * Add jobs to today's pending queue (skips already posted jobs)
 */
export async function addJobsForToday(jobs: ScrapedJob[]): Promise<number> {
  const today = getTodayDate();
  const pendingKey = KEYS.TODAY_PENDING(today);
  let addedCount = 0;

  for (const job of jobs) {
    // Check if already posted
    const alreadyPosted = await isJobPosted(job.id);
    if (alreadyPosted) {
      continue;
    }

    // Check if already in today's pending queue
    const inPending = await redis.sismember(pendingKey, job.id);
    if (inPending === 1) {
      continue;
    }

    // Store job data with 7 day TTL
    await redis.set(KEYS.JOB_DATA(job.id), JSON.stringify(job), { ex: 60 * 60 * 24 * 7 });

    // Add to today's pending set
    await redis.sadd(pendingKey, job.id);

    // Set TTL on pending key (24 hours)
    await redis.expire(pendingKey, 60 * 60 * 24);

    addedCount++;
  }

  return addedCount;
}

/**
 * Get unposted jobs from today's queue
 */
export async function getTodaysUnpostedJobs(limit: number = 2): Promise<ScrapedJob[]> {
  const today = getTodayDate();
  const pendingKey = KEYS.TODAY_PENDING(today);

  // Get random members from the pending set
  const jobIds = await redis.srandmember<string[]>(pendingKey, limit);

  if (!jobIds || jobIds.length === 0) {
    return [];
  }

  // Fetch job data for each ID
  const jobs: ScrapedJob[] = [];
  for (const id of jobIds) {
    const jobData = await redis.get<string>(KEYS.JOB_DATA(id));
    if (jobData) {
      const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
      jobs.push(job);
    }
  }

  return jobs;
}

/**
 * Mark jobs as posted and remove from pending queue
 */
export async function markAsPosted(jobIds: string[]): Promise<void> {
  const today = getTodayDate();
  const pendingKey = KEYS.TODAY_PENDING(today);
  const historyKey = KEYS.HISTORY(today);

  for (const id of jobIds) {
    // Add to permanent posted set
    await redis.sadd(KEYS.POSTED_ALL, id);

    // Remove from today's pending
    await redis.srem(pendingKey, id);

    // Add to history with timestamp
    await redis.hset(historyKey, {
      [id]: new Date().toISOString(),
    });
  }

  // Set TTL on history key (30 days)
  await redis.expire(historyKey, 60 * 60 * 24 * 30);
}

const DEFAULT_PAGE_SIZE = 10;

export interface QueueStatsOptions {
  pendingPage?: number;
  pendingLimit?: number;
  historyPage?: number;
  historyLimit?: number;
}

/**
 * Get queue statistics for dashboard with pagination
 */
export async function getQueueStats(opts?: QueueStatsOptions): Promise<{
  pendingToday: number;
  postedToday: number;
  totalPosted: number;
  pendingJobs: ScrapedJob[];
  pendingTotal: number;
  recentHistory: { id: string; postedAt: string }[];
  historyTotal: number;
}> {
  const today = getTodayDate();
  const pendingKey = KEYS.TODAY_PENDING(today);
  const historyKey = KEYS.HISTORY(today);

  const pendingPage = Math.max(1, opts?.pendingPage ?? 1);
  const pendingLimit = Math.min(50, Math.max(5, opts?.pendingLimit ?? DEFAULT_PAGE_SIZE));
  const historyPage = Math.max(1, opts?.historyPage ?? 1);
  const historyLimit = Math.min(50, Math.max(5, opts?.historyLimit ?? DEFAULT_PAGE_SIZE));

  // Get counts
  const pendingToday = await redis.scard(pendingKey);
  const totalPosted = await redis.scard(KEYS.POSTED_ALL);

  // Get today's history
  const todayHistory = await redis.hgetall<Record<string, string>>(historyKey);
  const postedToday = todayHistory ? Object.keys(todayHistory).length : 0;

  // Get pending jobs (paginated)
  const pendingIds = await redis.smembers<string[]>(pendingKey) ?? [];
  const pendingTotal = pendingIds.length;
  const pendingStart = (pendingPage - 1) * pendingLimit;
  const pendingPaginatedIds = pendingIds.slice(pendingStart, pendingStart + pendingLimit);
  const pendingJobs: ScrapedJob[] = [];

  for (const id of pendingPaginatedIds) {
    const jobData = await redis.get<string>(KEYS.JOB_DATA(id));
    if (jobData) {
      const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
      pendingJobs.push(job);
    }
  }

  // Format history (paginated, newest first)
  const historyEntries = todayHistory
    ? Object.entries(todayHistory).map(([id, postedAt]) => ({ id, postedAt }))
    : [];
  historyEntries.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const historyTotal = historyEntries.length;
  const historyStart = (historyPage - 1) * historyLimit;
  const recentHistory = historyEntries.slice(historyStart, historyStart + historyLimit);

  return {
    pendingToday,
    postedToday,
    totalPosted,
    pendingJobs,
    pendingTotal,
    recentHistory,
    historyTotal,
  };
}

/**
 * Get job data by ID
 */
export async function getJob(jobId: string): Promise<ScrapedJob | null> {
  const jobData = await redis.get<string>(KEYS.JOB_DATA(jobId));
  if (!jobData) return null;
  return typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
}

/**
 * Clear today's pending queue. Removes all jobs from the pending set.
 * Job data keys (job:xxx) remain until TTL expires (7 days).
 */
export async function clearPendingQueue(): Promise<number> {
  const today = getTodayDate();
  const pendingKey = KEYS.TODAY_PENDING(today);
  const count = await redis.scard(pendingKey);
  await redis.del(pendingKey);
  return count;
}

/**
 * Clear old data (run manually if needed)
 */
export async function clearOldData(daysOld: number = 30): Promise<void> {
  // This would require scanning keys, which isn't ideal
  // For now, we rely on TTLs set on individual keys
  console.log(`Cleanup not needed - keys have TTLs set (daysOld: ${daysOld})`);
}
