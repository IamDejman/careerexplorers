import { NextRequest, NextResponse } from 'next/server';
import { postToTwitter, getTweetUrl } from '@/lib/twitter';
import { postToTelegram } from '@/lib/telegram';

interface QuickPostRequest {
  message: string;
  image?: string;
  platforms: ('twitter' | 'telegram')[];
}

export async function POST(request: NextRequest) {
  try {
    const body: QuickPostRequest = await request.json();
    const { message, image, platforms } = body;

    // Validate
    const errors: string[] = [];
    if (!message?.trim()) errors.push('Message is required');
    if (!platforms || platforms.length === 0) errors.push('Select at least one platform');

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const results: {
      twitter?: { success: boolean; tweetUrls?: string[]; error?: string };
      telegram?: { success: boolean; error?: string };
    } = {};

    // Post to Twitter/X
    if (platforms.includes('twitter')) {
      const twitterResult = await postToTwitter(message, image);
      results.twitter = {
        success: twitterResult.success,
        tweetUrls: twitterResult.tweetIds?.map(getTweetUrl),
        error: twitterResult.error,
      };
    }

    // Post to Telegram
    if (platforms.includes('telegram')) {
      const telegramResult = await postToTelegram(message, image);
      results.telegram = {
        success: telegramResult.success,
        error: telegramResult.error,
      };
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Quick post error:', error);
    return NextResponse.json(
      { errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}
