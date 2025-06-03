import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';
import { monitor as consortiumMonitor } from '../utils/monitoring.js';
import { classifyUrl } from '../utils/url_classifier.js';

// Store the last fetch time
let lastFetchTime = 0;
const FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Transform a ConsortiumNews image URL to get the full resolution version
 * @param {string} imgUrl - The original image URL with size suffix
 * @returns {string} The URL without size suffix
 */
function getFullResolutionImage(imgUrl) {
    try {
        // Check if it's a wp-content URL
        if (!imgUrl || !imgUrl.includes('wp-content/uploads/')) {
            return imgUrl;
        }
        
        // Match the size suffix pattern (e.g., -500x345 or -260x224)
        const sizePattern = /-\d+x\d+\.(jpg|jpeg|png|gif)$/i;
        const extension = imgUrl.split('.').pop();
        
        // Replace the size suffix with just the extension
        return imgUrl.replace(sizePattern, '.' + extension);
    } catch (err) {
        console.error('Error transforming image URL:', err);
        return imgUrl;
    }
}

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
    const oneDayAgo = new Date(currentDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    const cheerio = await import('cheerio');
    const $ = cheerio.load(raw_data);
    
    consortiumMonitor.logParse('ConsortiumNews', {
        status: 'info',
        phase: 'parsing',
        message: 'Starting HTML parse'
    });

    const articles = new Set();
    const classificationResults = [];
    const articleData = new Map(); // Store article metadata including preview images

    // Find all article links with more specific selectors
    console.log('Searching for article links and preview images...');
    const articleElements = $('.post-box, article.post, .post-article').toArray();
    console.log(`Found ${articleElements.length} article elements`);

    for (const element of articleElements) {
        const $article = $(element);
        const $link = $article.find('.entry-title a').first();
        let url = $link.attr('href');
        const title = $link.text().trim();
        let dateStr = $article.find('time, .entry-date, .post-date').text().trim();

        if (!url || !title) {
            console.log('Skipping article: Missing URL or title');
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

        // Find preview image - look in common preview image locations
        let previewImage = null;
        const imageSelectors = [
            '.featured-image img',
            '.post-thumbnail img',
            'img.wp-post-image',
            '.entry-content img:first-of-type'
        ];

        for (const selector of imageSelectors) {
            const $img = $article.find(selector).first();
            if ($img.length) {
                const src = $img.attr('src');
                if (src) {
                    try {
                        // Make image URL absolute
                        previewImage = new URL(src, 'https://consortiumnews.com').href;
                        //console.log(`Found preview image for ${url}:`, previewImage);
                        break;
                    } catch (e) {
                        console.log(`Invalid image URL: ${src}`);
                    }
                }
            }
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
                articleDate = new Date();
            } else {
                continue;
            }
        }

        // During startup phase, be more lenient with date check
        if (isStartupPhase || (articleDate && articleDate >= oneDayAgo)) {
            articles.add(url);
            articleData.set(url, {
                title,
                date: articleDate,
                previewImage
            });

            if (!isStartupPhase) {
                const classification = await classifyUrl(url, title);
                classificationResults.push({
                    url,
                    title,
                    date: articleDate?.toISOString(),
                    previewImage,
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
    
    // Transform the output to include metadata
    const result = cleaned_data.map(url => ({
        url,
        ...articleData.get(url)
    }));

    consortiumMonitor.logParse('ConsortiumNews', {
        status: 'success',
        phase: 'filter',
        articlesFound: cleaned_data.length,
        classificationResults
    });

    return result;
}


