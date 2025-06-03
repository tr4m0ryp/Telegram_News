import fetch from 'node-fetch';
import { logError } from '../utils/logger.js';
import { monitor } from '../utils/monitoring.js';
import https from 'https';
import { load } from 'cheerio';

const LONG_RETRY_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Custom HTTPS agent with keep-alive
const agent = new https.Agent({
  keepAlive: true,
  timeout: 30000,
  rejectUnauthorized: false, // only if necessary
});

/**
 * Attempts to GET `url` with exponential backoff.
 * Retries up to `maxRetries` times (2s, 4s, 8s…), then every 10 minutes thereafter.
 */
export async function fetchWithRetry(url, maxRetries = 3) {
  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://www.propublica.org',
    Connection: 'keep-alive',
  };

  let attempt = 1;
  while (true) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 45000); // 45s

    try {
      console.log(`Attempting to fetch ProPublica (attempt ${attempt})…`);
      const response = await fetch(url, {
        headers: browserHeaders,
        signal: controller.signal,
        agent,
      });
      clearTimeout(timeoutHandle);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const text = await response.text();
      const duration = Date.now() - startTime;

      monitor.logFetch('ProPublica', {
        status: 'success',
        url,
        attempt,
        responseSize: text.length,
        duration,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      });
      monitor.logPerformance('ProPublica', {
        operation: 'fetch',
        duration,
        responseSize: text.length,
      });

      console.log(`Successfully fetched ${text.length} bytes from ProPublica`);
      return text;
    } catch (err) {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      const waitTime =
        attempt <= maxRetries
          ? 2000 * Math.pow(2, attempt - 1)
          : LONG_RETRY_INTERVAL;

      monitor.logFetch('ProPublica', {
        status: 'error',
        url,
        attempt,
        error: err.message,
        errorType: err.name,
        duration,
        nextRetryIn: waitTime,
      });

      const msg =
        attempt <= maxRetries
          ? `Attempt ${attempt}/${maxRetries} failed for ProPublica: ${
              err.name === 'AbortError' ? 'Request timed out' : err.message
            }\nWaiting ${waitTime / 1000}s before retry…`
          : `All ${maxRetries} attempts failed for ProPublica. ` +
            `Waiting ${LONG_RETRY_INTERVAL / 1000 / 60} min before retry…`;

      console.error(msg);
      logError(msg);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      attempt = attempt < maxRetries ? attempt + 1 : maxRetries + 1;
    }
  }
}

/**
 * Fetches the ProPublica archive page HTML. Returns `null` on error.
 */
export async function getNews() {
  const url = 'https://www.propublica.org/archive/';
  try {
    console.log('Fetching ProPublica archive page…');
    const content = await fetchWithRetry(url);
    if (!content) {
      monitor.logParse('ProPublica', {
        status: 'error',
        phase: 'fetch',
        error: 'No content received',
      });
      throw new Error('No content received from archive');
    }
    return content;
  } catch (err) {
    const msg = `Error fetching ProPublica archive: ${err.message}`;
    console.error(msg);
    logError(msg);
    return null;
  }
}

/**
 * Parses the *first* .story-river-item from the archive HTML and returns:
 *   { title, url, date: Date, previewImage }
 * Returns `null` if parsing fails or no items found.
 */
export async function getLatestArticle() {
  const raw = await getNews();
  if (!raw) return null;

  const $ = load(raw);
  const $first = $('.story-river-item').first();
  if (!$first.length) {
    console.log('No <.story-river-item> found in archive HTML.');
    return null;
  }

  // 1) Title & URL
  const $link = $first.find('h4.story-river-item__hed a').first();
  const title = $link.text().trim();
  let url = $link.attr('href');
  if (!title || !url) {
    console.log('Failed to get title or URL from first .story-river-item.');
    return null;
  }
  try {
    url = new URL(url, 'https://www.propublica.org').href;
  } catch {
    console.log(`Malformed URL: ${url}`);
    return null;
  }

  // 2) Preview image (largest srcset entry, if present)
  let previewImage = null;
  const $img = $first.find('.lead-art img').first();
  if ($img.length) {
    const srcset = $img.attr('srcset') || '';
    const candidates = srcset
      .split(',')
      .map((chunk) => chunk.trim().split(' ')[0])
      .filter(Boolean);
    if (candidates.length) {
      try {
        previewImage = new URL(candidates.pop(), 'https://www.propublica.org').href;
      } catch {
        previewImage = null;
      }
    }
  }

  // 3) Publication date: human‐readable inside <time class="timestamp">
  const dateText = $first.find('time.timestamp').first().text().trim();
  let articleDate = dateText ? new Date(dateText) : new Date();
  if (isNaN(articleDate.getTime())) {
    console.log(`Unable to parse date "${dateText}", defaulting to now`);
    articleDate = new Date();
  }

  return { title, url, date: articleDate, previewImage };
}
