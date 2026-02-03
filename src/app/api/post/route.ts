/**
 * API Route for posting jobs to Twitter and Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { postToTwitter, getTweetUrl } from '@/lib/twitter';
import { postToTelegram } from '@/lib/telegram';
import { isJobExcluded } from '@/lib/excludedJobs';
import {
  JobData,
  formatTwitterMessage,
  formatTelegramMessage,
  validateJobData,
} from '@/lib/utils';

export interface PostRequest {
  job: JobData;
  platforms: ('twitter' | 'telegram')[];
}

export interface PostResponse {
  success: boolean;
  results: {
    twitter?: {
      success: boolean;
      tweetIds?: string[];
      tweetUrls?: string[];
      error?: string;
    };
    telegram?: {
      success: boolean;
      messageId?: number;
      error?: string;
    };
  };
  errors?: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse<PostResponse>> {
  try {
    const body: PostRequest = await request.json();
    const { job, platforms } = body;

    // Validate job data
    const validation = validateJobData(job);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          results: {},
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Reject excluded job types
    if (isJobExcluded(job.title)) {
      return NextResponse.json(
        {
          success: false,
          results: {},
          errors: ['This job type is excluded from posting'],
        },
        { status: 400 }
      );
    }

    const results: PostResponse['results'] = {};
    let hasSuccess = false;

    // Post to Twitter if requested
    if (platforms.includes('twitter')) {
      const twitterMessage = formatTwitterMessage(job);
      const twitterResult = await postToTwitter(twitterMessage, job.image);

      results.twitter = {
        success: twitterResult.success,
        tweetIds: twitterResult.tweetIds,
        tweetUrls: twitterResult.tweetIds?.map(getTweetUrl),
        error: twitterResult.error,
      };

      if (twitterResult.success) hasSuccess = true;
    }

    // Post to Telegram if requested
    if (platforms.includes('telegram')) {
      const telegramMessage = formatTelegramMessage(job);
      const telegramResult = await postToTelegram(telegramMessage, job.image);

      results.telegram = {
        success: telegramResult.success,
        messageId: telegramResult.messageId,
        error: telegramResult.error,
      };

      if (telegramResult.success) hasSuccess = true;
    }

    return NextResponse.json({
      success: hasSuccess,
      results,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        success: false,
        results: {},
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      },
      { status: 500 }
    );
  }
}
