import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { getTodaysUnpostedJobs, markAsPosted } from '@/lib/jobQueue';
import { formatConciseTwitterJob, formatConciseTelegramJob, ConciseJobData } from '@/lib/utils';
import { postToTwitter, getTweetUrl } from '@/lib/twitter';
import { postToTelegram } from '@/lib/telegram';

/**
 * Get QStash Receiver - lazy initialization to ensure env vars are available
 */
function getReceiver() {
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
  });
}

/**
 * Verify the request is from QStash or has valid CRON_SECRET
 */
async function verifyRequest(request: Request): Promise<boolean> {
  // Check for QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature) {
    try {
      const body = await request.text();
      const receiver = getReceiver();
      const isValid = await receiver.verify({
        signature,
        body,
        url: request.url,
      });
      return isValid;
    } catch {
      return false;
    }
  }

  // Fallback to CRON_SECRET for manual/dashboard triggers
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Allow in development without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

/**
 * POST /api/auto-post (QStash uses POST)
 * GET /api/auto-post (for manual/dashboard triggers)
 * Posts up to 2 unposted jobs from today's queue to Twitter and Telegram.
 * Skips if no jobs available.
 */
export async function POST(request: Request) {
  const isValid = await verifyRequest(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleAutoPost();
}

export async function GET(request: Request) {
  const isValid = await verifyRequest(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleAutoPost();
}

async function handleAutoPost() {
  try {
    console.log('Starting auto-post...');

    // Get up to 2 unposted jobs from today's queue
    const jobs = await getTodaysUnpostedJobs(2);

    if (jobs.length === 0) {
      console.log('No unposted jobs available, skipping this cycle');
      return NextResponse.json({
        success: true,
        message: 'No unposted jobs available, skipping this cycle',
        posted: 0,
      });
    }

    const results: {
      jobId: string;
      title: string;
      twitter: { success: boolean; tweetUrl?: string; error?: string };
      telegram: { success: boolean; messageId?: number; error?: string };
    }[] = [];

    const postedJobIds: string[] = [];

    for (const job of jobs) {
      // Convert ScrapedJob to ConciseJobData
      const conciseJob: ConciseJobData = {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        jobType: job.jobType,
        description: job.description,
        applyUrl: job.applyUrl,
        sourceUrl: job.sourceUrl,
      };

      // Format messages
      const twitterMessage = formatConciseTwitterJob(conciseJob);
      const telegramMessage = formatConciseTelegramJob(conciseJob);

      console.log(`Posting job: ${job.title} at ${job.company}`);

      // Post to Twitter
      const twitterResult = await postToTwitter(twitterMessage);

      // Post to Telegram
      const telegramResult = await postToTelegram(telegramMessage);

      // Track result
      const jobResult = {
        jobId: job.id,
        title: `${job.title} at ${job.company}`,
        twitter: {
          success: twitterResult.success,
          tweetUrl: twitterResult.success && twitterResult.tweetIds?.[0]
            ? getTweetUrl(twitterResult.tweetIds[0])
            : undefined,
          error: twitterResult.error,
        },
        telegram: {
          success: telegramResult.success,
          messageId: telegramResult.messageId,
          error: telegramResult.error,
        },
      };

      results.push(jobResult);

      // Only mark as posted if at least one platform succeeded
      if (twitterResult.success || telegramResult.success) {
        postedJobIds.push(job.id);
      }

      // Small delay between posts to avoid rate limits
      if (jobs.indexOf(job) < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Mark successfully posted jobs
    if (postedJobIds.length > 0) {
      await markAsPosted(postedJobIds);
    }

    console.log(`Auto-post complete: ${postedJobIds.length} jobs posted`);

    return NextResponse.json({
      success: true,
      message: `Posted ${postedJobIds.length} job(s) to Twitter and Telegram`,
      posted: postedJobIds.length,
      results,
    });
  } catch (error) {
    console.error('Auto-post error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
