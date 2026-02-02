/**
 * Utility functions for text processing and character counting
 */

export const X_CHAR_LIMIT = 280;
export const X_THREAD_LIMIT = 270; // Leave room for (1/n) suffix

export interface JobData {
  title: string;
  company: string;
  location: string;
  jobType: string;
  description: string;
  applyLink: string;
  hashtags: string[];
  image?: string; // base64 encoded image
}

/**
 * Format job data into a post message for X/Twitter
 */
export function formatTwitterMessage(job: JobData): string {
  const hashtags = job.hashtags.length > 0
    ? ' ' + job.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')
    : '';

  return `🚀 ${job.title} at ${job.company}

📍 ${job.location} | ${job.jobType}

${job.description}

Apply: ${job.applyLink}${hashtags}`;
}

/**
 * Format job data into a post message for Telegram (HTML)
 */
export function formatTelegramMessage(job: JobData): string {
  const hashtags = job.hashtags.length > 0
    ? '\n\n' + job.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')
    : '';

  return `🚀 <b>${job.title}</b>

🏢 <b>Company:</b> ${job.company}
📍 <b>Location:</b> ${job.location}
💼 <b>Type:</b> ${job.jobType}

<b>Description:</b>
${job.description}

🔗 <a href="${job.applyLink}">Apply Now</a>${hashtags}`;
}

/**
 * Split text into tweet-sized chunks for threading
 */
export function splitIntoThread(text: string): string[] {
  if (text.length <= X_CHAR_LIMIT) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  // First pass: estimate number of chunks needed
  const estimatedChunks = Math.ceil(text.length / X_THREAD_LIMIT);

  while (remaining.length > 0) {
    const chunkNumber = chunks.length + 1;
    const suffix = ` (${chunkNumber}/${estimatedChunks})`;
    const maxLength = X_CHAR_LIMIT - suffix.length;

    if (remaining.length <= maxLength) {
      // Last chunk doesn't need suffix if it fits
      if (remaining.length <= X_CHAR_LIMIT && chunks.length === 0) {
        chunks.push(remaining);
      } else {
        chunks.push(remaining + suffix);
      }
      break;
    }

    // Find a good break point
    let breakPoint = maxLength;

    // Try to break at sentence end
    const sentenceEnd = remaining.lastIndexOf('. ', maxLength);
    if (sentenceEnd > maxLength * 0.5) {
      breakPoint = sentenceEnd + 1;
    } else {
      // Try to break at word boundary
      const wordBreak = remaining.lastIndexOf(' ', maxLength);
      if (wordBreak > maxLength * 0.5) {
        breakPoint = wordBreak;
      }
    }

    const chunk = remaining.slice(0, breakPoint).trim();
    chunks.push(chunk + suffix);
    remaining = remaining.slice(breakPoint).trim();
  }

  // Update chunk counts now that we know the actual number
  return chunks.map((chunk, index) => {
    const oldSuffix = new RegExp(`\\s*\\(${index + 1}/\\d+\\)$`);
    return chunk.replace(oldSuffix, ` (${index + 1}/${chunks.length})`);
  });
}

/**
 * Get character count and status
 */
export function getCharacterStatus(text: string): {
  count: number;
  remaining: number;
  isOverLimit: boolean;
  needsThread: boolean;
  threadCount: number;
} {
  const count = text.length;
  const remaining = X_CHAR_LIMIT - count;
  const isOverLimit = count > X_CHAR_LIMIT;
  const needsThread = count > X_CHAR_LIMIT;
  const threadCount = needsThread ? splitIntoThread(text).length : 1;

  return {
    count,
    remaining,
    isOverLimit,
    needsThread,
    threadCount,
  };
}

/**
 * Validate job data
 */
export function validateJobData(job: JobData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!job.title.trim()) errors.push('Job title is required');
  if (!job.company.trim()) errors.push('Company name is required');
  if (!job.location.trim()) errors.push('Location is required');
  if (!job.jobType.trim()) errors.push('Job type is required');
  if (!job.description.trim()) errors.push('Description is required');
  if (!job.applyLink.trim()) errors.push('Apply link is required');

  // Validate URL
  if (job.applyLink.trim()) {
    try {
      new URL(job.applyLink);
    } catch {
      errors.push('Apply link must be a valid URL');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
