import fetch from 'node-fetch';
import { logError, logTerminal } from '../utils/logger.js';
import { monitor } from '../utils/monitoring.js';
import https from 'https';

const LONG_RETRY_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Create a custom HTTPS agent with keep-alive
const agent = new https.Agent({
    keepAlive: true,
    timeout: 30000,
    rejectUnauthorized: false // Only if needed for SSL issues
});

export async function fetchWithRetry(url, maxRetries = 3) {
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.propublica.org',
        'Connection': 'keep-alive'
    };

    let lastError = null;
    for (let attempt = 1; true; attempt++) {
        const startTime = Date.now();
        try {
            console.log(`Attempting to fetch ProPublica (attempt ${attempt})...`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 45000); // Increased timeout

            const response = await fetch(url, {
                headers: browserHeaders,
                signal: controller.signal,
                agent,
                compress: true,
                timeout: 30000
            });
            
            clearTimeout(timeout);
            
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
                headers: Object.fromEntries(response.headers.entries())
            });

            monitor.logPerformance('ProPublica', {
                operation: 'fetch',
                duration,
                responseSize: text.length
            });

            console.log(`Successfully fetched ${text.length} bytes from ProPublica`);
            return text;
        } catch (error) {
            lastError = error;
            const duration = Date.now() - startTime;
            const waitTime = attempt <= maxRetries ? 2000 * Math.pow(2, attempt - 1) : LONG_RETRY_INTERVAL;
            
            monitor.logFetch('ProPublica', {
                status: 'error',
                url,
                attempt,
                error: error.message,
                errorType: error.name,
                duration,
                nextRetryIn: waitTime
            });

            const msg = attempt <= maxRetries
                ? `Attempt ${attempt}/${maxRetries} failed for ProPublica: ${error.name === 'AbortError' ? 'Request timed out' : error.message}\nWaiting ${waitTime/1000} seconds before retry...`
                : `All ${maxRetries} attempts failed for ProPublica. Waiting ${LONG_RETRY_INTERVAL/1000/60} minutes before trying again...`;
            
            console.error(msg);
            logError(msg);
            logTerminal(msg);
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            if (attempt > maxRetries) attempt = 0;
        }
    }
}

export async function getNews() {
    // Focus on the archive URL as it contains all published articles in a clean format
    const url = "https://www.propublica.org/archive/";
    try {
        console.log('Fetching ProPublica articles from archive...');
        const content = await fetchWithRetry(url);
        if (!content) {
            monitor.logParse('ProPublica', {
                status: 'error',
                phase: 'fetch',
                error: 'No content received'
            });
            throw new Error('No content received from archive');
        }
        return content;
    } catch (error) {
        const msg = `Error fetching ProPublica archive: ${error.message}`;
        console.error(msg);
        logError(msg);
        logTerminal(msg);
        return null;
    }
}


