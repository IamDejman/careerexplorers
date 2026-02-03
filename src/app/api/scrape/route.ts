import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { scrapeLatestJobs } from '@/lib/scraper';
import { addJobsForToday, getQueueStats } from '@/lib/jobQueue';
import { isJobExcluded } from '@/lib/excludedJobs';

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
 * Verify the request is from QStash (for POST) or allow GET requests (from dashboard)
 */
async function verifyRequest(request: Request): Promise<boolean> {
  // Allow GET requests (from dashboard) without auth
  if (request.method === 'GET') {
    return true;
  }

  // For POST requests, check for QStash signature
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

  // Fallback to CRON_SECRET for other POST requests
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
 * POST /api/scrape (QStash uses POST)
 * GET /api/scrape (for manual/dashboard triggers)
 * Scrapes jobs from MyJobMag and adds new ones to today's queue.
 */
export async function POST(request: Request) {
  const isValid = await verifyRequest(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleScrape();
}

export async function GET(request: Request) {
  const isValid = await verifyRequest(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleScrape();
}

async function handleScrape() {
  try {
    console.log('Starting job scrape...');

    // Scrape latest jobs (limit to 30 per run)
    const scrapedJobs = await scrapeLatestJobs(30);

    // Filter out excluded job titles before adding to queue
    const jobs = scrapedJobs.filter((j) => !isJobExcluded(j.title));

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: scrapedJobs.length === 0
          ? 'No jobs found to scrape'
          : `All ${scrapedJobs.length} scraped jobs were excluded`,
        scraped: scrapedJobs.length,
        added: 0,
      });
    }

    // Add to today's queue (skips already posted jobs)
    const addedCount = await addJobsForToday(jobs);

    // Get updated stats
    const stats = await getQueueStats();

    console.log(`Scrape complete: ${scrapedJobs.length} scraped, ${jobs.length} after exclusions, ${addedCount} added to queue`);

    return NextResponse.json({
      success: true,
      message: `Scraped ${scrapedJobs.length} jobs, added ${addedCount} new jobs to queue`,
      scraped: scrapedJobs.length,
      added: addedCount,
      pendingToday: stats.pendingToday,
      totalPosted: stats.totalPosted,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
