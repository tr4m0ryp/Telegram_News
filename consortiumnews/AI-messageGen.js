import { GoogleGenAI } from "@google/genai";
import { GetArticles, GetLatestArticle } from "./GetArticleinfo.js";
import { globalStats } from '../utils/counter.js';
//import { config } from '../utils/config.js';
import { url_filtering } from './url_filtering.js';

const ai = new GoogleGenAI({ apiKey: "AIzaSyBu5IPEdCfhIS4zPXqcC3qi82UM0IKDbeA" })//config.google.apiKey });

// Temporarily store the original logStats function
const originalLogStats = globalStats.logStats;

export async function AI_message_Gen(isStartupPhase = false, showStats = false) {
  // If showStats is false, temporarily disable logStats
  if (!showStats) {
    globalStats.logStats = () => {};
  }

  let article;
  try {
    if (isStartupPhase) {
      console.log('Getting latest article in startup mode...');
      const articles = await url_filtering(true);
      if (articles && articles.length > 0) {
        console.log(`Found ${articles.length} articles, fetching latest...`);
        article = await GetLatestArticle(articles);
      } else {
        console.log('No articles found in startup mode');
      }
    } else {
      console.log('Getting articles in normal mode...');
      const articles = await url_filtering(false);
      if (articles && articles.length > 0) {
        console.log(`Found ${articles.length} articles, getting latest...`);
        article = await GetLatestArticle(articles);
      } else {
        console.log('No articles found in normal mode');
      }
    }
    console.log('Article fetch result:', article ? 'Article found' : 'No article found');
        
    if (article) {
      console.log('Article URL:', article.url);
      console.log('Has hero images:', article.heroImages?.length || 0);
      console.log('Body paragraphs:', article.body?.length || 0);
    }
  } catch (error) {
    console.error('Error fetching article:', error);
    // Restore original logStats before throwing
    if (!showStats) {
      globalStats.logStats = originalLogStats;
    }
    throw error;
  }

  if (!article || !article.body || article.body.length === 0) {
    // Restore original logStats before returning
    if (!showStats) {
      globalStats.logStats = originalLogStats;
    }
    console.log("No new article found on ConsortiumNews");
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
    
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt
  });

  const summary = response.text;

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

  return result;
}
