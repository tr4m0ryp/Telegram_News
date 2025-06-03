// ES Module imports
import { config } from 'dotenv';
// Configure environment variables
config();

import { parseArticle as parseProPublica } from './ProPublica/GetArticleinfo.js';
import { parseArticle as parseTruthout } from './truthout/GetArticleinfo.js';
import { parseArticle as parseConsortiumNews } from './consortiumnews/GetArticleinfo.js';
import { url_filtering as filterTruthout } from './truthout/url_filtering.js';
import { url_filtering as filterProPublica } from './ProPublica/url_filtering.js';
import { url_filtering as filterConsortiumNews } from './consortiumnews/url_filtering.js';
import fetch from 'node-fetch';

async function getLatestArticles(filterFn, count = 2) {
    try {
        const urls = await filterFn(true); // Pass true for startup phase
        if (urls && urls.length > 0) {
            return urls.slice(0, count); // Get the first 'count' articles
        }
    } catch (err) {
        console.error('Error fetching articles:', err);
    }
    return [];
}

async function validateImage(imgUrl) {
    try {
        const response = await fetch(imgUrl, { method: 'HEAD' });
        if (!response.ok) {
            console.error(`❌ Image not accessible: ${imgUrl} (${response.status})`);
            return false;
        }
        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
            console.error(`❌ Invalid content type: ${imgUrl} (${contentType})`);
            return false;
        }
        console.log(`✅ Image OK: ${imgUrl} (${contentType})`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to validate image ${imgUrl}:`, err.message);
        return false;
    }
}

async function testPreviewImages(filterFn, sourceName) {
    console.log(`\n=== Testing ${sourceName} Preview Images ===`);
    try {
        const articles = await filterFn(true);
        if (!articles?.length) {
            console.log(`No ${sourceName} articles found`);
            return;
        }

        console.log(`Found ${articles.length} articles`);
        for (const article of articles.slice(0, 2)) {
            console.log(`\nArticle: ${article.title}`);
            console.log(`URL: ${article.url}`);
            
            if (article.previewImage) {
                console.log('Preview Image:', article.previewImage);
                await validateImage(article.previewImage);
            } else {
                console.log('❌ No preview image found');
            }
        }
    } catch (err) {
        console.error(`Error testing ${sourceName}:`, err);
    }
}

async function testArticleContent(parser, article, sourceName) {
    try {
        console.log('\nFetching article content...');
        const content = await parser(article.url);
        if (!content) {
            console.log('❌ Failed to parse article content');
            return;
        }

        console.log('✅ Article content retrieved');
        console.log('Title:', content.title);
        console.log('Content length:', content.body.length, 'paragraphs');

        // Compare preview image with article images
        if (article.previewImage) {
            console.log('\nComparing preview image with article images:');
            console.log('Preview:', article.previewImage);
            console.log('Article images:', content.heroImages);
        }
    } catch (err) {
        console.error(`Error testing ${sourceName} article content:`, err);
    }
}

async function testImageHandling() {
    console.log('🔍 Starting image handling test...\n');

    // Test each news source
    const sources = [
        { name: 'ProPublica', filter: filterProPublica, parser: parseProPublica },
        { name: 'Truthout', filter: filterTruthout, parser: parseTruthout },
        { name: 'ConsortiumNews', filter: filterConsortiumNews, parser: parseConsortiumNews }
    ];

    for (const source of sources) {
        // Test preview images from listings
        await testPreviewImages(source.filter, source.name);
        
        // Get latest articles for content testing
        const articles = await source.filter(true);
        if (articles?.length) {
            // Test full article content for the first article
            await testArticleContent(source.parser, articles[0], source.name);
        }
    }

    console.log('\n✨ Image handling test complete!');

    // Test Truthout
    console.log('\n=== Truthout ===');
    if (testUrls.truthout.length === 0) {
        console.log('No Truthout articles found to test');
    }
    for (const url of testUrls.truthout) {
        try {
            console.log('\nTesting URL:', url);
            const article = await parseTruthout(url);
            if (article) {
                console.log('Title:', article.title);
                console.log('Found images:', article.heroImages.length);
                if (article.heroImages.length > 0) {
                    console.log('Image URLs:');
                    article.heroImages.forEach((img, i) => console.log(`${i + 1}. ${img}`));

                    // Validate images
                    console.log('\nValidating images...');
                    for (const imgUrl of article.heroImages) {
                        try {
                            const response = await fetch(imgUrl, { method: 'HEAD' });
                            if (!response.ok) {
                                console.error(`❌ Image not accessible: ${imgUrl} (${response.status})`);
                            } else {
                                const contentType = response.headers.get('content-type');
                                console.log(`✅ Image OK: ${imgUrl} (${contentType})`);
                            }
                        } catch (err) {
                            console.error(`❌ Failed to validate image ${imgUrl}:`, err.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error processing Truthout article:', err.message);
        }
    }

    // Test ConsortiumNews
    console.log('\n=== ConsortiumNews ===');
    if (testUrls.consortiumnews.length === 0) {
        console.log('No ConsortiumNews articles found to test');
    }
    for (const url of testUrls.consortiumnews) {
        try {
            console.log('\nTesting URL:', url);
            const article = await parseConsortiumNews(url);
            if (article) {
                console.log('Title:', article.title);
                console.log('Found images:', article.heroImages.length);
                if (article.heroImages.length > 0) {
                    console.log('Image URLs:');
                    article.heroImages.forEach((img, i) => console.log(`${i + 1}. ${img}`));

                    // Validate images
                    console.log('\nValidating images...');
                    for (const imgUrl of article.heroImages) {
                        try {
                            const response = await fetch(imgUrl, { method: 'HEAD' });
                            if (!response.ok) {
                                console.error(`❌ Image not accessible: ${imgUrl} (${response.status})`);
                            } else {
                                const contentType = response.headers.get('content-type');
                                console.log(`✅ Image OK: ${imgUrl} (${contentType})`);
                            }
                        } catch (err) {
                            console.error(`❌ Failed to validate image ${imgUrl}:`, err.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error processing ConsortiumNews article:', err.message);
        }
    }

    console.log('\n✨ Image handling test complete!');
}

// Set up error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the test
console.log('Starting test...');
testImageHandling().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
