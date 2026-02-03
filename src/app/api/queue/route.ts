import { NextResponse } from 'next/server';
import { getQueueStats, getJob } from '@/lib/jobQueue';

/**
 * GET /api/queue
 * Returns queue statistics and recent jobs for the dashboard.
 */
export async function GET() {
  try {
    const stats = await getQueueStats();

    // Enhance recent history with job details
    const historyWithDetails = await Promise.all(
      stats.recentHistory.slice(0, 10).map(async (entry) => {
        const job = await getJob(entry.id);
        return {
          id: entry.id,
          postedAt: entry.postedAt,
          title: job?.title || 'Unknown',
          company: job?.company || 'Unknown',
        };
      })
    );

    return NextResponse.json({
      success: true,
      stats: {
        pendingToday: stats.pendingToday,
        postedToday: stats.postedToday,
        totalPosted: stats.totalPosted,
      },
      pendingJobs: stats.pendingJobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        jobType: job.jobType,
        applyUrl: job.applyUrl,
        scrapedAt: job.scrapedAt,
      })),
      recentHistory: historyWithDetails,
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
