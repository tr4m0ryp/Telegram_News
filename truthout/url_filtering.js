import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';

export async function url_filtering(){
    let raw_data;
    try {
        raw_data = await getNews();
    } catch (err) {
        logError(`Truthout getNews error: ${err}`);
        return null;
    }
    if (!raw_data) {
        logError("No data received from Truthout getNews");
        return null;
    }

    // Get the current date
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Extract article URLs along with their timestamps and categories
    // Truthout format: href="URL">Title</a>...CATEGORY...timestamp
    const articlePattern = /href="(https:\/\/truthout\.org\/articles\/[a-z0-9-]+\/?)"[^>]*>([^<]+)<\/a>.*?<time[^>]*>([^<]+)/g;
    const matches = Array.from(raw_data.matchAll(articlePattern));
    
    // Filter articles:
    // 1. Only from the last 24 hours
    // 2. Exclude certain types of content
    const filtered_urls = matches
        .filter(match => {
            const [, url, title, dateStr] = match;
            
            // Skip non-article content
            if (url.includes('/feed/') ||
                url.includes('/page/') ||
                url.includes('/author/') ||
                url.includes('/tag/') ||
                url.includes('/category/') ||
                url.includes('center-for-grassroots-journalism') ||
                url.includes('prize') ||
                url.includes('submission-guidelines') ||
                title.toLowerCase().includes('podcast') ||
                title.toLowerCase().includes('newsletter') ||
                title.toLowerCase().includes('support our work') ||
                title.toLowerCase().includes('donate') ||
                title.toLowerCase().includes('subscribe')) {
                return false;
            }
            
            // Parse the date string and compare with 24h ago
            try {
                const articleDate = new Date(dateStr.replace(/(EDT|CDT|EST|CST)/, '').trim());
                return articleDate >= oneDayAgo;
            } catch (e) {
                // Try alternate date format if first parse fails
                try {
                    const [month, day, year] = dateStr.split(' ');
                    const altDate = new Date(`${month} ${day.replace(',', '')} ${year}`);
                    return altDate >= oneDayAgo;
                } catch (e2) {
                    return false; // Skip if both date parsing attempts fail
                }
            }
        })
        .map(match => match[1]); // Get just the URL
    
    if (filtered_urls.length === 0) {
        console.log("No new Truthout articles found in the current fetch");
        return [];
    }
    
    // Remove duplicates and sort
    const cleaned_data = [...new Set(filtered_urls)].sort();
    
    // Only log count of new articles
    if (cleaned_data.length > 0) {
        console.log(`Found ${cleaned_data.length} new Truthout articles from the last 24 hours`);
    }
    
    return cleaned_data;
}


