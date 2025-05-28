import fetch from 'node-fetch';
import { load } from 'cheerio';
import { new_articles_loop } from './new_articles.js';


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



//basic function for getting the information of the post
async function parseArticle(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    
    const html = await res.text();
    const $ = load(html);

    // Get hero image - Truthout uses featured-image class
    const heroImages = [];
    const featuredImage = $('.featured-image img, .article-header img').first();
    if (featuredImage.length) {
      const src = featuredImage.attr('src');
      if (src) heroImages.push(src);
    }

    // Get article body - Truthout uses article-body class
    const body = [];
    $('.article-body p, .entry-content p').each((_, p) => {
      const txt = $(p).text().trim();
      // Skip empty paragraphs and image captions
      if (txt && !$(p).hasClass('image-caption') && !$(p).hasClass('wp-caption-text')) {
        body.push(txt);
      }
    });

    return { url, heroImages, body };
  } catch (err) {
    console.error(`Error parsing Truthout article ${url}:`, err);
    throw err;
  }
}

//getarticles
export async function GetArticles(interval_ms = 6000) {
  console.log('Starting Truthout article fetcher loop…');

  while (true) {
    try {
      const new_urls = await new_articles_loop(interval_ms);

      if (new_urls && new_urls.length > 0) {
        console.log(`Found ${new_urls.length} new Truthout article(s).`);
        
        for (const url of new_urls) {
          console.log('Fetching:', url);
          try {
            const article = await parseArticle(url);
            if (article.body.length > 0) {
              return article;
            } else {
              console.log('Article body empty, skipping:', url);
            }
          } catch (err) {
            console.error('Error parsing', url, err);
          }
        }
      }

      await sleep(interval_ms);
    } catch (err) {
      console.error('Error in Truthout article fetcher:', err);
      await sleep(interval_ms);
    }
  }
}


