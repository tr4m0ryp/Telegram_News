import { sendNewsMessage } from './sender.js';
import { config } from './utils/config.js';
import { monitor } from './utils/monitoring.js';
import { url_filtering as proPublicaUrlFiltering } from './ProPublica/url_filtering.js';
import { url_filtering as consortiumUrlFiltering } from './consortiumnews/url_filtering.js';
import { GetLatestArticle } from './consortiumnews/GetArticleinfo.js';
import { AI_message_Gen } from './consortiumnews/AI-messageGen.js';
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import cheerio from "cheerio";

const ai = new GoogleGenAI({ apiKey: config.google.apiKey });

/**
 * Fetches a ProPublica article URL, extracts its body paragraphs, and uses Gemini to generate a short summary.
 * Returns the trimmed summary text or null if something fails.
 */
async function summarizeProPublicaArticle(url) {
  let html;
  try {
    html = await fetch(url).then(res => res.text());
  } catch (err) {
    console.error('❌ Error fetching ProPublica article HTML:', err);
    return null;
  }

  const $ = cheerio.load(html);
  let paragraphs = [];
  if ($("article .article-body p").length) {
    paragraphs = $("article .article-body p").toArray().map(el => $(el).text().trim());
  } else if ($(".body-content p").length) {
    paragraphs = $(".body-content p").toArray().map(el => $(el).text().trim());
  } else if ($(".story-body p").length) {
    paragraphs = $(".story-body p").toArray().map(el => $(el).text().trim());
  }

  if (!paragraphs.length) {
    console.warn('⚠️ No body paragraphs found to summarize for ProPublica');
    return null;
  }

  const basePrompt = `
You are a Telegram news channel editor bot. Below is the article body as an array of paragraphs. Produce a concise 50–70 word summary (3–4 sentences max) highlighting who, what, where, and why. Omit commentary. End with a "read more" call-to-action.

Here is the body:
`;
  const prompt = basePrompt + paragraphs.join("\n\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });
    return response.text.trim();
  } catch (err) {
    console.error('❌ Error generating ProPublica summary:', err);
    return null;
  }
}

async function testTelegram() {
  console.log('🔄 Testing Telegram configuration and full pipeline…');

  // 1) Check environment variables
  console.log('🔍 Verifying environment variables...');
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    throw new Error('Missing required Telegram environment variables');
  }
  console.log('✅ Environment variables present');

  //
  // ProPublica: fetch latest, summarize, then send via AI
  //
  console.log('\n📥 Fetching latest ProPublica article…');
  let propubArticles;
  try {
    propubArticles = await proPublicaUrlFiltering(false);
  } catch (err) {
    console.error('❌ Error in ProPublica url_filtering:', err);
    propubArticles = [];
  }

  if (!propubArticles.length) {
    console.log('⚠️ No recent ProPublica articles found');
  } else {
    const latestPropub = propubArticles[0];
    console.log('✅ Latest ProPublica URL:', latestPropub.url);

    console.log('🔄 Summarizing ProPublica article via AI…');
    const propubSummary = await summarizeProPublicaArticle(latestPropub.url);
    if (!propubSummary) {
      console.log('⚠️ Skipping ProPublica send; summarization failed');
    } else {
      const propubText = `📰 *ProPublica*\n${propubSummary}\n\n[Read more ›](${latestPropub.url})`;
      const propubImage = latestPropub.previewImage || null;

      console.log('\n📤 Sending ProPublica AI-generated message...');
      try {
        await sendNewsMessage(propubText, propubImage, null);
        console.log('✅ ProPublica message sent successfully');
      } catch (error) {
        console.error('❌ Error sending ProPublica message:', error);
      }
    }
  }

  //
  // ConsortiumNews: fetch latest, AI summary, then send
  //
  console.log('\n📥 Fetching latest ConsortiumNews article…');
  let consArticles;
  try {
    consArticles = await consortiumUrlFiltering(false);
  } catch (err) {
    console.error('❌ Error in ConsortiumNews url_filtering:', err);
    consArticles = [];
  }

  if (!consArticles.length) {
    console.log('⚠️ No recent ConsortiumNews articles found');
    return;
  }

  console.log(`✅ Found ${consArticles.length} ConsortiumNews articles, picking latest…`);
  let consArticle;
  try {
    consArticle = await GetLatestArticle(consArticles);
  } catch (err) {
    console.error('❌ Error in GetLatestArticle:', err);
    consArticle = null;
  }

  if (!consArticle) {
    console.log('⚠️ Could not retrieve detailed ConsortiumNews article');
    return;
  }

  console.log('✅ Latest ConsortiumNews URL:', consArticle.url);
  console.log('🔄 Generating AI summary for ConsortiumNews article…');

  let aiResult;
  try {
    aiResult = await AI_message_Gen(false);
  } catch (err) {
    console.error('❌ Error generating AI summary for ConsortiumNews:', err);
    aiResult = null;
  }

  if (!aiResult) {
    console.log('⚠️ AI summary for ConsortiumNews failed or returned null');
    return;
  }

  const consText = `🗞️ *ConsortiumNews*\n${aiResult.summary}\n\n[Read more ›](${consArticle.url})`;
  const consImage = aiResult.heroImage || null;

  console.log('\n📤 Sending ConsortiumNews AI-generated message...');
  try {
    await sendNewsMessage(consText, consImage, null);
    console.log('✅ ConsortiumNews message sent successfully');
  } catch (error) {
    console.error('❌ Error sending ConsortiumNews message:', error);
  }
}

// Run the Telegram test sequence
console.log('🎬 Starting Telegram test sequence...');
testTelegram()
  .then(() => {
    console.log('\n✨ All Telegram tests completed!');
  })
  .catch(err => {
    console.error('Fatal error in Telegram tests:', err);
    process.exit(1);
  });
