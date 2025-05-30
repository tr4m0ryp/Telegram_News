import fetch from 'node-fetch';
import { logError, logTerminal } from '../utils/logger.js';

const LONG_RETRY_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function fetchWithRetry(url, maxRetries = 3) {
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
    let lastError = null;
    for (let attempt = 1; true; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(url, {
                headers: browserHeaders,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${url}`);
            }
            return await response.text();
        } catch (error) {
            lastError = error;
            const waitTime = attempt <= maxRetries ? 2000 * Math.pow(2, attempt - 1) : LONG_RETRY_INTERVAL;
            const msg = attempt <= maxRetries
                ? `Attempt ${attempt}/${maxRetries} failed for ConsortiumNews: ${error.name === 'AbortError' ? 'Request timed out' : error.message}\nWaiting ${waitTime/1000} seconds before retry...`
                : `All ${maxRetries} attempts failed for ConsortiumNews. Waiting ${LONG_RETRY_INTERVAL/1000/60} minutes before trying again...`;
            console.error(msg);
            logError(msg);
            logTerminal(msg);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            if (attempt > maxRetries) attempt = 0;
        }
    }
}

export async function getNews() {
    const url = "https://consortiumnews.com/";
    try {
        return await fetchWithRetry(url);
    } catch (error) {
        logError(`Error fetching ConsortiumNews: ${error.message}`);
        logTerminal(`Error fetching ConsortiumNews: ${error.message}`);
        return null;
    }
}


