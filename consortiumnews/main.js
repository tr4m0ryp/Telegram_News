import { url_filtering } from './url_filtering.js';
import { GetLatestArticle } from './GetArticleinfo.js';
import { AI_message_Gen } from './AI-messageGen.js';
import { sendNewsMessage } from '../sender.js';
import { globalStats } from '../utils/counter.js';
import { logError, logNewArticle } from '../utils/logger.js';
import { FETCH_INTERVAL } from '../utils/constants.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

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
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} Fetching new ConsortiumNews articles...`);
    i = (i + 1) % frames.length;
  }, 80);
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
      aiResult = await AI_message_Gen(latestArticle, true);
      if (!aiResult) {
        retryCount++;
        console.log(`AI summary generation attempt ${retryCount} failed, retrying in 30 seconds...`);
        await sleep(30000); // Wait 30 seconds before retrying
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
        aiResult = await AI_message_Gen(latestArticle, true);
        if (!aiResult) {
          retryCount++;
          console.log(`AI summary generation attempt ${retryCount} failed for ${article.url}, retrying in 30 seconds...`);
          await sleep(30000); // Wait 30 seconds before retrying
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

async function main() {
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

main().catch(error => {
  logError(`Fatal error in ConsortiumNews main script: ${error.message}`);
  console.error('Fatal error:', error);
  process.exit(1);
}); 