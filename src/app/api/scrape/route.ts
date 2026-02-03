import { NextResponse } from 'next/server';
import { scrapeLatestJobs } from '@/lib/scraper';
import { addJobsForToday, getQueueStats } from '@/lib/jobQueue';

/**
 * GET /api/scrape
 * Scrapes jobs from MyJobMag and adds new ones to today's queue.
 * Protected by CRON_SECRET for production use.
 */
export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting job scrape...');

    // Scrape latest jobs (limit to 30 per run)
    const jobs = await scrapeLatestJobs(30);

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No jobs found to scrape',
        scraped: 0,
        added: 0,
      });
    }

    // Add to today's queue (skips already posted jobs)
    const addedCount = await addJobsForToday(jobs);

    // Get updated stats
    const stats = await getQueueStats();

    console.log(`Scrape complete: ${jobs.length} scraped, ${addedCount} added to queue`);

    return NextResponse.json({
      success: true,
      message: `Scraped ${jobs.length} jobs, added ${addedCount} new jobs to queue`,
      scraped: jobs.length,
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
