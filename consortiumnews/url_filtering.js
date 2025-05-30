import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';

export async function url_filtering(){
    let raw_data;
    try {
        raw_data = await getNews();
    } catch (err) {
        logError(`ConsortiumNews getNews error: ${err}`);
        return null;
    }
    if (!raw_data) {
        logError("No data received from ConsortiumNews getNews");
        return null;
    }

    // Get the current date
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Extract article URLs along with their timestamps and categories
    // ConsortiumNews format: href="URL">Title</a>...DATE
    const articlePattern = /href="(https:\/\/consortiumnews\.com\/\d{4}\/\d{2}\/[a-z0-9-]+\/?)"[^>]*>([^<]+)<\/a>[^>]*>([^<]+)/g;
    const matches = Array.from(raw_data.matchAll(articlePattern));
    
    // Filter articles:
    // 1. Only from the last 24 hours
    // 2. Exclude certain types of content
    const filtered_urls = matches
        .filter(match => {
            const [, url, title, dateStr] = match;
            
            // Skip non-article content
            if (url.includes('/category/') ||
                url.includes('/tag/') || 
                url.includes('/author/') ||
                url.includes('/feed/') ||
                url.includes('/series/') ||
                url.includes('/page/') ||
                url.includes('/archive/') ||
                url.includes('/submission-guidelines/') ||
                url.includes('/about/') ||
                url.includes('/contact-us/') ||
                title.toLowerCase().includes('donate') ||
                title.toLowerCase().includes('fundraiser') ||
                title.toLowerCase().includes('subscribe') ||
                title.toLowerCase().includes('support our work')) {
                return false;
            }
            
            // Parse the date string and compare with 24h ago
            try {
                // ConsortiumNews uses format: "May 30, 2025"
                const articleDate = new Date(dateStr.trim());
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
        console.log("No new ConsortiumNews articles found in the current fetch");
        return [];
    }
    
    // Remove duplicates and sort
    const cleaned_data = [...new Set(filtered_urls)].sort();
    
    // Only log count of new articles
    if (cleaned_data.length > 0) {
        console.log(`Found ${cleaned_data.length} new ConsortiumNews articles from the last 24 hours`);
    }
    
    return cleaned_data;
}


