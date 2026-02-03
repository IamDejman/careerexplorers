/**
 * Twitter/X API integration with threading support
 */

import { TwitterApi, SendTweetV2Params } from 'twitter-api-v2';
import { splitIntoThread, getXCharLimit } from './utils';

/**
 * Get Twitter client - lazy initialization to avoid build-time errors
 */
function getTwitterClient() {
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
  });
}

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
  // #region agent log
  const hasKey = !!process.env.TWITTER_API_KEY;
  const hasSecret = !!process.env.TWITTER_API_SECRET;
  const hasToken = !!process.env.TWITTER_ACCESS_TOKEN;
  const hasTokenSecret = !!process.env.TWITTER_ACCESS_TOKEN_SECRET;
  fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:postToTwitter:entry',message:'postToTwitter entry',data:{msgLen:message.length,hasImage:!!imageBase64,credsPresent:{hasKey,hasSecret,hasToken,hasTokenSecret}},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  try {
    // Create client at runtime, not build time
    const client = getTwitterClient();
    const rwClient = client.readWrite;

    // Check if we need to create a thread
    const charLimit = getXCharLimit();
    if (message.length <= charLimit && !imageBase64) {
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:singleTweet:before',message:'single tweet path, before v2.tweet',data:{path:'single'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      // Simple single tweet
      const tweet = await rwClient.v2.tweet(message);
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:singleTweet:success',message:'single tweet success',data:{tweetId:tweet.data.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      return {
        success: true,
        tweetIds: [tweet.data.id],
      };
    }

    // Handle image upload if provided
    let mediaId: string | undefined;
    if (imageBase64) {
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:uploadMedia:before',message:'before v1.uploadMedia',data:{path:'threadWithImage'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/png' });
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:uploadMedia:after',message:'media upload success',data:{mediaId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    }

    // Split into thread if needed
    const chunks = splitIntoThread(message);
    const tweetIds: string[] = [];
    let previousTweetId: string | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstTweet = i === 0;

      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:threadTweet:before',message:'before v2.tweet',data:{chunkIndex:i,totalChunks:chunks.length,isFirstTweet,hasMedia:!!(isFirstTweet&&mediaId)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4,H5'})}).catch(()=>{});
      // #endregion

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
    // #region agent log
    const errObj = error as Record<string, unknown>;
    const errData = errObj?.data as Record<string, unknown> | undefined;
    const errHeaders = errObj?.headers as Record<string, string | string[] | undefined> | undefined;
    const xAccessLevel = errHeaders ? (errHeaders['x-access-level'] ?? errHeaders['X-Access-Level']) : undefined;
    fetch('http://127.0.0.1:7246/ingest/412756e3-07eb-47b2-879b-f1334f11eb17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:catch',message:'Twitter API error caught',data:{code:errObj?.code,message:errObj?.message,xAccessLevel,dataDetail:errData?.detail,dataTitle:errData?.title,dataReason:errData?.reason,dataType:errData?.type,dataErrors:errData?.errors,requiredEnrollment:errData?.required_enrollment,fullData:errData},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H3,H4,H5',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    console.error('Twitter posting error:', error);
    const apiDetail = errData?.detail as string | undefined;
    const errorMessage =
      apiDetail || (error instanceof Error ? error.message : 'Unknown error occurred');
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get the URL for a tweet
 */
export function getTweetUrl(tweetId: string): string {
  return `https://twitter.com/i/web/status/${tweetId}`;
}
