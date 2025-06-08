import fetch from 'node-fetch';

/**
 * Utility functions for handling article images
 */
export class ImageHandler {
  constructor(siteName, baseUrl, cheerio) {
    this.siteName = siteName;
    this.baseUrl = baseUrl;
    this.$ = cheerio;
    this.skipClasses = [
      'avatar',
      'social-icon',
      'donate-button',
      'logo',
      'icon',
      'rssfeedimage'
    ];
    
    this.skipParents = [
      'sidebar',
      'footer',
      'header',
      'nav',
      'widget',
      'menu'
    ];
    
    this.skipSrcParts = [
      'logo',
      'button',
      'avatar',
      'icon',
      'banner',
      'ads',
      'placeholder',
      'data:image' // Skip data URLs
    ];
  }

  /**
   * Check if an image is a valid article image
   */
  isArticleImage($img) {
    const imgClass = $img.attr('class') || '';
    const imgSrc = $img.attr('src') || '';
    const parentClasses = $img.parents().map((_, el) => this.$(el).attr('class') || '').get().join(' ');

    // Relaxed filtering rules
    return !this.skipClasses.some(c => imgClass.toLowerCase().includes(c)) &&
           !this.skipParents.some(p => parentClasses.toLowerCase().includes(p)) &&
           !this.skipSrcParts.some(p => imgSrc.toLowerCase().includes(p)) &&
           !imgSrc.startsWith('data:image'); // Skip data URLs
  }

  /**
   * Get all possible image sources from an image element
   */
  getImageSources($img) {
    const srcs = new Set();

    // Regular src first
    const src = $img.attr('src');
    if (src) srcs.add(this.makeUrlAbsolute(src));

    // High-quality source
    const dataSrc = $img.attr('data-src') || $img.attr('data-full-src') || $img.attr('data-lazy-src');
    if (dataSrc) srcs.add(this.makeUrlAbsolute(dataSrc));

    // Responsive images - prefer larger sizes
    const srcset = $img.attr('srcset');
    if (srcset) {
      const sources = srcset.split(',')
        .map(s => {
          const [url, width] = s.trim().split(' ');
          return {
            url: url,
            width: parseInt(width) || 0
          };
        })
        .sort((a, b) => b.width - a.width); // Sort by width descending

      if (sources.length > 0) {
        srcs.add(this.makeUrlAbsolute(sources[0].url)); // Add largest version
      }
    }

    // Filter out duplicates that only differ in size parameters
    const normalized = new Map();
    Array.from(srcs).forEach(url => {
      const baseUrl = url.split('?')[0];
      if (!normalized.has(baseUrl) || url.length < normalized.get(baseUrl).length) {
        normalized.set(baseUrl, url);
      }
    });

    return Array.from(normalized.values());
  }

  /**
   * Make a URL absolute
   */
  makeUrlAbsolute(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return this.baseUrl + (url.startsWith('/') ? url : '/' + url);
  }

  /**
   * Validate an image URL
   */
  async validateImage(url) {
    if (!url) return false;
    
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        console.log(`Image ${url} is not accessible, status: ${response.status}`);
        return false;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/') || contentType.includes('svg')) {
        console.log(`Invalid image type for ${url}: ${contentType}`);
        return false;
      }

      return true;
    } catch (err) {
      console.log(`Failed to validate image ${url}:`, err.message);
      return false;
    }
  }

  /**
   * Filter and validate a list of image URLs
   */
  async filterAndValidateImages(urls) {
    const validUrls = [];
    
    for (const url of urls) {
      if (await this.validateImage(url)) {
        validUrls.push(url);
        if (validUrls.length >= 3) break; // Only need top 3 valid images
      }
    }
    
    return validUrls;
  }
}

// Helper function to validate image URLs
function isValidArticleImage(imgSrc, hostname) {
    // Don't process SVG placeholders
    if (imgSrc.startsWith('data:')) {
        return false;
    }
    
    try {
        const url = new URL(imgSrc);
        
        // Handle ProPublica images
        if (hostname.includes('propublica.org')) {
            return (url.hostname.includes('propublica.org') || 
                   url.hostname.includes('assets-c3.propublica.org') ||
                   url.hostname.includes('img.assets-d.propublica.org')) &&
                   !url.pathname.includes('avatar');
        }
        
        // Handle Truthout images
        if (hostname.includes('truthout.org')) {
            return url.hostname.includes('truthout.org') && 
                   !url.pathname.includes('avatar') &&
                   !url.pathname.includes('author');
        }
        
        // Handle ConsortiumNews images
        if (hostname.includes('consortiumnews.com')) {
            // Allow wp-content uploads but exclude tiny thumbnails
            return url.hostname.includes('consortiumnews.com') && 
                   url.pathname.includes('/wp-content/uploads/') &&
                   !url.pathname.includes('-150x150') &&
                   !url.pathname.includes('-100x100');
        }
        
        return false;
    } catch {
        return false;
    }
}

async function extractArticleImages(article, articleUrl) {
    const images = new Set();
    const hostname = new URL(articleUrl).hostname;
    
    // Source-specific selectors - more targeted approach
    const selectorsByDomain = {
        'propublica.org': [
            '.lead-art img[width][height]',
            'article .article-body img[width][height]',
            '.story-body figure img[width]'
        ],
        'truthout.org': [
            '.featured-image img',
            'article img.wp-post-image',
            '.entry-content img:not(.avatar)',
            'article .content img'
        ],
        'consortiumnews.com': [
            '.entry-content img[src*="wp-content/uploads"]',
            '.featured-image img',
            '.post-thumbnail img',
            'article .post-content img'
        ]
    };
    
    // Get the appropriate selectors for this hostname
    const domainKey = Object.keys(selectorsByDomain).find(domain => hostname.includes(domain));
    const selectors = domainKey ? selectorsByDomain[domainKey] : [];
    
    // Try each selector
    for (const selector of selectors) {
        article(selector).each((_, img) => {
            const imgSrc = article(img).attr('src');
            if (imgSrc && isValidArticleImage(imgSrc, hostname)) {
                // Handle both absolute and relative URLs
                try {
                    const absoluteUrl = new URL(imgSrc, articleUrl).href;
                    images.add(absoluteUrl);
                } catch {
                    // If URL parsing fails, try the original URL
                    images.add(imgSrc);
                }
            }
        });
    }
    
    return [...images];
}

// Export the functions
export { isValidArticleImage, extractArticleImages };
