import { NextResponse } from 'next/server';
import { clearPendingQueue } from '@/lib/jobQueue';

/**
 * POST /api/queue/clear
 * Clears today's pending job queue.
 */
export async function POST() {
  try {
    const clearedCount = await clearPendingQueue();

    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedCount} pending job(s)`,
      clearedCount,
    });
  } catch (error) {
    console.error('Clear queue error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
