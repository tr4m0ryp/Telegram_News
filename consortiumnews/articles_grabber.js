import fetch from 'node-fetch';
import { logError, logTerminal } from '../utils/logger.js';

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 10000, // 10 second timeout
        follow: 5 // Follow up to 5 redirects
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const html = await response.text();
      if (!html) {
        throw new Error('Empty response received');
      }

      return html;
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      const msg = `Attempt ${i + 1}/${retries} failed to fetch ${url}: ${error.message}`;
      
      if (isLastAttempt) {
        logError(msg);
        throw error;
      } else {
        console.warn(msg + ' - Retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
      }
    }
  }
}

export async function getNews() {
  const urls = [
    "https://consortiumnews.com/", // Main page
    "https://consortiumnews.com/recent-stories/", // Recent stories page
  ];

  for (const url of urls) {
    try {
      console.log(`Fetching ConsortiumNews articles from ${url}...`);
      const content = await fetchWithRetry(url);
      if (content) {
        return content;
      }
    } catch (error) {
      const msg = `Error fetching ConsortiumNews from ${url}: ${error.message}`;
      console.error(msg);
      logError(msg);
      logTerminal(msg);
      // Continue to next URL if this one fails
      continue;
    }
  }

  throw new Error('Failed to fetch articles from all ConsortiumNews URLs');
}


