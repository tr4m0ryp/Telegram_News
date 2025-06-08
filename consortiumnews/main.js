import { url_filtering } from './url_filtering.js';
import { GetLatestArticle } from './GetArticleinfo.js';
import { AI_message_Gen } from './AI-messageGen.js';
import { sendNewsMessage } from '../sender.js';
import { globalStats } from '../utils/counter.js';
import { logError, logNewArticle } from '../utils/logger.js';
import { FETCH_INTERVAL } from '../utils/constants.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyBu5IPEdCfhIS4zPXqcC3qi82UM0IKDbeA" });

async function generateAISummary(article) {
  try {
    if (!article || !article.body || article.body.length === 0) {
      console.log("No article content to generate summary for");
      return null;
    }

    const { body, url } = article;
    console.log(`Generating AI summary for ConsortiumNews article: ${url}`);

    // Add unique context and timestamp to prevent caching issues
    const timestamp = new Date().toISOString();
    const uniqueId = Math.random().toString(36).substring(7);
    
    const baseprompt = `
[CONSORTIUM NEWS ARTICLE ${uniqueId} - ${timestamp}]
You are a Telegram news channel editor bot. You must analyze the specific ConsortiumNews article content provided below. Your task is to produce a single, concise description (no more than 3–4 sentences) that highlights only the most essential facts from THIS SPECIFIC ARTICLE and conveys them clearly to a Telegram audience.

IMPORTANT: Base your summary ONLY on the article content provided below. Do not reference any other articles or content.

Guidelines:
- Keep it short and to the point (aim for 50–70 words).
- Lead with the who, what, where, and why: the subject of the piece, what happened, where it took place, and the reason it matters.
- Omit background detail and commentary—focus on hard facts from THIS article.
- Write in a neutral, news-style tone.
- ONLY summarize the content provided below.

Article content from ${url}:
`;

    const bodyText = body.join("\n\n");
    const prompt = `${baseprompt}\n\n${bodyText}\n\n[END OF ARTICLE ${uniqueId}]`;
        
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });

    const summary = response.text;

    // Increment AI message counter
    globalStats.incrementAiMessages();

    console.log('\nGenerated AI Message:');
    console.log('-------------------');
    console.log(summary);
    console.log('-------------------\n');

    return summary;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return null;
  }
}

let previousUrls = [];
let currentInterval = FETCH_INTERVAL;
let consecutiveFailures = 0;
const MIN_INTERVAL = 3 * 60 * 1000; // 3 minutes
const MAX_INTERVAL = 15 * 60 * 1000; // 15 minutes
const PREVIOUS_URLS_FILE = './previous_urls.json';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showFetchingAnimation() {
  const frames = ['.', '..', '...', '....'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\rFetching new ConsortiumNews articles${frames[i]}`);
    i = (i + 1) % frames.length;
  }, 500);
  return interval;
}

async function loadPreviousUrls() {
  try {
    if (existsSync(PREVIOUS_URLS_FILE)) {
      const data = await readFile(PREVIOUS_URLS_FILE, 'utf8');
      previousUrls = JSON.parse(data);
      console.log(`Loaded ${previousUrls.length} previous URLs from file.`);
    } else {
      console.log('No previous URLs file found, starting with empty list.');
    }
  } catch (error) {
    logError(`Error loading previous URLs: ${error.message}`);
    console.error('Error loading previous URLs:', error);
    previousUrls = [];
  }
}

async function savePreviousUrls() {
  try {
    // Limit to the last 100 URLs to prevent unbounded growth
    const limitedUrls = previousUrls.slice(-100);
    await writeFile(PREVIOUS_URLS_FILE, JSON.stringify(limitedUrls, null, 2), 'utf8');
    // Update in-memory list to match saved list
    previousUrls = limitedUrls;
  } catch (error) {
    logError(`Error saving previous URLs: ${error.message}`);
    console.error('Error saving previous URLs:', error);
  }
}

async function adjustInterval(foundNewArticles) {
  if (foundNewArticles) {
    // If new articles are found, check more frequently
    currentInterval = Math.max(MIN_INTERVAL, currentInterval - 60 * 1000); // Decrease by 1 minute
    consecutiveFailures = 0;
  } else if (consecutiveFailures >= 3) {
    // If no new articles and repeated failures, check less frequently
    currentInterval = Math.min(MAX_INTERVAL, currentInterval + 2 * 60 * 1000); // Increase by 2 minutes
  } else {
    // If no new articles but no failures, slightly increase interval
    currentInterval = Math.min(MAX_INTERVAL, currentInterval + 60 * 1000); // Increase by 1 minute
  }
  console.log(`Adjusted check interval to ${Math.round(currentInterval / 1000 / 60)} minutes.`);
}

async function processLatestArticle(isStartupPhase = false) {
  try {
    console.log('Fetching latest ConsortiumNews articles...');
    const articles = await url_filtering(isStartupPhase);
    if (!articles || articles.length === 0) {
      console.log('No articles found.');
      consecutiveFailures++;
      return null;
    }

    console.log(`Found ${articles.length} articles, getting latest...`);
    const latestArticle = await GetLatestArticle(articles);
    if (!latestArticle) {
      console.log('Could not retrieve detailed article information.');
      consecutiveFailures++;
      return null;
    }

    console.log('Generating AI summary...');
    let aiResult = null;
    let retryCount = 0;
    
    while (!aiResult) {
      // Pass the article object directly instead of letting AI_message_Gen fetch it
      aiResult = {
        summary: await generateAISummary(latestArticle),
        url: latestArticle.url,
        heroImage: latestArticle.heroImages?.[0] || null
      };
      
      if (!aiResult.summary) {
        retryCount++;
        console.log(`AI summary generation attempt ${retryCount} failed, retrying in 30 seconds...`);
        await sleep(30000); // Wait 30 seconds before retrying
        aiResult = null; // Reset for retry
      }
    }

    console.log('Sending message to Telegram...');
    await sendNewsMessage(aiResult.summary, aiResult.heroImage, aiResult.url);
    console.log('Message sent successfully.');

    consecutiveFailures = 0;
    return aiResult.url;
  } catch (error) {
    logError(`Error processing latest article: ${error.message}`);
    console.error('Error processing latest article:', error);
    consecutiveFailures++;
    return null;
  }
}

async function checkForLatestNewArticle() {
  try {
    const animation = showFetchingAnimation();
    // Force fresh fetch by using startup phase to bypass interval check
    const articles = await url_filtering(true);
    clearInterval(animation);
    process.stdout.write('\r\x1B[K'); // Clear the animation line

    console.log('Checking for new ConsortiumNews articles...');
    if (!articles || articles.length === 0) {
      console.log('No articles found.');
      consecutiveFailures++;
      await adjustInterval(false);
      return [];
    }

    // Find new articles that haven't been processed yet
    const newUrls = articles.filter(article => !previousUrls.includes(article.url));
    
    if (newUrls.length === 0) {
      console.log('No new articles found.');
      consecutiveFailures++;
      await adjustInterval(false);
      return [];
    }

    // Only process the latest (first) new article to prevent spam
    const latestNewArticle = newUrls[0];
    console.log(`Found new latest article: ${latestNewArticle.url}`);
    
    const detailedArticle = await GetLatestArticle([latestNewArticle]);
    if (!detailedArticle) {
      console.log(`Could not retrieve detailed information for ${latestNewArticle.url}`);
      consecutiveFailures++;
      return [];
    }

    console.log(`Generating AI summary for ${latestNewArticle.url}...`);
    let aiResult = null;
    let retryCount = 0;
    
    while (!aiResult) {
      aiResult = {
        summary: await generateAISummary(detailedArticle),
        url: detailedArticle.url,
        heroImage: detailedArticle.heroImages?.[0] || null
      };
      
      if (!aiResult.summary) {
        retryCount++;
        console.log(`AI summary generation attempt ${retryCount} failed for ${latestNewArticle.url}, retrying in 30 seconds...`);
        await sleep(30000);
        aiResult = null;
      }
    }

    console.log(`Sending message for ${latestNewArticle.url} to Telegram...`);
    await sendNewsMessage(aiResult.summary, aiResult.heroImage, aiResult.url);
    console.log(`Message sent successfully for ${latestNewArticle.url}`);
    logNewArticle('ConsortiumNews', latestNewArticle.url);
    
    // Add the processed URL to prevent reprocessing
    previousUrls.push(latestNewArticle.url);
    globalStats.addNewArticles('ConsortiumNews', 1);
    await savePreviousUrls();
    consecutiveFailures = 0;
    await adjustInterval(true);
    return [latestNewArticle.url];
  } catch (error) {
    logError(`Error checking for new articles: ${error.message}`);
    console.error('Error checking for new articles:', error);
    consecutiveFailures++;
    await adjustInterval(false);
    return [];
  }
}

async function checkForNewArticles() {
  try {
    const animation = showFetchingAnimation();
    const articles = await url_filtering(false);
    clearInterval(animation);
    process.stdout.write('\r\x1B[K'); // Clear the animation line

    console.log('Checking for new ConsortiumNews articles...');
    if (!articles || articles.length === 0) {
      console.log('No new articles found.');
      consecutiveFailures++;
      await adjustInterval(false);
      return [];
    }

    const newUrls = articles.filter(article => !previousUrls.includes(article.url));
    if (newUrls.length === 0) {
      console.log('No new articles found.');
      consecutiveFailures++;
      await adjustInterval(false);
      return [];
    }

    console.log(`Found ${newUrls.length} new articles.`);
    const processedUrls = [];

    for (const article of newUrls) {
      console.log(`Processing new article: ${article.url}`);
      const latestArticle = await GetLatestArticle([article]);
      if (!latestArticle) {
        console.log(`Could not retrieve detailed information for ${article.url}`);
        continue;
      }

      console.log(`Generating AI summary for ${article.url}...`);
      let aiResult = null;
      let retryCount = 0;
      
      while (!aiResult) {
        // Use generateAISummary with the specific article instead of AI_message_Gen
        aiResult = {
          summary: await generateAISummary(latestArticle),
          url: latestArticle.url,
          heroImage: latestArticle.heroImages?.[0] || null
        };
        
        if (!aiResult.summary) {
          retryCount++;
          console.log(`AI summary generation attempt ${retryCount} failed for ${article.url}, retrying in 30 seconds...`);
          await sleep(30000); // Wait 30 seconds before retrying
          aiResult = null; // Reset for retry
        }
      }

      console.log(`Sending message for ${article.url} to Telegram...`);
      await sendNewsMessage(aiResult.summary, aiResult.heroImage, aiResult.url);
      console.log(`Message sent successfully for ${article.url}`);
      logNewArticle('ConsortiumNews', article.url);
      processedUrls.push(article.url);
    }

    previousUrls.push(...processedUrls);
    globalStats.addNewArticles('ConsortiumNews', processedUrls.length);
    await savePreviousUrls();
    consecutiveFailures = 0;
    await adjustInterval(processedUrls.length > 0);
    return processedUrls;
  } catch (error) {
    logError(`Error checking for new articles: ${error.message}`);
    console.error('Error checking for new articles:', error);
    consecutiveFailures++;
    await adjustInterval(false);
    return [];
  }
}

export async function main() {
  console.log('Starting ConsortiumNews monitoring...');

  // Load previous URLs from file
  await loadPreviousUrls();

  // Initial run to process the latest article
  console.log('Processing latest article...');
  const initialUrl = await processLatestArticle(true);
  if (initialUrl) {
    previousUrls.push(initialUrl);
    globalStats.addNewArticles('ConsortiumNews', 1);
    await savePreviousUrls();
  }

  // Continuous monitoring for new articles
  console.log('Starting continuous monitoring for new articles...');
  while (true) {
    console.log(`Next fetch in ${Math.round(currentInterval / 1000 / 60)} minutes...`);
    const startTime = Date.now();
    const updateInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = currentInterval - elapsed;
      if (remaining <= 0) {
        clearInterval(updateInterval);
        process.stdout.write('\r\x1B[K'); // Clear the countdown line
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      process.stdout.write(`\rNext fetch in ${minutes}m ${seconds}s...`);
    }, 1000);

    await sleep(currentInterval); // Use dynamic interval
    clearInterval(updateInterval);
    process.stdout.write('\r\x1B[K'); // Clear the countdown line
    await checkForNewArticles();
  }
}

// Export the functions for external use
export { processLatestArticle, checkForNewArticles, checkForLatestNewArticle, loadPreviousUrls, savePreviousUrls };

// Only run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logError(`Fatal error in ConsortiumNews main script: ${error.message}`);
    console.error('Fatal error:', error);
    process.exit(1);
  });
} 