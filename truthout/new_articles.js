import { url_filtering } from './url_filtering.js';
import { logError, logNewArticle, logTerminal } from '../utils/logger.js';
import { globalStats } from '../utils/counter.js';

let previous_urls = [];
let fetchCount = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function new_articles_loop(interval_ms = 6000) {
    if (previous_urls.length === 0) {
        previous_urls = await url_filtering() || [];
    }

    while (true) {
        await sleep(interval_ms);
        let current_urls = [];
        try {
            current_urls = await url_filtering() || [];
            // Make sure current_urls is an array and remove any duplicates
            current_urls = [...new Set(current_urls)];
            
            // Increment fetch counter using globalStats
            globalStats.incrementFetch('Truthout');
        } catch (err) {
            logError(`Truthout url_filtering error: ${err}`);
            continue;
        }

        // Find truly new URLs by comparing with previous_urls
        const added_urls = current_urls.filter(url => !previous_urls.includes(url));
        
        // Update previous_urls with the new URLs only
        previous_urls = [...new Set([...previous_urls, ...current_urls])];
        
        if (added_urls.length > 0) {
            // Update stats for new articles
            globalStats.addNewArticles('Truthout', added_urls.length);
            
            // Log URLs to the log file
            added_urls.forEach(url => {
                logNewArticle('Truthout', url);
            });
            
            return added_urls;
        }
    }
}

