import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';
import { monitor as proPublicaMonitor } from '../utils/monitoring.js';
import { classifyUrl } from '../utils/url_classifier.js';

// Store the last fetch time
let lastFetchTime = 0;
const FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

export async function url_filtering(isStartupPhase = false) {
    // Skip interval check during startup phase
    if (!isStartupPhase) {
        const now = Date.now();
        if (now - lastFetchTime < FETCH_INTERVAL) {
            console.log(`Skipping ProPublica fetch - next fetch in ${Math.ceil((FETCH_INTERVAL - (now - lastFetchTime)) / 1000)} seconds`);
            return null;
        }
    }
    
    const now = Date.now();
    lastFetchTime = now;
    
    console.log('Fetching ProPublica articles...');
    let raw_data;
    try {
        raw_data = await getNews();
        if (!raw_data) {
            proPublicaMonitor.logParse('ProPublica', {
                status: 'error',
                phase: 'fetch',
                error: 'No data received'
            });
            return null;
        }
        console.log('Successfully fetched ProPublica data');
    } catch (err) {
        proPublicaMonitor.logParse('ProPublica', {
            status: 'error',
            phase: 'fetch',
            error: err.message
        });
        return null;
    }

    // Get the current date
    const currentDate = new Date();
    const oneDayAgo = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    
    // Use cheerio for better HTML parsing
    const cheerio = await import('cheerio');
    const $ = cheerio.load(raw_data);

    console.log('\nAnalyzing ProPublica page structure:');
    ['.archive-content', '.story-entry', '.article-wrapper', '.stories-list'].forEach(selector => {
        console.log(`${selector}:`, $(selector).length ? 'Found' : 'Not found');
    });

    proPublicaMonitor.logParse('ProPublica', {
        status: 'info',
        phase: 'parsing',
        message: 'Starting HTML parse with LLM classification'
    });

    const foundUrls = new Set();
    const classificationResults = [];

    // Find all article links in the archive using multiple selectors
    const selectors = [
        '.archive-content article',
        '.story-entry',
        '.article-wrapper',
        '.stories-list .story',
        'article.post',
        '.article-preview'
    ];

    for (const selector of selectors) {
        const elements = $(selector).toArray();
        console.log(`Found ${elements.length} elements with selector: ${selector}`);

        for (const element of elements) {
            const $element = $(element);
            const $link = $element.find('a').first();
            const url = $link.attr('href');
            const title = $link.text().trim() || $element.find('h2, h3, .title').first().text().trim();
            const dateStr = $element.find('time, .timestamp, .pub-date, .date').first().text().trim();

            if (!url || (!url.includes('propublica.org/article/') && !url.startsWith('/article/'))) {
                continue;
            }

            // Make URL absolute if it's relative
            const fullUrl = url.startsWith('/') ? 'https://www.propublica.org' + url : url;

            try {
                // Clean up and parse the date string
                const cleanDateStr = dateStr.replace(/(EDT|CDT|EST|CST)$/, '').trim();
                const articleDate = new Date(cleanDateStr);

                console.log('Processing URL:', {
                    url: fullUrl,
                    title,
                    date: cleanDateStr
                });

                // During startup phase, include all articles
                if (isStartupPhase || (!isNaN(articleDate.getTime()) && articleDate >= oneDayAgo)) {
                    // Classify the URL using our LLM
                    const classification = await classifyUrl(fullUrl, title);
                    classificationResults.push({
                        url: fullUrl,
                        title,
                        date: articleDate,
                        ...classification
                    });
                    
                    if (classification.isRelevant) {
                        foundUrls.add(fullUrl);
                    } else {
                        console.log(`Filtered out ProPublica URL: ${fullUrl} - ${classification.reason}`);
                    }
                }
            } catch (e) {
                proPublicaMonitor.logParse('ProPublica', {
                    status: 'error',
                    phase: 'filter',
                    error: e.message,
                    url: fullUrl,
                    title,
                    dateStr
                });
            }
        }
    }

    if (foundUrls.size === 0) {
        // During startup phase, try to get at least some articles
        if (isStartupPhase) {
            const fallbackSelector = 'a[href*="/article/"]';
            const links = $(fallbackSelector).toArray();
            console.log(`Using fallback selector: found ${links.length} article links`);

            for (const link of links.slice(0, 5)) { // Get first 5 articles
                const url = $(link).attr('href');
                if (url) {
                    const fullUrl = url.startsWith('/') ? 'https://www.propublica.org' + url : url;
                    foundUrls.add(fullUrl);
                }
            }
        }

        if (foundUrls.size === 0) {
            proPublicaMonitor.logParse('ProPublica', {
                status: 'warning',
                phase: 'extract',
                message: 'No relevant articles found after classification',
                classificationResults
            });
            console.log('No relevant ProPublica articles found');
            return [];
        }
    }

    proPublicaMonitor.logParse('ProPublica', {
        status: 'success',
        phase: 'extract',
        articleCount: foundUrls.size,
        classificationResults
    });

    const cleaned_data = [...foundUrls].sort();
    console.log(`Found ${cleaned_data.length} relevant ProPublica articles:`);
    cleaned_data.forEach(url => console.log('- ' + url));

    return cleaned_data;
}


