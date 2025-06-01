import fetch from 'node-fetch';
import { logError, logTerminal } from '../utils/logger.js';
import { monitor } from '../utils/monitoring.js';
import https from 'https';
import { rateLimiters } from '../utils/rate_limiter.js';

// Create a custom HTTPS agent with keep-alive and other optimizations
const agent = new https.Agent({
    keepAlive: true,
    timeout: 30000,
    maxSockets: 10,
    rejectUnauthorized: true
});

const RETRY_INTERVALS = [2000, 5000, 10000]; // Progressive retry delays

async function fetchWithRetry(url) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    };

    let lastError = null;
    
    // Check rate limit before making request
    await rateLimiters.websites.checkLimit('truthout');

    for (let attempt = 0; attempt < RETRY_INTERVALS.length; attempt++) {
        const startTime = Date.now();
        
        try {
            console.log(`Attempting to fetch Truthout (attempt ${attempt + 1})...`);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(url, {
                headers,
                signal: controller.signal,
                agent,
                compress: true
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${url}`);
            }

            const text = await response.text();
            const duration = Date.now() - startTime;

            monitor.logFetch('Truthout', {
                status: 'success',
                url,
                attempt: attempt + 1,
                responseSize: text.length,
                duration,
                statusCode: response.status,
                headers: Object.fromEntries(response.headers.entries())
            });

            console.log(`Successfully fetched ${text.length} bytes from Truthout`);
            return text;
        } catch (error) {
            lastError = error;
            const duration = Date.now() - startTime;
            const waitTime = RETRY_INTERVALS[attempt];

            monitor.logFetch('Truthout', {
                status: 'error',
                url,
                attempt: attempt + 1,
                error: error.message,
                errorType: error.name,
                duration,
                nextRetryIn: waitTime
            });

            const msg = `Attempt ${attempt + 1} failed for Truthout: ${error.message}\nWaiting ${waitTime/1000} seconds before retry...`;
            console.error(msg);
            logError(msg);
            logTerminal(msg);

            if (attempt < RETRY_INTERVALS.length - 1) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Max retries exceeded');
}

export async function getNews() {
    const urls = [
        'https://truthout.org/latest/',
        'https://truthout.org/articles/'
    ];

    const results = [];
    for (const url of urls) {
        try {
            console.log(`Fetching Truthout content from ${url}...`);
            const content = await fetchWithRetry(url);
            if (content) {
                results.push(content);
            }
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            monitor.logParse('Truthout', {
                status: 'error',
                phase: 'fetch',
                url,
                error: error.message
            });
        }
    }

    if (results.length === 0) {
        monitor.logParse('Truthout', {
            status: 'error',
            phase: 'fetch',
            error: 'No content received from any URL'
        });
        return null;
    }

    return results.join('\n');
}


