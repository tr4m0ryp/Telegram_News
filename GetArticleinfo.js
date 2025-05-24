import fetch from 'node-fetch';
import { load } from 'cheerio';

export async function GetArticle() {
  const url = 'https://consortiumnews.com/2025/05/23/elias-rodriguezs-murderous-gift-to-israel/';
  const res = await fetch(url);
  const html = await res.text();

  const $ = load(html);

  let heroImages = [];
  const heroCaption = $('.entry-content .wp-caption').first();
  if (heroCaption.length) {
    heroCaption.find('img').each((i, img) => {
      heroImages.push($(img).attr('src'));
    });
  } else {
    const firstImg = $('.entry-content img').first().attr('src');
    if (firstImg) heroImages.push(firstImg);
  }

  let body = [];
  $('.entry-content > p').each((i, p) => {
    const txt = $(p).text().trim();
    if (txt) body.push(txt);
  });

  console.log({heroImages, body });

  return heroImages, body
}
