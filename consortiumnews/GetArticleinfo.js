import fetch from 'node-fetch';
import { load } from 'cheerio';
import { new_articles_loop } from './new_articles.js';
import { ImageHandler } from '../utils/image_handler.js';


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//basic function for getting the information of the post
export async function parseArticle(url) {
  try {
    if (!url) {
      throw new Error('No URL provided');
    }
    
    // Validate and normalize URL
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('consortiumnews.com')) {
        throw new Error('Invalid domain');
      }
      url = urlObj.href; // Use normalized URL
    } catch (e) {
      throw new Error(`Invalid URL ${url}: ${e.message}`);
    }

    console.log('Parsing article:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    
    const html = await res.text();
    if (!html) {
      throw new Error('Empty response received');
    }
    
    const $ = load(html);
    
    // Get article title
    const titleSelectors = [
      '.entry-title',
      'article h1',
      '.post-title',
      'header h1'
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

    if (!title) {
      console.warn('No title found for article:', url);
      title = 'Untitled Article';
    }
    
    // Get hero image using the ImageHandler utility
    const imageHandler = new ImageHandler('ConsortiumNews', 'https://consortiumnews.com', $);
    let heroImages = [];
    
    const imageSelectors = [
      // Primary image selectors
      '.featured-image img[width][height]',
      '.post-thumbnail img[src*="consortiumnews"]',
      '.entry-header img[width][height]',
      // Secondary selectors
      '.entry-content > figure:first-of-type img[width]',
      '.entry-content > p:first-of-type img[width]',
      // Fallback selectors
      'article .post-content img[width][height]',
      '.entry-content img[src*="consortiumnews"]'
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
        // Transform each image URL to full resolution
        const fullResSrcs = srcs.map(getFullResolutionImage);
        selectorImages.push(...fullResSrcs);
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
    
    // Get article content
    const body = [];
    const contentSelectors = [
      'div.entry-content p',
      'article .post-content p',
      '.post-article .entry-content p',
      '.article-content p'
    ];

    let foundContent = false;
    for (const selector of contentSelectors) {
      console.log(`Trying content selector: ${selector}`);
      $(selector).each((_, p) => {
        const $p = $(p);
        // Skip captions and other non-content paragraphs
        if (!$p.closest('figcaption').length && 
            !$p.hasClass('wp-caption-text') &&
            !$p.hasClass('image-caption')) {
          const text = $p.text().trim();
          if (text.length > 10) { // Minimum length to filter out short snippets
            body.push(text);
            foundContent = true;
          }
        }
      });
      
      if (foundContent) {
        console.log(`Found ${body.length} paragraphs with selector "${selector}"`);
        break;
      }
    }

    // Validate content
    if (body.length === 0) {
      throw new Error('No article content found');
    }

    // Get article date
    let date;
    const dateSelectors = [
      'time.entry-date',
      '.post-date time',
      'meta[property="article:published_time"]',
      '.entry-meta time'
    ];

    for (const selector of dateSelectors) {
      const dateElem = $(selector);
      if (dateElem.length) {
        const dateStr = dateElem.attr('datetime') || dateElem.text();
        try {
          date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            break;
          }
        } catch (e) {
          console.warn(`Failed to parse date from selector ${selector}:`, e.message);
        }
      }
    }

    if (!date || isNaN(date.getTime())) {
      console.warn('Could not parse article date, using current date');
      date = new Date();
    }

    // Get article images
    const images = [];
    const imgSelectors = ['.entry-content img', 'article img'];
    imgSelectors.forEach(selector => {
      $(selector).each((index, element) => {
        const $img = $(element);
        const src = $img.attr('src');
        if (src && imageHandler.isArticleImage($img)) {
          images.push(src);
        }
      });
    });

    if (images.length === 0) {
      console.log('No valid images found for article:', url);
    } else {
      console.log(`Found ${images.length} images for article:`, url);
    }

    return { url, title, heroImages, body, date, images };
  } catch (err) {
    console.error(`Error parsing ConsortiumNews article ${url}:`, err);
    throw err;
  }
}

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

// Function to get a specific article
export async function GetArticles(url) {
  return await parseArticle(url);
}

// Function to get the latest article from a list of URLs
export async function GetLatestArticle(articles) {
  if (!articles || articles.length === 0) {
    console.log('No articles provided to GetLatestArticle');
    return null;
  }

  // Sort articles by date
  const sortedArticles = [...articles].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
  
  const latest = sortedArticles[0];
  console.log('Fetching latest article:', latest.url);
  
  // Parse the article for content
  const articleContent = await parseArticle(latest.url);
  
  // Use the preview image from the listing instead of searching the article
  return {
    ...articleContent,
    heroImages: latest.previewImage ? [latest.previewImage] : articleContent.heroImages
  };
}


