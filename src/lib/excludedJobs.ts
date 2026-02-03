/**
 * Job titles containing these keywords (case-insensitive) are excluded from posting.
 * Add keywords here to prevent certain jobs from being posted to Twitter/Telegram.
 */
export const EXCLUDED_JOB_TITLES: string[] = [
  'Driver',
  'Cleaner',
  'Nanny',
  'Cook',
  'Security',
];

export function isJobExcluded(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return EXCLUDED_JOB_TITLES.some(
    (keyword) => lower.includes(keyword.toLowerCase())
  );
}
