import fetch from 'node-fetch';
import { load } from 'cheerio';
import { new_articles_loop } from './new_articles.js';
import { monitor } from '../utils/monitoring.js';
import { ERROR_RETRY_INTERVAL } from '../utils/constants.js';
import { ImageHandler } from '../utils/image_handler.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Basic function for getting the information of the post
export async function parseArticle(url) {
  try {
    console.log('Parsing article:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      monitor.logParse('Truthout', {
        status: 'error',
        phase: 'article-fetch',
        url,
        error: `HTTP ${res.status}`
      });
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    
    const html = await res.text();
    if (!html) {
      monitor.logParse('Truthout', {
        status: 'error',
        phase: 'article-fetch',
        url,
        error: 'Empty response'
      });
      throw new Error('Empty response received');
    }
    
    console.log('Successfully fetched article HTML, length:', html.length);
    const $ = load(html);

    // Debug logging of page structure
    console.log('\nAnalyzing Truthout article structure:');
    ['article', '.article', '.post-content', '.content-area'].forEach(selector => {
      console.log(`${selector}:`, $(selector).length ? 'Found' : 'Not found');
    });

    // Get article title
    const titleSelectors = [
      'h1.entry-title',
      'article h1',
      '.article-title',
      '.post-title'
    ];

    let title = '';
    for (const selector of titleSelectors) {
      const titleElem = $(selector).first();
      if (titleElem.length) {
        title = titleElem.text().trim();
        console.log(`Found title with selector "${selector}":`, title);
        break;
      }
    }

    // Get hero image using the ImageHandler utility
    const imageHandler = new ImageHandler('Truthout', 'https://truthout.org', $);
    let heroImages = [];
    
    const imageSelectors = [
      // Primary image selectors - more specific first
      'article figure.featured-image img[width][height]',
      '.article-featured-image img[src*="truthout"]',
      'article .hero-image img[width]',
      // Secondary selectors with quality filters
      '.article-content figure:first-of-type img[width]',
      'article figure.wp-block-image:first-of-type img[width]',
      // Fallback selectors with size constraints
      '.entry-content img[width][height]',
      'article .article-body img:first-of-type[src*="truthout"]'
    ];

    console.log('\nSearching for article images...');
    
    for (const selector of imageSelectors) {
      const imgs = $(selector);
      console.log(`Trying selector "${selector}": found ${imgs.length} images`);
      
      const selectorImages = [];
      imgs.each((_, img) => {
        const $img = $(img);
        
        if (!imageHandler.isArticleImage($img)) {
          console.log('Skipping non-article image:', $img.attr('src'));
          return;
        }
        
        const srcs = imageHandler.getImageSources($img);
        selectorImages.push(...srcs);
      });
      
      if (selectorImages.length > 0) {
        console.log(`Found ${selectorImages.length} potential images with selector "${selector}"`);
        const validatedImages = await imageHandler.filterAndValidateImages(selectorImages);
        if (validatedImages.length > 0) {
          heroImages = validatedImages;
          break;
        }
      }
    }
    
    // Get article content with improved selectors
    const body = [];
    const contentSelectors = [
      'div.article-content p',
      'div.article-body p',
      'main article p',
      'div.entry-content p',
      'div.post-content p',
      'article .content p',
      'div[data-module="article-body"] p'
    ];
    
    // Debug: Log all potential content containers
    console.log('\nPotential content containers:');
    ['div.article-content', 'div.article-body', 'main article', 'div.entry-content', 'div.post-content', 'article .content', 'div[data-module="article-body"]'].forEach(s => {
      const el = $(s);
      console.log(`${s}: ${el.length} found, ${el.find('p').length} paragraphs`);
    });

    for (const selector of contentSelectors) {
      console.log(`Trying content selector: ${selector}`);
      $(selector).each((_, p) => {
        const $p = $(p);
        if (!$p.hasClass('image-caption') && 
            !$p.hasClass('wp-caption-text') && 
            !$p.hasClass('article-source')) {
          const text = $p.text().trim();
          if (text) {
            body.push(text);
          }
        }
      });
      
      if (body.length > 0) {
        console.log(`Found ${body.length} paragraphs with selector "${selector}"`);
        break;
      }
    }

    // Get article date with improved selectors and parsing
    let dateStr = $('time').first().attr('datetime');
    if (!dateStr) dateStr = $('meta[property="article:published_time"]').attr('content');
    if (!dateStr) dateStr = $('meta[name="date"]').attr('content');
    if (!dateStr) {
      const timeElement = $('time').first();
      dateStr = timeElement.attr('datetime') || timeElement.text();
    }
    if (!dateStr) dateStr = $('.article-date, .post-date, .entry-date').first().text();

    console.log('Found date string:', dateStr);
    
    let date;
    if (dateStr) {
      try {
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          // Try to parse more date formats if the initial parse fails
          const match = dateStr.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
          if (match) {
            date = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
          }
        }
      } catch (e) {
        console.error('Error parsing date:', e);
        date = new Date();
      }
    } else {
      date = new Date();
    }
    
    console.log('Parsed date:', date.toISOString());

    // Validate article content
    if (body.length === 0) {
      // Log the full HTML structure for debugging
      console.error('No article content found. Available content:');
      ['article', 'main', '.article-content', '.post-content'].forEach(selector => {
        const el = $(selector);
        if (el.length) {
          console.log(`\n${selector} contents:`, el.html().substring(0, 1000));
        }
      });
      
      monitor.logParse('Truthout', {
        status: 'error',
        phase: 'article-parse',
        url,
        error: 'No article content found'
      });
      throw new Error('No article content found');
    }

    // Validate title
    if (!title) {
      console.warn('No title found for article:', url);
      title = 'Untitled Article';
    }

    // Validate and clean article body
    body = body.filter(p => {
      // Remove empty paragraphs and common non-content elements
      return p && 
             p.length > 10 && // Minimum length
             !p.includes('©') && // Copyright notices
             !p.includes('All rights reserved') &&
             !p.toLowerCase().includes('subscribe to our newsletter');
    });

    if (body.length === 0) {
      throw new Error('Article content was empty after cleaning');
    }

    monitor.logParse('Truthout', {
      status: 'success',
      phase: 'article-parse',
      url,
      stats: {
        hasTitle: !!title,
        heroImages: heroImages.length,
        paragraphs: body.length,
        averageParagraphLength: Math.round(body.reduce((sum, p) => sum + p.length, 0) / body.length)
      }
    });

    return { url, title, heroImages, body, date };
  } catch (err) {
    console.error(`Error parsing article ${url}:`, err);
    monitor.logParse('Truthout', {
      status: 'error',
      phase: 'article-parse',
      url,
      error: err.message
    });
    throw err;
  }
}

// Get articles
export async function GetArticles() {
  console.log('Starting Truthout article fetcher...');
  
  while (true) {
    try {
      const new_urls = await new_articles_loop();

      if (new_urls && new_urls.length > 0) {
        console.log(`Found ${new_urls.length} new Truthout article(s).`);
        
        for (const url of new_urls) {
          console.log('Processing:', url);
          try {
            const article = await parseArticle(url);
            if (article) {
              console.log('Successfully parsed article:', article.title);
            }
          } catch (err) {
            console.error('Error processing article:', url, err);
          }
        }
      } else {
        console.log('No new articles found, sleeping...');
      }
    } catch (err) {
      console.error('Error in article fetching loop:', err);
    }

    // Wait before next fetch
    await sleep(ERROR_RETRY_INTERVAL);
  }
}


