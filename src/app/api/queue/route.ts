import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, getJob } from '@/lib/jobQueue';

/**
 * GET /api/queue
 * Returns queue statistics and paginated jobs for the dashboard.
 * Query params: pendingPage, pendingLimit, historyPage, historyLimit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const opts = {
      pendingPage: parseInt(searchParams.get('pendingPage') ?? '1', 10),
      pendingLimit: parseInt(searchParams.get('pendingLimit') ?? '10', 10),
      historyPage: parseInt(searchParams.get('historyPage') ?? '1', 10),
      historyLimit: parseInt(searchParams.get('historyLimit') ?? '10', 10),
    };

    const stats = await getQueueStats(opts);

    // Enhance recent history with job details
    const historyWithDetails = await Promise.all(
      stats.recentHistory.map(async (entry) => {
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
      pendingTotal: stats.pendingTotal,
      recentHistory: historyWithDetails,
      historyTotal: stats.historyTotal,
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
