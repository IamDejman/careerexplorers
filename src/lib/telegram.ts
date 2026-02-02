/**
 * Telegram Bot API integration
 */

import axios from 'axios';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export interface TelegramPostResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Post a message to Telegram channel
 */
export async function postToTelegram(
  message: string,
  imageBase64?: string
): Promise<TelegramPostResult> {
  try {
    if (imageBase64) {
      // Post with image
      return await postPhotoToTelegram(message, imageBase64);
    } else {
      // Post text only
      return await postTextToTelegram(message);
    }
  } catch (error) {
    console.error('Telegram posting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Post text message to Telegram
 */
async function postTextToTelegram(message: string): Promise<TelegramPostResult> {
  const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: CHANNEL_ID,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });

  if (response.data.ok) {
    return {
      success: true,
      messageId: response.data.result.message_id,
    };
  }

  return {
    success: false,
    error: response.data.description || 'Failed to send message',
  };
}

/**
 * Post photo with caption to Telegram
 */
async function postPhotoToTelegram(
  caption: string,
  imageBase64: string
): Promise<TelegramPostResult> {
  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Create form data
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('chat_id', CHANNEL_ID);
  form.append('photo', buffer, { filename: 'image.png', contentType: 'image/png' });
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');

  const response = await axios.post(`${TELEGRAM_API}/sendPhoto`, form, {
    headers: form.getHeaders(),
  });

  if (response.data.ok) {
    return {
      success: true,
      messageId: response.data.result.message_id,
    };
  }

  return {
    success: false,
    error: response.data.description || 'Failed to send photo',
  };
}
