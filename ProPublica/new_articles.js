import { url_filtering } from './url_filtering.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function new_articles_loop(interval_ms = 6000) {
    console.log("Starting ProPublica article monitor loop...");
    
    // Initialize with empty array if url_filtering fails
    let previous_urls = await url_filtering() || [];
    if (previous_urls.length > 0) {
        console.log(`Initially found ${previous_urls.length} ProPublica articles`);
    }

    while (true) {
        await sleep(interval_ms);

        const current_urls = await url_filtering() || [];
        
        // Find truly new URLs by comparing with previous set
        const new_urls = current_urls.filter(url => !previous_urls.includes(url));

        if (new_urls.length > 0) {
            console.log(`Found ${new_urls.length} new ProPublica article(s):`);
            new_urls.forEach(url => console.log(`- ${url}`));
            
            // Update previous_urls before returning
            previous_urls = current_urls;
            
            // Return only one new URL at a time to prevent duplicate processing
            return [new_urls[0]];
        } else {
            // Update previous_urls even when no new articles found
            previous_urls = current_urls;
        }
    }
}

