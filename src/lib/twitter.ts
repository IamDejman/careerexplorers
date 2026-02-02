/**
 * Twitter/X API integration with threading support
 */

import { TwitterApi, SendTweetV2Params } from 'twitter-api-v2';
import { splitIntoThread, X_CHAR_LIMIT } from './utils';

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
});

export interface TwitterPostResult {
  success: boolean;
  tweetIds?: string[];
  error?: string;
}

/**
 * Post a single tweet or thread to Twitter/X
 */
export async function postToTwitter(
  message: string,
  imageBase64?: string
): Promise<TwitterPostResult> {
  try {
    const rwClient = client.readWrite;

    // Check if we need to create a thread
    if (message.length <= X_CHAR_LIMIT && !imageBase64) {
      // Simple single tweet
      const tweet = await rwClient.v2.tweet(message);
      return {
        success: true,
        tweetIds: [tweet.data.id],
      };
    }

    // Handle image upload if provided
    let mediaId: string | undefined;
    if (imageBase64) {
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/png' });
    }

    // Split into thread if needed
    const chunks = splitIntoThread(message);
    const tweetIds: string[] = [];
    let previousTweetId: string | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstTweet = i === 0;

      const tweetData: SendTweetV2Params = {
        text: chunk,
      };

      // Reply to previous tweet if this is part of a thread
      if (previousTweetId) {
        tweetData.reply = { in_reply_to_tweet_id: previousTweetId };
      }

      // Attach image to first tweet only
      if (isFirstTweet && mediaId) {
        tweetData.media = { media_ids: [mediaId] as [string] };
      }

      const tweet = await rwClient.v2.tweet(tweetData);
      tweetIds.push(tweet.data.id);
      previousTweetId = tweet.data.id;
    }

    return {
      success: true,
      tweetIds,
    };
  } catch (error) {
    console.error('Twitter posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get the URL for a tweet
 */
export function getTweetUrl(tweetId: string): string {
  return `https://twitter.com/i/web/status/${tweetId}`;
}
