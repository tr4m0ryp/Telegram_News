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

    // Get hero image - ProPublica usually has a lead image with class 'lead-image'
    const heroImages = [];
    const leadImage = $('.lead-image img, .article-header__lead-image img').first();
    if (leadImage.length) {
      const src = leadImage.attr('src');
      if (src) heroImages.push(src);
    }

    // Get article body - ProPublica uses different classes for article content
    const body = [];
    $('.article-body p, .body-content p').each((_, p) => {
      const txt = $(p).text().trim();
      // Skip empty paragraphs and image captions
      if (txt && !$(p).hasClass('caption') && !$(p).hasClass('credit')) {
        body.push(txt);
      }
    });

    return { url, heroImages, body };
  } catch (err) {
    console.error(`Error parsing article ${url}:`, err);
    throw err;
  }
}

//getarticles
export async function GetArticles() {
  try {
    const new_urls = await new_articles_loop();

    if (new_urls && new_urls.length > 0) {
      console.log(`Found ${new_urls.length} new URL(s).`);
      
      // Process the first new article (since we want to process one at a time)
      const url = new_urls[0];
      console.log('⬇️  Fetching:', url);
      try {
        const article = await parseArticle(url);
        console.log('Parsed article successfully');
        return article;
      } catch (err) {
        console.error('Error parsing', url, err);
        return null;
      }
    }
    
    return null;
  } catch (err) {
    console.error('Error in GetArticles:', err);
    return null;
  }
}


