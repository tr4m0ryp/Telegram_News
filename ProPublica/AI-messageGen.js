import { GoogleGenAI } from "@google/genai";
import { parseArticle, GetLatestArticle } from "./GetArticleinfo.js";
import { globalStats } from '../utils/counter.js';
import { config } from '../utils/config.js';
import { url_filtering } from './url_filtering.js';
import { sendNewsMessage } from '../sender.js';

const ai = new GoogleGenAI({ apiKey: "AIzaSyBu5IPEdCfhIS4zPXqcC3qi82UM0IKDbeA" }); //keep this api key; is free

// Temporarily store the original logStats function
const originalLogStats = globalStats.logStats;

export async function AI_message_Gen(articleOrUrl = null, showStats = false) {
  // If showStats is false, temporarily disable logStats
  if (!showStats) {
    globalStats.logStats = () => {};
  }

  let article;
  try {
    if (typeof articleOrUrl === 'string') {
      // If a URL is provided, parse it
      article = await parseArticle(articleOrUrl);
    } else if (articleOrUrl && typeof articleOrUrl === 'object') {
      // If an article object is provided, use it directly
      article = articleOrUrl;
    } else {
      // If nothing is provided, try to fetch the latest article
      console.log('No article or URL provided, fetching latest ProPublica article...');
      const articles = await url_filtering(false);
      if (!articles || articles.length === 0) {
        console.log('No articles found.');
        if (!showStats) {
          globalStats.logStats = originalLogStats;
        }
        return null;
      }
      console.log(`Found ${articles.length} articles, getting latest...`);
      article = await GetLatestArticle(articles);
    }
  } catch (error) {
    console.error('Error fetching or parsing article:', error);
    if (!showStats) {
      globalStats.logStats = originalLogStats;
    }
    throw error;
  }

  if (!article || !article.body || article.body.length === 0) {
    console.log("No valid article data found.");
    if (!showStats) {
      globalStats.logStats = originalLogStats;
    }
    return null;
  }

  const { url, heroImages, body } = article;
  console.log('Processing article:', url);
  console.log('Hero images:', heroImages.length);
  console.log('Body paragraphs:', body.length);

  const baseprompt = `
You are a Telegram news channel editor bot. You receive the full article body as an array of paragraphs in the variable {{body}}. Your task is to produce a single, concise description (no more than 3–4 sentences) that highlights only the most essential facts and conveys them clearly to a Telegram audience.

Guidelines:
- Keep it short and to the point (aim for 50–70 words).
- Lead with the who, what, where, and why: the subject of the piece, what happened, where it took place, and the reason it matters.
- Omit background detail and commentary—focus on hard facts.
- Write in a neutral, news-style tone.

Here is the body:
`;

  const bodyText = body.join("\n\n");
  const prompt = `${baseprompt}${bodyText}`;
    
  let summary;
  try {
    console.log('Generating AI summary...');
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });
    summary = response.text;
    console.log('Generated summary:', summary);
  } catch (error) {
    console.error('Error generating AI summary:', error);
    summary = `Latest from ProPublica: ${article.title || 'Untitled Article'}. Read the full story for details at ${url}.`;
  }

  // Increment AI message counter
  globalStats.incrementAiMessages();

  // Restore original logStats
  if (!showStats) {
    globalStats.logStats = originalLogStats;
  }

  const result = {
    summary,
    url,
    heroImage: heroImages[0] || null
  };

  console.log('\nGenerated AI Message:');
  console.log('-------------------');
  console.log(summary);
  console.log('-------------------\n');
  if (heroImages[0]) {
    console.log('Hero Image to be sent:', heroImages[0]);
  } else {
    console.log('No Hero Image available for this article.');
  }

  return result;
}

// Self-executing function to handle the async result when run directly
AI_message_Gen().then(async result => {
  if (result) {
    console.log('Generation completed successfully.');
    console.log('Sending message to Telegram...');
    await sendNewsMessage(result.summary, result.heroImage, result.url);
    console.log('Message sent successfully.');
  } else {
    console.log('No message was generated.');
  }
}).catch(error => {
  console.error('Error during message generation:', error);
});