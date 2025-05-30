import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';

export async function url_filtering(){
    let raw_data;
    try {
        raw_data = await getNews();
    } catch (err) {
        logError(`ProPublica getNews error: ${err}`);
        return null;
    }
    if (!raw_data) {
        logError("No data received from ProPublica getNews");
        return null;
    }

    // Get the current date
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Extract article URLs along with their timestamps
    // ProPublica format has variations:
    // 1. May 30, 2025, 5 a.m. EDT
    // 2. May 30, 2025, 3:30 p.m. EDT
    // 3. May 30, 2025, 5:05 a.m. CDT
    const articlePattern = /href="(https:\/\/www\.propublica\.org\/article\/[a-z0-9-]+(?:\/)?)"[^>]*>[^<]+<\/a>(?:.*?),\s*([^<]+)(?:\s*(?:EDT|CDT|EST|CST))?/g;
    const matches = Array.from(raw_data.matchAll(articlePattern));
    
    // Filter articles:
    // 1. Only from the last 24 hours
    // 2. Exclude certain types of content
    const filtered_urls = matches
        .filter(match => {
            const [, url, dateStr] = match;
            
            // Skip non-article and administrative content
            if (url.includes('/atpropublica/') ||
                url.includes('/tips/') ||
                url.includes('/getinvolved/') ||
                url.includes('/newsletters/') ||
                url.includes('/about/') ||
                url.includes('/contact/') ||
                url.includes('/join/') ||
                url.includes('/support/') ||
                url.includes('/subscribe/') ||
                url.toLowerCase().includes('editor-training') ||
                url.toLowerCase().includes('fellows') ||
                url.toLowerCase().includes('job-opening')) {
                return false;
            }
            
            // Parse the date string
            try {
                // Remove timezone and clean up the date string
                const cleanDateStr = dateStr.replace(/(EDT|CDT|EST|CST)$/, '').trim();
                const articleDate = new Date(cleanDateStr);
                
                // Adjust for timezone if needed
                if (dateStr.includes('EDT')) {
                    articleDate.setHours(articleDate.getHours() + 4); // EDT is UTC-4
                } else if (dateStr.includes('CDT')) {
                    articleDate.setHours(articleDate.getHours() + 5); // CDT is UTC-5
                }
                
                return articleDate >= oneDayAgo;
            } catch (e) {
                return false; // Skip if date parsing fails
            }
        })
        .map(match => match[1]); // Get just the URL
    
    if (filtered_urls.length === 0) {
        console.log("No new ProPublica articles found in the current fetch");
        return [];
    }
    
    // Remove duplicates and sort
    const cleaned_data = [...new Set(filtered_urls)].sort();
    
    // Only log count of new articles
    if (cleaned_data.length > 0) {
        console.log(`Found ${cleaned_data.length} new ProPublica articles from the last 24 hours`);
    }
    
    return cleaned_data;
}


