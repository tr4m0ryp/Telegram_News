import { getNews } from "./articles_grabber.js"
import { logError } from '../utils/logger.js';
import { monitor as truthoutMonitor } from '../utils/monitoring.js';
import { classifyUrl } from '../utils/url_classifier.js';

// Store the last fetch time
let lastFetchTime = 0;
const FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

export async function url_filtering(isStartupPhase = false) {
    // Check if enough time has passed since the last fetch
    const now = Date.now();
    if (!isStartupPhase && now - lastFetchTime < FETCH_INTERVAL) {
        console.log(`Skipping fetch - next fetch in ${Math.ceil((FETCH_INTERVAL - (now - lastFetchTime)) / 1000)} seconds`);
        return null;
    }
    
    lastFetchTime = now;
    
    let raw_data;
    try {
        raw_data = await getNews();
        if (!raw_data) {
            truthoutMonitor.logParse('Truthout', {
                status: 'error',
                phase: 'fetch',
                error: 'No data received'
            });
            return null;
        }
    } catch (err) {
        truthoutMonitor.logParse('Truthout', {
            status: 'error',
            phase: 'fetch',
            error: err.message
        });
        return null;
    }

    // Get the current date for filtering
    const currentDate = new Date();
    const oneDayAgo = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);

    let $;
    try {
        // Use cheerio to parse the HTML properly
        const cheerio = await import('cheerio');
        $ = cheerio.load(raw_data);

        truthoutMonitor.logParse('Truthout', {
            status: 'info',
            phase: 'parsing',
            message: 'Starting HTML parse with LLM classification'
        });

        const articles = new Set();
        const classificationResults = [];
        
        // Process the articles
        $('.latest-posts article, .featured-article').each((_, article) => {
            const $article = $(article);
            const $link = $article.find('a[href*="/articles/"]').first();
            let url = $link.attr('href');
            const title = $link.text().trim() || $article.find('h1, h2, .title').first().text().trim();
            const dateStr = $article.find('time, .date, .published').first().text();

            if (!url) return;
            
            // Make URL absolute if it's relative
            if (url.startsWith('/')) {
                url = 'https://truthout.org' + url;
            }
            
            // Skip if not an article or is a special page
            if (!url.includes('truthout.org/articles/') || 
                url.includes('/tag/') || 
                url.includes('/author/') ||
                url.includes('/category/')) {
                return;
            }

            // Parse the date if available
            let articleDate;
            if (dateStr) {
                articleDate = new Date(dateStr);
                if (isNaN(articleDate.getTime())) {
                    const match = dateStr.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
                    if (match) {
                        articleDate = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
                    }
                }
            }

            // Process if in startup phase or article is recent
            if (isStartupPhase || !dateStr || !articleDate || articleDate >= oneDayAgo) {
                articles.add(url);
            }
        });

        // Filter and classify articles
        const finalArticles = new Set();
        for (const url of articles) {
            try {
                const classification = await classifyUrl(url, '');
                classificationResults.push({
                    url,
                    ...classification
                });
                
                if (classification.isRelevant) {
                    finalArticles.add(url);
                } else {
                    console.log(`Filtered out URL: ${url} - ${classification.reason}`);
                }
            } catch (err) {
                console.error(`Error classifying article ${url}:`, err);
            }
        }

        if (finalArticles.size === 0) {
            truthoutMonitor.logParse('Truthout', {
                status: 'warning',
                phase: 'extract',
                message: 'No relevant articles found after classification',
                classificationResults
            });
            return [];
        }

        truthoutMonitor.logParse('Truthout', {
            status: 'success',
            phase: 'extract',
            articleCount: finalArticles.size,
            classificationResults
        });

        const cleanedUrls = [...finalArticles].sort();
        console.log(`Found ${cleanedUrls.length} relevant Truthout articles:`);
        cleanedUrls.forEach(url => console.log('- ' + url));

        // Define selectors for article links
        const articleLinks = [];
        $('article a').each((index, element) => {
            const href = $(element).attr('href');
            if (href && classifyUrl(href)) {
                articleLinks.push(href);
            }
        });

        if (articleLinks.length === 0) {
            truthoutMonitor.logParse('Truthout', {
                status: 'error',
                phase: 'filter',
                error: 'No valid article links found'
            });
            return null;
        }

        truthoutMonitor.logParse('Truthout', {
            status: 'success',
            phase: 'filter',
            count: articleLinks.length
        });

        // Extract images from articles
        const articleImages = [];
        for (const url of articles) {
            try {
                const articleHtml = await fetch(url).then(res => res.text());
                const cheerio = await import('cheerio');
                const $articlePage = cheerio.load(articleHtml);
                
                // Use the improved image extraction with URL context
                const { extractArticleImages } = await import('../utils/image_handler.js');
                const images = await extractArticleImages($articlePage, url);
                
                if (images.length > 0) {
                    articleImages.push({
                        url,
                        images: images.map(imgSrc => ({ url: imgSrc }))
                    });
                }
            } catch (err) {
                console.error(`Error fetching images from article ${url}:`, err);
            }
        }

        if (articleImages.length === 0) {
            truthoutMonitor.logParse('Truthout', {
                status: 'warning',
                phase: 'image-extract',
                message: 'No images found in articles'
            });
        } else {
            truthoutMonitor.logParse('Truthout', {
                status: 'success',
                phase: 'image-extract',
                imageCount: articleImages.reduce((acc, art) => acc + art.images.length, 0),
                articleImages
            });

            console.log(`Found images in ${articleImages.length} articles:`);
            articleImages.forEach(({ url, images }) => {
                console.log(`\nArticle: ${url}`);
                images.forEach(img => console.log(`- ${img.url}`));
            });
        }

        return articleLinks;
    } catch (err) {
        console.error('Error in Truthout url_filtering:', err);
        truthoutMonitor.logParse('Truthout', {
            status: 'error',
            phase: 'parse',
            error: err.message
        });
        return null;
    }
}
