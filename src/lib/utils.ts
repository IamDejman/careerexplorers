/**
 * Utility functions for text processing and character counting
 */

export const X_CHAR_LIMIT = 280;
export const X_PREMIUM_CHAR_LIMIT = 25000;
export const X_THREAD_LIMIT = 270; // Leave room for (1/n) suffix
export const X_PREMIUM_THREAD_LIMIT = 24990;

/** Get the character limit based on X Premium status */
export function getXCharLimit(): number {
  return process.env.NEXT_PUBLIC_TWITTER_PREMIUM === 'true'
    ? X_PREMIUM_CHAR_LIMIT
    : X_CHAR_LIMIT;
}

/** Get the thread chunk size (for splitting long posts) */
export function getXThreadLimit(): number {
  return process.env.NEXT_PUBLIC_TWITTER_PREMIUM === 'true'
    ? X_PREMIUM_THREAD_LIMIT
    : X_THREAD_LIMIT;
}

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

/** Section keys in display order */
const SECTION_ORDER = ['about', 'responsibilities', 'requirements', 'benefits', 'other'] as const;

/** Regex patterns for section headers (case-insensitive, start of line or after newline) */
const SECTION_PATTERNS: { key: (typeof SECTION_ORDER)[number]; pattern: RegExp }[] = [
  {
    key: 'about',
    pattern:
      /^(?:about\s+(?:the\s+)?role|overview|summary|introduction|the\s+role|role\s+summary)\s*:?\s*/im,
  },
  {
    key: 'responsibilities',
    pattern:
      /^(?:responsibilities|key\s+responsibilities|what\s+you(?:'ll|\s+will)?\s+do|duties|key\s+duties|your\s+role)\s*:?\s*/im,
  },
  {
    key: 'requirements',
    pattern:
      /^(?:requirements|qualifications|what\s+we(?:'re|\s+are)?\s+looking\s+for|must\s+have|must\s+haves|skills\s+required|you\s+have)\s*:?\s*/im,
  },
  {
    key: 'benefits',
    pattern:
      /^(?:benefits|perks|what\s+we\s+offer|compensation|we\s+offer|our\s+benefits)\s*:?\s*/im,
  },
];

/**
 * Parse raw job description into ordered sections (About, Responsibilities, Requirements, Benefits, Other).
 * Returns original text unchanged if no sections are detected.
 */
export function parseJobDescription(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const sections: Record<(typeof SECTION_ORDER)[number], string[]> = {
    about: [],
    responsibilities: [],
    requirements: [],
    benefits: [],
    other: [],
  };

  // Find all section headers and their positions
  type Match = { key: (typeof SECTION_ORDER)[number]; index: number; length: number };
  const matches: Match[] = [];

  for (const { key, pattern } of SECTION_PATTERNS) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(trimmed)) !== null) {
      matches.push({ key, index: m.index, length: m[0].length });
    }
  }

  if (matches.length === 0) return raw;

  // Sort by position, use first match for overlapping headers
  matches.sort((a, b) => a.index - b.index);
  const seenRanges: [number, number][] = [];
  const uniqueMatches: Match[] = [];
  for (const m of matches) {
    const overlap = seenRanges.some(([start, end]) => m.index < end && m.index + m.length > start);
    if (!overlap) {
      uniqueMatches.push(m);
      seenRanges.push([m.index, m.index + m.length]);
    }
  }

  // Extract content between headers
  const sectionLabels: Record<(typeof SECTION_ORDER)[number], string> = {
    about: 'About the role',
    responsibilities: 'Responsibilities',
    requirements: 'Requirements',
    benefits: 'Benefits',
    other: 'Other',
  };

  for (let i = 0; i < uniqueMatches.length; i++) {
    const m = uniqueMatches[i];
    const start = m.index + m.length;
    const end = uniqueMatches[i + 1]?.index ?? trimmed.length;
    const content = trimmed.slice(start, end).trim();
    if (content) sections[m.key].push(content);
  }

  // Content before first header goes to "other"
  const firstIndex = uniqueMatches[0]!.index;
  if (firstIndex > 0) {
    const before = trimmed.slice(0, firstIndex).trim();
    if (before) sections.other.push(before);
  }

  // Build output in fixed order
  const parts: string[] = [];
  for (const key of SECTION_ORDER) {
    const contents = sections[key];
    if (contents.length === 0) continue;
    if (key === 'other') {
      parts.push(contents.join('\n\n'));
    } else {
      const label = sectionLabels[key];
      parts.push(`${label}:\n${contents.join('\n\n')}`);
    }
  }

  const result = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return result || raw;
}

/**
 * Format job data into a post message for X/Twitter
 */
export function formatTwitterMessage(job: JobData): string {
  const hashtags = job.hashtags.length > 0
    ? ' ' + job.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')
    : '';

  const description = parseJobDescription(job.description);

  return `🚀 ${job.title} at ${job.company}

📍 ${job.location} | ${job.jobType}

${description}

Apply: ${job.applyLink}${hashtags}`;
}

/**
 * Format job data into a post message for Telegram (HTML)
 */
export function formatTelegramMessage(job: JobData): string {
  const hashtags = job.hashtags.length > 0
    ? '\n\n' + job.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')
    : '';

  const description = parseJobDescription(job.description);

  return `🚀 <b>${job.title}</b>

🏢 <b>Company:</b> ${job.company}
📍 <b>Location:</b> ${job.location}
💼 <b>Type:</b> ${job.jobType}

<b>Description:</b>
${description}

🔗 <a href="${job.applyLink}">Apply Now</a>${hashtags}`;
}

/**
 * Split text into tweet-sized chunks for threading
 */
export function splitIntoThread(text: string): string[] {
  const charLimit = getXCharLimit();
  const threadLimit = getXThreadLimit();

  if (text.length <= charLimit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  // First pass: estimate number of chunks needed
  const estimatedChunks = Math.ceil(text.length / threadLimit);

  while (remaining.length > 0) {
    const chunkNumber = chunks.length + 1;
    const suffix = ` (${chunkNumber}/${estimatedChunks})`;
    const maxLength = charLimit - suffix.length;

    if (remaining.length <= maxLength) {
      // Last chunk doesn't need suffix if it fits
      if (remaining.length <= charLimit && chunks.length === 0) {
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
  charLimit: number;
} {
  const charLimit = getXCharLimit();
  const count = text.length;
  const remaining = charLimit - count;
  const isOverLimit = count > charLimit;
  const needsThread = count > charLimit;
  const threadCount = needsThread ? splitIntoThread(text).length : 1;

  return {
    count,
    remaining,
    isOverLimit,
    needsThread,
    threadCount,
    charLimit,
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
