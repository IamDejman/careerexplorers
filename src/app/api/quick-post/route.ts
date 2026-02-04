import { NextRequest, NextResponse } from 'next/server';
import { postToTwitter, getTweetUrl, getTrendingHashtags } from '@/lib/twitter';
import { postToTelegram } from '@/lib/telegram';

interface QuickPostRequest {
  message: string;
  image?: string;
  platforms: ('twitter' | 'telegram')[];
}

/** Build Twitter message with trending hashtags (up to 3) or fallback defaults */
async function buildTwitterMessage(message: string): Promise<{
  twitterMessage: string;
  trendingHashtags: string[];
}> {
  const trending = await getTrendingHashtags();
  const hashtagStr =
    trending.length > 0
      ? trending
          .slice(0, 3)
          .map((t) => `#${t.replace(/^#/, '').trim()}`)
          .join(' ')
      : '#hiring #jobs #jobopening';
  return {
    twitterMessage: `${message.trim()} ${hashtagStr}`,
    trendingHashtags: trending.slice(0, 3),
  };
}

/** GET /api/quick-post?message=... - Preview with trending hashtags */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message')?.trim() ?? '';

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required for preview' },
        { status: 400 }
      );
    }

    const { twitterMessage, trendingHashtags } = await buildTwitterMessage(message);

    return NextResponse.json({
      preview: {
        twitterMessage,
        telegramMessage: message,
        trendingHashtags,
      },
    });
  } catch (error) {
    console.error('Quick post preview error:', error);
    return NextResponse.json(
      { error: 'Failed to load preview' },
      { status: 500 }
    );
  }
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

    // Post to Twitter/X (always add hashtags for Twitter - up to 3 trending, fallback to defaults)
    if (platforms.includes('twitter')) {
      const { twitterMessage } = await buildTwitterMessage(message);
      const twitterResult = await postToTwitter(twitterMessage, image);
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
