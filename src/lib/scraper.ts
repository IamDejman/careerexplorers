import * as cheerio from 'cheerio';
import crypto from 'crypto';

export interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  description: string;
  applyUrl: string;
  sourceUrl: string;
  scrapedAt: string;
}

const BASE_URL = 'https://www.myjobmag.com';
const USER_AGENT = 'CareerExplorerBot/1.0 (Job Aggregator; contact@example.com)';

/**
 * Generate a unique ID for a job based on its URL
 */
function generateJobId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
}

/**
 * Fetch HTML from a URL with proper headers
 */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

/**
 * Extract job URLs from the main listings page
 */
async function getJobUrls(listingsUrl: string = `${BASE_URL}/jobs`): Promise<string[]> {
  const html = await fetchPage(listingsUrl);
  const $ = cheerio.load(html);

  const jobUrls: string[] = [];

  // Find all job links - they follow the pattern /job/[slug]
  $('a[href^="/job/"]').each((_, element) => {
    const href = $(element).attr('href');
    if (href && !href.includes('/job-application/')) {
      const fullUrl = `${BASE_URL}${href}`;
      if (!jobUrls.includes(fullUrl)) {
        jobUrls.push(fullUrl);
      }
    }
  });

  return jobUrls;
}

/**
 * Scrape a single job page for details
 */
async function scrapeJobPage(url: string): Promise<ScrapedJob | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Extract job title from h2 or title tag
    let title = $('h2').first().text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }
    if (!title) {
      const pageTitle = $('title').text();
      title = pageTitle.split(' at ')[0].trim();
    }

    // Extract company name - look for "at CompanyName" pattern or company links
    let company = '';
    const titleWithCompany = $('title').text();
    const atMatch = titleWithCompany.match(/at\s+(.+?)(?:\s*[-|]|$)/i);
    if (atMatch) {
      company = atMatch[1].trim();
    }

    // Also try to find company from job listing structure
    if (!company) {
      $('a[href^="/jobs-at/"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 1) {
          company = text;
          return false; // break
        }
      });
    }

    // Extract location
    let location = '';
    $('a[href^="/jobs-location/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        location = text;
        return false; // break
      }
    });

    // Extract job type
    let jobType = '';
    $('a[href^="/jobs-by-type/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        jobType = text;
        return false; // break
      }
    });

    // Extract apply email from Method of Application section
    const fullText = $('body').text();
    const methodMatch = fullText.match(/method\s+of\s+application[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      || fullText.match(/(?:send|email|apply)\s*(?:to|your\s+(?:cv|resume|application))?\s*[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const applyEmail = methodMatch?.[1]?.trim() || '';

    // Get apply URL - external link, or mailto if email found, else source URL
    let applyUrl = url;
    if (applyEmail) {
      applyUrl = `mailto:${applyEmail}`;
    } else {
      $('a[href*="/job-application/"], a[href*="/apply-now/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          applyUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          return false; // break
        }
      });
    }

    // Extract structured job content: About, Responsibilities, Qualifications
    let about = '';
    let responsibilities = '';
    let qualifications = '';

    // About: company intro paragraph (before job title h2)
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 30 && text.length < 400 && !/posted|deadline|save|email|type your/i.test(text)) {
        about = text.replace(/\s*\[?Read more[^\]]*\]?/i, '').trim();
        return false; // take first good paragraph
      }
    });

    // Extract Responsibilities and Qualification & Experience from list items
    const respItems: string[] = [];
    const qualItems: string[] = [];

    $('strong, b').each((_, el) => {
      const header = $(el).text().trim();
      if (/^responsibilities$/i.test(header)) {
        $(el).nextAll('ul').first().find('li').each((__, li) => {
          const t = $(li).text().trim();
          if (t && t.length > 5 && !/check how your cv|build your cv/i.test(t)) respItems.push(t);
        });
      }
      if (/^qualification\s*(&|and)\s*experience$/i.test(header) || /^requirements$/i.test(header)) {
        $(el).nextAll('ul').first().find('li').each((__, li) => {
          const t = $(li).text().trim();
          if (t && t.length > 5 && !/check how your cv|build your cv/i.test(t)) qualItems.push(t);
        });
      }
    });
    responsibilities = respItems.join('\n');
    qualifications = qualItems.join('\n');

    // Fallback: regex extraction from full text if DOM structure differs
    if (!responsibilities && !qualifications) {
      const respMatch = fullText.match(/responsibilities\s*([\s\S]*?)(?=qualification|requirements|method\s+of\s+application|$)/i);
      if (respMatch) responsibilities = respMatch[1].replace(/\n{3,}/g, '\n\n').trim().substring(0, 800);
      const qualMatch = fullText.match(/(?:qualification\s*(?:&|and)\s*experience|requirements)\s*([\s\S]*?)(?=method\s+of\s+application|check how your cv|$)/i);
      if (qualMatch) qualifications = qualMatch[1].replace(/\n{3,}/g, '\n\n').trim().substring(0, 500);
    }

    // Build description with section headers for parseJobDescription
    const parts: string[] = [];
    if (about) parts.push(`About the role:\n${about}`);
    else parts.push(`About the role:\n${company} is hiring a ${title}.`);
    if (responsibilities) parts.push(`Responsibilities:\n${responsibilities}`);
    if (qualifications) parts.push(`Requirements:\n${qualifications}`);
    let description = parts.join('\n\n');
    if (!description.trim()) {
      description = `${title} position at ${company}`;
    }

    // Skip if we couldn't extract essential data
    if (!title || !company) {
      console.log(`Skipping job at ${url}: missing title or company`);
      return null;
    }

    return {
      id: generateJobId(url),
      title,
      company,
      location: location || 'Nigeria',
      jobType: jobType || 'Full Time',
      description: description || `${title} position at ${company}`,
      applyUrl,
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

/**
 * Scrape all jobs from the MyJobMag listings page
 * Respects robots.txt by only accessing allowed paths
 */
export async function scrapeLatestJobs(limit: number = 50): Promise<ScrapedJob[]> {
  console.log('Starting job scrape from MyJobMag...');

  // Get job URLs from Today's jobs page (only jobs posted today on MyJobMag)
  const TODAY_JOBS_URL = `${BASE_URL}/jobs-by-date/today`;
  const jobUrls = await getJobUrls(TODAY_JOBS_URL);
  console.log(`Found ${jobUrls.length} job URLs from today's listings`);

  // Limit the number of jobs to scrape
  const urlsToScrape = jobUrls.slice(0, limit);

  // Scrape each job with a small delay to be respectful
  const jobs: ScrapedJob[] = [];

  for (const url of urlsToScrape) {
    const job = await scrapeJobPage(url);
    if (job) {
      jobs.push(job);
    }
    // Small delay between requests (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Successfully scraped ${jobs.length} jobs`);
  return jobs;
}

/**
 * Scrape a specific number of new jobs (for testing)
 */
export async function scrapeNewJobs(count: number = 10): Promise<ScrapedJob[]> {
  return scrapeLatestJobs(count);
}
