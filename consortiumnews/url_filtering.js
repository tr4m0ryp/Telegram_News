import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';
import { monitor as consortiumMonitor } from '../utils/monitoring.js';
import { classifyUrl } from '../utils/url_classifier.js';

// Store the last fetch time
let lastFetchTime = 0;
const FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

export async function url_filtering(isStartupPhase = false) {
    // Skip interval check during startup phase
    if (!isStartupPhase) {
        const now = Date.now();
        if (now - lastFetchTime < FETCH_INTERVAL) {
            console.log(`Skipping ConsortiumNews fetch - next fetch in ${Math.ceil((FETCH_INTERVAL - (now - lastFetchTime)) / 1000)} seconds`);
            return null;
        }
    }
    
    lastFetchTime = Date.now();
    let raw_data;
    try {
        raw_data = await getNews();
    } catch (err) {
        consortiumMonitor.logParse('ConsortiumNews', {
            status: 'error',
            phase: 'fetch',
            error: err.message
        });
        logError(`ConsortiumNews getNews error: ${err}`);
        return null;
    }
    if (!raw_data) {
        consortiumMonitor.logParse('ConsortiumNews', {
            status: 'error',
            phase: 'fetch',
            error: 'No data received'
        });
        logError("No data received from ConsortiumNews getNews");
        return null;
    }

    const currentDate = new Date();
    const oneDayAgo = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    
    const cheerio = await import('cheerio');
    const $ = cheerio.load(raw_data);
    
    consortiumMonitor.logParse('ConsortiumNews', {
        status: 'info',
        phase: 'parsing',
        message: 'Starting HTML parse'
    });

    const articles = new Set();
    const classificationResults = [];

    // Find all article links with more specific selectors
    console.log('Searching for article links...');
    const links = $('.post-box .entry-title a, article.post .entry-title a, .post-article .entry-title a').toArray();
    console.log(`Found ${links.length} article links`);

    for (const link of links) {
        const $link = $(link);
        let url = $link.attr('href');
        const title = $link.text().trim();
        let dateStr = $link.closest('article, .post-article, .post').find('time, .entry-date, .post-date').text().trim();

        if (!url || !title) {
            console.log('Skipping link: Missing URL or title');
            continue;
        }

        // Make URL absolute and normalize
        try {
            const urlObj = new URL(url, 'https://consortiumnews.com');
            url = urlObj.href;
        } catch (e) {
            console.log(`Invalid URL: ${url}`);
            continue;
        }

        // Filter out non-article URLs
        if (url.includes('/category/') ||
            url.includes('/tag/') || 
            url.includes('/author/') ||
            url.includes('/feed/') ||
            url.includes('/page/')) {
            console.log('Filtered non-article URL:', url);
            continue;
        }

        // Parse the date
        let articleDate;
        try {
            articleDate = new Date(dateStr);
            if (isNaN(articleDate.getTime())) {
                const match = dateStr.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
                if (match) {
                    articleDate = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
                }
            }
        } catch (e) {
            console.log(`Error parsing date "${dateStr}" for URL: ${url}`);
            if (isStartupPhase) {
                // During startup, include articles even if we can't parse the date
                articleDate = new Date();
            } else {
                continue;
            }
        }

        // During startup phase, be more lenient with date check
        if (isStartupPhase || (articleDate && articleDate >= oneDayAgo)) {
            articles.add(url);
            if (!isStartupPhase) {
                const classification = await classifyUrl(url, title);
                classificationResults.push({
                    url,
                    title,
                    date: articleDate?.toISOString(),
                    ...classification
                });
            }
        }
    }

    if (articles.size === 0) {
        console.log("No new relevant ConsortiumNews articles found");
        consortiumMonitor.logParse('ConsortiumNews', {
            status: 'info',
            phase: 'filter',
            message: 'No articles passed filtering'
        });
        return [];
    }
    
    const cleaned_data = [...articles].sort().reverse();
    console.log(`Found ${cleaned_data.length} relevant ConsortiumNews articles`);
    
    consortiumMonitor.logParse('ConsortiumNews', {
        status: 'success',
        phase: 'filter',
        articlesFound: cleaned_data.length,
        classificationResults
    });

    return cleaned_data;
}


