import fetch from 'node-fetch';
import { load } from 'cheerio';
import { new_articles_loop } from './new_articles.js';


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



//basic function for geeting the infromation of the post
async function parseArticle(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} bij ${url}`);
  const html = await res.text();
  const $ = load(html);

  const heroImages = [];
  const cap = $('.entry-content .wp-caption').first();
  if (cap.length) {
    cap.find('img').each((_, img) => {
      const src = $(img).attr('src');
      if (src) heroImages.push(src);
    });
  } else {
    const firstImg = $('.entry-content img').first().attr('src');
    if (firstImg) heroImages.push(firstImg);
  }

  const body = [];
  $('.entry-content > p').each((_, p) => {
    const txt = $(p).text().trim();
    if (txt) body.push(txt);
  });

  return { url, heroImages, body };
}


//getarticles
export async function GetArticles(interval_ms = 6000) {
  console.log('Starting article fetcher loop…');

  while (true) {
    try {
      const new_urls = await new_articles_loop(interval_ms);

      if (new_urls.length > 0) {
        console.log(`Found ${new_urls.length} new URL(s).`);
      } else {
        //console.log(' No new URLs this cycle.');
      }

      for (const url of new_urls) {
        console.log('⬇️  Fetching:', url);
        try {
          const article = await parseArticle(url);
          console.log('Parsed article:', article);
          return article;
        } catch (err) {
          console.error('Error parsing', url, err);
        }
      }
    } catch (err) {
      console.error('fucking error', err);
    }

    await sleep(interval_ms);
  }
}


