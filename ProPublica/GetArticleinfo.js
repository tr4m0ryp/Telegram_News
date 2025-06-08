import fetch from 'node-fetch';
import { load } from 'cheerio';
import { monitor } from '../utils/monitoring.js';
import { ImageHandler } from '../utils/image_handler.js';


export async function parseArticle(url) {
  try {
    console.log('Parsing article:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    
    const html = await res.text();
    const $ = load(html);

    // Debug logging of page structure
    console.log('\nAnalyzing ProPublica article structure:');
    ['article', '.story-body', '.story-header', '.lead-art'].forEach(selector => {
      console.log(`${selector}:`, $(selector).length ? 'Found' : 'Not found');
    });

    // Get article title with multiple selectors
    const titleSelectors = [
      'h1.hed',
      'article h1',
      '.story-header h1',
      '.article-header h1',
      'h1[data-qa="article-title"]'
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

    // Get hero image - prioritize main ProPublica domain images
    let heroImages = [];
    
    console.log('\nSearching for ProPublica article images...');
    
    // First, look specifically for main domain images (img.assets-d.propublica.org)
    const mainDomainImages = [];
    $('img').each((_, img) => {
      const $img = $(img);
      const src = $img.attr('src') || $img.attr('data-src');
      
      if (src && src.includes('img.assets-d.propublica.org')) {
        const width = parseInt($img.attr('width') || '0');
        const height = parseInt($img.attr('height') || '0');
        
        // Prioritize larger images (likely the main hero image)
        mainDomainImages.push({
          url: src,
          width: width,
          height: height,
          size: width * height
        });
        
        console.log(`Found main domain image: ${src} (${width}x${height})`);
      }
    });
    
    // Sort by size (largest first) and take the largest one
    if (mainDomainImages.length > 0) {
      mainDomainImages.sort((a, b) => b.size - a.size);
      const bestImage = mainDomainImages[0];
      console.log(`Selected largest image: ${bestImage.url} (${bestImage.width}x${bestImage.height})`);
      
      // Validate the selected image
      try {
        const response = await fetch(bestImage.url, { method: 'HEAD' });
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.startsWith('image/') && !contentType.includes('svg')) {
            heroImages = [bestImage.url];
            console.log('✓ Main domain image validated successfully');
          }
        }
      } catch (error) {
        console.log(`Failed to validate main domain image: ${error.message}`);
      }
    }
    
    // If no main domain image found, use fallback selectors
    if (heroImages.length === 0) {
      console.log('No main domain image found, using fallback selectors...');
      
      const imageHandler = new ImageHandler('ProPublica', 'https://www.propublica.org', $);
      const imageSelectors = [
        // Look for large images in article sections
        '.lead-art img[width][height]',
        'figure.lead-art img[src]',
        '.hero-image img[src]',
        'article figure img[width]',
        '.article-header img',
        '.story-header img',
        // Broader selectors as last resort
        'article img[width]'
      ];
      
      for (const selector of imageSelectors) {
        const imgs = $(selector);
        console.log(`Trying fallback selector "${selector}": found ${imgs.length} images`);
        
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
      
      // Final fallback to meta tags if no hero image is found
      if (heroImages.length === 0) {
        console.log('No hero image found with selectors, checking meta tags...');
        const metaImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        if (metaImage) {
          console.log('Found meta image:', metaImage);
          try {
            const response = await fetch(metaImage, { method: 'HEAD' });
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.startsWith('image/') && !contentType.includes('svg')) {
                heroImages = [metaImage];
                console.log('✓ Meta image validated successfully');
              }
            }
          } catch (error) {
            console.log(`Failed to validate meta image: ${error.message}`);
          }
        } else {
          console.log('No meta image found.');
        }
      }
    }

    // Get article content
    const body = [];
    const contentSelectors = [
      '.body-content p',
      '.story-body p',
      'article .article-body p',
      '.story-text p'
    ];

    for (const selector of contentSelectors) {
      console.log(`Trying content selector: ${selector}`);
      $(selector).each((_, p) => {
        const text = $(p).text().trim();
        if (text && !$(p).hasClass('caption')) {
          body.push(text);
        }
      });
      
      if (body.length > 0) {
        console.log(`Found ${body.length} paragraphs with selector "${selector}"`);
        break;
      }
    }

    // Get article date
    const dateStr = $('time').first().attr('datetime') || 
                   $('meta[property="article:published_time"]').attr('content') ||
                   $('.pubdate').text();
    const date = dateStr ? new Date(dateStr) : new Date();

    monitor.logParse('ProPublica', {
      status: 'success',
      phase: 'article-parse',
      url,
      stats: {
        hasTitle: !!title,
        heroImages: heroImages.length,
        paragraphs: body.length
      }
    });

    return { url, title, heroImages, body, date };
  } catch (err) {
    console.error('Error parsing article:', err);
    monitor.logParse('ProPublica', {
      status: 'error',
      phase: 'article-parse',
      url,
      error: err.message
    });
    throw err;
  }
}


export async function GetLatestArticle(articles) {
  if (!articles || articles.length === 0) {
    console.log('No articles provided to GetLatestArticle');
    return null;
  }

  // Sort by date if available, otherwise assume the first is the latest
  let latestArticle = articles[0];
  if (articles[0].date) {
    latestArticle = articles.reduce((latest, current) => {
      if (!current.date) return latest;
      return latest.date > current.date ? latest : current;
    }, articles[0]);
  }

  console.log(`Selected latest article: ${latestArticle.url}`);
  
  // If the article already has full details (body), return it
  if (latestArticle.body && latestArticle.body.length > 0) {
    return latestArticle;
  }

  // Otherwise, parse the full article
  return await parseArticle(latestArticle.url);
}


