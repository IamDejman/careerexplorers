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
      /^(?:requirements|qualifications|qualification\s*(?:&|and)\s*experience|what\s+we(?:'re|\s+are)?\s+looking\s+for|must\s+have|must\s+haves|skills\s+required|you\s+have)\s*:?\s*/im,
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

/** Result of parsing pasted job text */
export interface ParsedJob {
  title: string;
  company: string;
  location: string;
  jobType: string;
  description: string;
  applyLink: string;
  suggestedHashtags: string[];
}

const JOB_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Freelance',
  'Internship',
  'Remote',
  'Hybrid',
] as const;

/**
 * Parse pasted raw job text to extract title, company, location, job type, description, and apply link/email.
 */
export function parsePastedJob(raw: string): ParsedJob {
  const text = raw.trim();
  const result: ParsedJob = {
    title: '',
    company: '',
    location: '',
    jobType: '',
    description: '',
    applyLink: '',
    suggestedHashtags: [],
  };

  if (!text) return result;

  // Extract apply URL (prioritize career/apply links)
  const urlRegex =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
  const urls = text.match(urlRegex) || [];
  const applyUrl =
    urls.find(
      (u) =>
        /apply|career|job|position|recruit/i.test(u) || u.includes('linkedin.com/jobs')
    ) || urls[0] || '';

  // Extract apply email
  const emailRegex =
    /(?:apply|send|email|contact)\s*(?:to|at)?\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const emailMatch = emailRegex.exec(text);
  const applyEmail = emailMatch?.[1] || '';
  const standaloneEmail = text.match(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/
  )?.[0];

  result.applyLink = applyUrl || (applyEmail ? `mailto:${applyEmail}` : '') || (standaloneEmail ? `mailto:${standaloneEmail}` : '');

  // Extract job type
  const typeRegex = new RegExp(
    `\\b(${JOB_TYPES.map((t) => t.replace('-', '[- ]?')).join('|')})\\b`,
    'gi'
  );
  const typeMatch = text.match(typeRegex);
  if (typeMatch) {
    const normalized = typeMatch[0]!.toLowerCase();
    result.jobType =
      normalized.includes('full') ? 'Full-time'
      : normalized.includes('part') ? 'Part-time'
      : normalized.includes('contract') ? 'Contract'
      : normalized.includes('freelance') ? 'Freelance'
      : normalized.includes('intern') ? 'Internship'
      : normalized.includes('remote') ? 'Remote'
      : normalized.includes('hybrid') ? 'Hybrid'
      : '';
  }

  // Extract labeled fields (common patterns)
  type StringField = 'title' | 'company' | 'location';
  const labelPatterns: { key: StringField; patterns: RegExp[] }[] = [
    {
      key: 'title',
      patterns: [
        /(?:job\s+title|position|role|title)\s*:?\s*([^\n]+)/i,
        /(?:we(?:'re|\s+are)\s+hiring\s+(?:a|an)?)\s*([^\n.!?]+)/i,
        /^(?:#\s*)?([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Manager|Designer|Analyst|Specialist|Lead|Director)[^\n]*)/m,
      ],
    },
    {
      key: 'company',
      patterns: [
        /(?:company|organization|employer|about)\s*:?\s*([^\n]+)/i,
        /(?:at|@)\s+([A-Za-z0-9\s&.,'-]+?)(?:\s*[|\-–]\s|$|\n)/,
        /(?:join|work\s+with)\s+([A-Za-z0-9\s&.,'-]+)/i,
      ],
    },
    {
      key: 'location',
      patterns: [
        /(?:location|based\s+in|work\s+from|office)\s*:?\s*([^\n]+)/i,
        /(?:remote|hybrid|onsite|in-office)\s*(?:-?\s*([^\n]+))?/i,
      ],
    },
  ];

  for (const { key, patterns } of labelPatterns) {
    if (result[key]) continue;
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const val = m[1].trim();
        if (val.length > 1 && val.length < 200) {
          result[key] = val;
          break;
        }
      }
    }
  }

  // Fallback: first line often = title, look for "at Company"
  if (!result.title) {
    const firstLine = text.split('\n')[0]?.trim() || '';
    const atMatch = firstLine.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      result.title = atMatch[1]!.trim();
      if (!result.company) result.company = atMatch[2]!.trim();
    } else if (firstLine && firstLine.length < 100 && !firstLine.startsWith('http')) {
      result.title = firstLine;
    }
  }

  // Fallback: location from Remote/Hybrid in text
  if (!result.location && /remote|hybrid|distributed/i.test(text)) {
    result.location = result.jobType === 'Remote' ? 'Remote' : result.jobType === 'Hybrid' ? 'Hybrid' : 'Remote';
  }
  if (!result.location) result.location = 'Not specified';

  // Description: remove extracted apply URLs, emails, and labeled lines; use rest
  let desc = text;
  if (applyUrl) desc = desc.replace(applyUrl, '');
  if (applyEmail) desc = desc.replace(applyEmail, '');
  if (standaloneEmail && !applyEmail) desc = desc.replace(standaloneEmail!, '');
  desc = desc.replace(/apply\s*(?:to|at|here)?\s*:?\s*/gi, '');
  desc = desc.replace(/\n{3,}/g, '\n\n').trim();
  if (desc) result.description = parseJobDescription(desc);

  result.suggestedHashtags = suggestHashtags(result);
  return result;
}

/**
 * Suggest hashtags based on parsed job data.
 */
export function suggestHashtags(parsed: Partial<ParsedJob>): string[] {
  const tags = new Set<string>(['hiring', 'jobopening', 'jobs']);

  if (parsed.title) {
    const title = parsed.title.toLowerCase();
    if (/engineer|developer|dev/i.test(title)) tags.add('techjobs');
    if (/software|swe|sde/i.test(title)) tags.add('softwareengineering');
    if (/designer|design/i.test(title)) tags.add('design');
    if (/manager|lead|director/i.test(title)) tags.add('leadership');
    if (/data|analyst|scientist/i.test(title)) tags.add('data');
    if (/product/i.test(title)) tags.add('productmanagement');
    if (/remote/i.test(title)) tags.add('remotework');
  }

  if (parsed.jobType) {
    if (parsed.jobType === 'Remote') {
      tags.add('remote');
      tags.add('remotework');
      tags.add('workfromhome');
    }
    if (parsed.jobType === 'Hybrid') tags.add('hybrid');
    if (parsed.jobType === 'Internship') tags.add('internship');
    if (parsed.jobType === 'Contract') tags.add('contract');
    if (parsed.jobType === 'Freelance') tags.add('freelance');
  }

  if (parsed.company) tags.add('careers');

  return Array.from(tags);
}

/**
 * Normalize apply link: if it's a plain email, return mailto: form for href; otherwise return as-is.
 */
function getApplyHref(applyLink: string): string {
  const val = applyLink.trim();
  if (!val) return val;
  if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('mailto:')) {
    return val;
  }
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)) {
    return `mailto:${val}`;
  }
  return val;
}

/** Check if apply link is an email (mailto: or plain email) */
function isEmailApplyLink(applyLink: string): boolean {
  const val = applyLink.trim();
  if (!val) return false;
  if (val.startsWith('mailto:')) return true;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
}

/** Extract plain email from mailto: or return as-is if already plain email */
function getDisplayEmail(applyLink: string): string {
  const val = applyLink.trim();
  if (!val) return '';
  if (val.startsWith('mailto:')) return val.slice(7).trim();
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)) return val;
  return '';
}

/** Check if URL is a MyJobMag job page */
function isMyJobMagUrl(url: string): boolean {
  const val = url.trim();
  if (!val) return false;
  return /myjobmag\.com\/job\//i.test(val) || /myjobmag\.com\/job$/i.test(val);
}

/**
 * Format apply section.
 * - Email: "Interested and qualified candidates should send their CVs to: {email}" (plain text, no link)
 * - MyJobMag URL: "Interested and qualified? Apply via the original listing." (no link)
 * - External URL: "Apply Now" as link, URL on next line for Twitter
 */
export function formatApplySection(
  applyLink: string,
  _company: string,
  forTelegram: boolean,
  sourceUrl?: string
): string {
  const val = applyLink.trim();
  if (!val) return '';

  // Email: show as plain text, not link
  if (isEmailApplyLink(val)) {
    const email = getDisplayEmail(val);
    if (email) {
      return `Interested and qualified candidates should send their CVs to: ${email}`;
    }
  }

  // MyJobMag URL or same as source: don't show link
  if (isMyJobMagUrl(val) || (sourceUrl && val === sourceUrl)) {
    return 'Interested and qualified? Apply via the original listing.';
  }

  // External URL: Apply Now as link
  const href = getApplyHref(val);
  if (forTelegram) {
    return `Interested and qualified? <a href="${href}">Apply Now</a>.`;
  }
  return `Interested and qualified? Apply Now.\n${val}`;
}

/**
 * Strip metadata clutter from description (dates, location/type lines, title repetition)
 */
export function stripMetadataFromDescription(desc: string): string {
  let out = desc
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s*\d{4}\b/gi, '')
    .replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s*\d{4}\b/gi, '')
    .replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s*/gi, '')
    .replace(/\bPosted:\s*[^\n]+/gi, '')
    .replace(/\bDeadline:\s*[^\n]+/gi, '')
    .replace(/\b[A-Za-z\s]+\s*\|\s*(?:Remote|Full Time|Part Time|Contract|Hybrid)\s*Jobs?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out;
}

/** Ensure description has About the role; prepend fallback when missing */
function ensureAboutSection(parsedDesc: string, company: string, title: string): string {
  if (/about\s+the\s+role:/i.test(parsedDesc) || /^about\s+the\s+role\s*:/im.test(parsedDesc)) {
    return parsedDesc;
  }
  const fallback = `About the role:\n${company} is hiring a ${title}.\n\n`;
  return fallback + parsedDesc;
}

/**
 * Truncate text at word boundary for Twitter character limit.
 */
export function truncateForTwitter(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.5) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

/** Extract first sentence or intro for "We're hiring!" line */
function getFirstSentence(text: string, maxChars: number = 120): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const firstPeriod = trimmed.indexOf('. ');
  const firstNewline = trimmed.indexOf('\n');
  let end = trimmed.length;
  if (firstPeriod > 0 && firstPeriod < maxChars) end = Math.min(end, firstPeriod + 1);
  if (firstNewline > 0 && firstNewline < maxChars) end = Math.min(end, firstNewline);
  const sentence = trimmed.slice(0, end).trim();
  return truncateForTwitter(sentence, maxChars);
}

/** Parse jobType into location part (Remote/Hybrid) and type part (Full Time, etc.) */
function parseLocationAndType(location: string, jobType: string): { locationLine: string; typeLine: string } {
  const loc = location.trim();
  const type = jobType.trim();
  if (!type) return { locationLine: loc, typeLine: '' };
  const parts = type.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const workArrangement = parts[0]!; // e.g. Remote
    const employmentType = parts.slice(1).join(' | '); // e.g. Full Time
    const locationLine = loc ? `${loc} | ${workArrangement}` : workArrangement;
    return { locationLine, typeLine: employmentType };
  }
  const locationLine = loc && type ? `${loc} | ${type}` : loc || type;
  return { locationLine, typeLine: '' };
}

/**
 * Format job data into a post message for X/Twitter
 */
export function formatTwitterMessage(job: JobData): string {
  const hashtags = job.hashtags.length > 0
    ? ' ' + job.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')
    : '';

  const description = parseJobDescription(job.description);
  const firstSentence = getFirstSentence(job.description, 100);

  const header = job.company.trim()
    ? `${job.title} at ${job.company}`
    : job.title;

  const { locationLine, typeLine } = parseLocationAndType(job.location, job.jobType);
  const metaLines: string[] = [];
  if (locationLine) metaLines.push(locationLine);
  if (typeLine) metaLines.push(typeLine);
  const metaBlock = metaLines.length > 0 ? '\n' + metaLines.join('\n') + '\n\n' : '\n\n';

  const applySection = formatApplySection(job.applyLink, job.company, false);

  const intro = firstSentence
    ? `We're hiring! ${firstSentence}${firstSentence.endsWith('.') ? '' : '.'}\n\n`
    : '';

  return `${header}${metaBlock}${intro}${description}

${applySection}${hashtags}`;
}

/**
 * Format job data into a post message for Telegram (HTML)
 * Note: Hashtags are omitted - used for Twitter only.
 */
export function formatTelegramMessage(job: JobData): string {
  const description = parseJobDescription(job.description);
  const firstSentence = getFirstSentence(job.description, 100);

  const header = job.company.trim()
    ? `<b>${job.title} at ${job.company}</b>`
    : `<b>${job.title}</b>`;

  const metaLines: string[] = [];
  if (job.company.trim()) metaLines.push(`<b>Company:</b> ${job.company}`);
  if (job.location.trim()) metaLines.push(`<b>Location:</b> ${job.location}`);
  if (job.jobType.trim()) metaLines.push(`<b>Type:</b> ${job.jobType}`);
  const metaBlock = metaLines.length > 0 ? metaLines.join('\n') + '\n\n' : '';

  const intro = firstSentence
    ? `We're hiring! ${firstSentence}${firstSentence.endsWith('.') ? '' : '.'}\n\n`
    : '';

  const applySection = formatApplySection(job.applyLink, job.company, true);

  return `${header}

${metaBlock}${intro}${description}

${applySection}`;
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

// ============================================
// CONCISE FORMATTERS FOR AUTOMATED POSTING
// ============================================

export interface ConciseJobData {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  description: string;
  applyUrl: string;
  sourceUrl: string;
}

/** Job-relevant keywords to prefer from trending hashtags */
const JOB_RELEVANT_KEYWORDS = /job|hire|career|lagos|nigeria|remote|tech|work|recruit/i;

/**
 * Generate hashtags for a scraped job.
 * Merges trending hashtags (when provided) with job-specific hashtags.
 * Prioritizes job-relevant trending hashtags, then job-specific, then other trending.
 * Limit: 5 hashtags max.
 */
export function generateJobHashtags(job: ConciseJobData, trendingHashtags?: string[]): string[] {
  const jobTags: string[] = [];

  // Location-based hashtags
  const locationLower = job.location.toLowerCase();
  if (locationLower.includes('lagos')) jobTags.push('Lagos');
  if (locationLower.includes('abuja')) jobTags.push('Abuja');
  if (locationLower.includes('port harcourt')) jobTags.push('PortHarcourt');
  if (locationLower.includes('remote')) jobTags.push('RemoteJobs');

  // Job type hashtags
  const typeLower = job.jobType.toLowerCase();
  if (typeLower.includes('full')) jobTags.push('FullTime');
  if (typeLower.includes('part')) jobTags.push('PartTime');
  if (typeLower.includes('intern')) jobTags.push('Internship');
  if (typeLower.includes('contract')) jobTags.push('Contract');

  // Title-based hashtags
  const titleLower = job.title.toLowerCase();
  if (/engineer|developer|programmer|software/i.test(titleLower)) jobTags.push('TechJobs');
  if (/manager|management/i.test(titleLower)) jobTags.push('Management');
  if (/sales|business\s+development/i.test(titleLower)) jobTags.push('Sales');
  if (/marketing|brand/i.test(titleLower)) jobTags.push('Marketing');
  if (/finance|accountant|accounting/i.test(titleLower)) jobTags.push('Finance');
  if (/hr|human\s+resource/i.test(titleLower)) jobTags.push('HR');
  if (/design|creative/i.test(titleLower)) jobTags.push('Design');
  if (/data|analyst/i.test(titleLower)) jobTags.push('DataJobs');

  // Always include these if not already present
  if (!jobTags.some((t) => /nigeriajobs/i.test(t))) jobTags.unshift('NigeriaJobs');
  if (!jobTags.some((t) => /hiring/i.test(t))) jobTags.unshift('Hiring');

  // Merge: up to 3 trending (prefer job-relevant) + up to 2 job-specific = 5 max
  const seen = new Set<string>();
  const result: string[] = [];

  if (trendingHashtags && trendingHashtags.length > 0) {
    const jobRelevant = trendingHashtags.filter((t) => JOB_RELEVANT_KEYWORDS.test(t));
    const toAdd = [...jobRelevant, ...trendingHashtags.filter((t) => !jobRelevant.includes(t))].slice(0, 3);
    for (const t of toAdd) {
      const normalized = t.replace(/^#/, '').trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
  }

  for (const tag of jobTags) {
    const normalized = tag.replace(/^#/, '').trim();
    if (normalized && !seen.has(normalized) && result.length < 5) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result.slice(0, 5);
}

/**
 * Format a scraped job for Twitter (concise format)
 * Designed for automated posting - short and punchy, fits ~280 chars when possible.
 * Pass trendingHashtags to include real-time trending hashtags from Twitter.
 */
export function formatConciseTwitterJob(job: ConciseJobData, trendingHashtags?: string[]): string {
  const hashtags = generateJobHashtags(job, trendingHashtags);
  const hashtagStr = hashtags.map(t => `#${t}`).join(' ');

  const header = `${job.title} at ${job.company}`;
  const sanitized = stripMetadataFromDescription(job.description);
  const parsedDesc = parseJobDescription(sanitized);
  const withAbout = ensureAboutSection(parsedDesc, job.company, job.title);
  const firstSentence = getFirstSentence(sanitized, 80);
  const intro = firstSentence
    ? `We're hiring! ${firstSentence}${firstSentence.endsWith('.') ? '' : '.'}\n\n`
    : '';

  const applySection = formatApplySection(job.applyUrl, job.company, false, job.sourceUrl);

  const charLimit = getXCharLimit();
  const reserved = header.length + intro.length + applySection.length + hashtagStr.length + 30;
  const descBudget = Math.max(80, charLimit - reserved);
  const description = truncateForTwitter(withAbout, descBudget);

  return `${header}

${intro}${description}

${applySection}

${hashtagStr}`;
}

/**
 * Format a scraped job for Telegram (concise HTML format)
 * Designed for automated posting - clean and readable
 */
export function formatConciseTelegramJob(job: ConciseJobData): string {
  const header = `<b>${escapeHtml(job.title)} at ${escapeHtml(job.company)}</b>`;

  const sanitized = stripMetadataFromDescription(job.description);
  const parsedDesc = parseJobDescription(sanitized);
  const withAbout = ensureAboutSection(parsedDesc, job.company, job.title);
  const firstSentence = getFirstSentence(sanitized, 80);
  const intro = firstSentence
    ? `We're hiring! ${firstSentence}${firstSentence.endsWith('.') ? '' : '.'}\n\n`
    : '';

  const applySection = formatApplySection(job.applyUrl, job.company, true, job.sourceUrl);

  return `${header}

${intro}${withAbout}

${applySection}`;
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================
// EXISTING VALIDATION
// ============================================

/**
 * Validate job data
 */
export function validateJobData(job: JobData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!job.title.trim()) errors.push('Job title is required');
  if (!job.description.trim()) errors.push('Description is required');
  if (!job.applyLink.trim()) errors.push('Apply link or email is required');

  // Validate URL or email
  if (job.applyLink.trim()) {
    const val = job.applyLink.trim();
    const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
    const hasProtocol = val.startsWith('http://') || val.startsWith('https://') || val.startsWith('mailto:');
    if (isEmail) {
      // Valid email
    } else if (hasProtocol) {
      try {
        new URL(val);
      } catch {
        errors.push('Apply link must be a valid URL or email address');
      }
    } else {
      errors.push('Apply link must be a valid URL (include https://) or email address');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
