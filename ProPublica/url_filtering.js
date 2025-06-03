import { logError } from "../utils/logger.js";
import { monitor as proPublicaMonitor } from "../utils/monitoring.js";
import { classifyUrl } from "../utils/url_classifier.js";
import { fetchWithRetry } from "./articles_grabber.js";

// Store the last fetch time
let lastFetchTime = 0;
const FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

export async function url_filtering(isStartupPhase = false) {
  // Skip interval check during startup phase
  if (!isStartupPhase) {
    const now = Date.now();
    if (now - lastFetchTime < FETCH_INTERVAL) {
      console.log(
        `Skipping ProPublica fetch - next fetch in ${Math.ceil(
          (FETCH_INTERVAL - (now - lastFetchTime)) / 1000
        )} seconds`
      );
      return null;
    }
  }

  lastFetchTime = Date.now();
  
  try {
    // Fetch both archive and homepage
    const [archiveData, homeData] = await Promise.all([
      fetchWithRetry("https://www.propublica.org/archive/"),
      fetchWithRetry("https://www.propublica.org/")
    ]);

    const cheerio = await import("cheerio");
    const $archive = cheerio.load(archiveData);
    const $home = cheerio.load(homeData);

    proPublicaMonitor.logParse("ProPublica", {
      status: "info",
      phase: "parsing",
      message: "Starting HTML parse"
    });

    const articles = new Set();
    const articleDataMap = new Map();
    const classificationResults = [];

    // Get articles from both sources
    const articleElements = [
      ...$archive('[data-qa="story-list"] article').toArray(),
      ...$home('[data-qa="top-story"], [data-qa="story-card"]').toArray()
    ];

    console.log(`Found ${articleElements.length} potential articles`);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    for (const element of articleElements) {
      const $ = cheerio.load(element);
      
      // Try to parse JSON-LD first
      const jsonLD = $('script[type="application/ld+json"]').html();
      let articleData = tryParseJSONLD(jsonLD);

      if (!articleData) {
        // Fallback to DOM parsing
        articleData = {
          url: $('a[data-qa="story-link"]').attr('href'),
          title: $('h2, h3').first().text().trim(),
          date: $('time').attr('datetime'),
          image: $('img[data-qa="image"]').attr('src')
        };
      }

      if (!articleData.url) continue;

      try {
        const url = new URL(articleData.url, 'https://www.propublica.org').href;
        const articleDate = articleData.date ? new Date(articleData.date) : new Date();

        if (!isStartupPhase && articleDate < threeDaysAgo) continue;

        // Store article data
        articles.add(url);
        articleDataMap.set(url, {
          title: articleData.title,
          date: articleDate,
          previewImage: articleData.image ? 
            new URL(articleData.image, 'https://www.propublica.org').href : 
            null
        });

        if (!isStartupPhase) {
          const classification = await classifyUrl(url, articleData.title);
          classificationResults.push({
            url,
            title: articleData.title,
            date: articleDate.toISOString(),
            previewImage: articleData.image,
            ...classification
          });
        }
      } catch (e) {
        console.log(`Error processing article: ${e.message}`);
      }
    }

    if (articles.size === 0) {
      console.log("No new relevant ProPublica articles found");
      proPublicaMonitor.logParse("ProPublica", {
        status: "info",
        phase: "filter",
        message: "No articles passed filtering"
      });
      return [];
    }

    const result = Array.from(articles)
      .map(url => ({
        url,
        ...articleDataMap.get(url)
      }))
      .sort((a, b) => b.date - a.date);

    console.log(`Found ${result.length} relevant ProPublica articles`);
    proPublicaMonitor.logParse("ProPublica", {
      status: "success",
      phase: "filter",
      articlesFound: result.length,
      classificationResults
    });

    return result;

  } catch (err) {
    proPublicaMonitor.logParse("ProPublica", {
      status: "error",
      phase: "fetch",
      error: err.message
    });
    logError(`ProPublica processing error: ${err}`);
    return null;
  }
}

function tryParseJSONLD(ldString) {
  if (!ldString) return null;
  try {
    const cleanJSON = ldString.replace(/<\/?script>/g, '');
    const json = JSON.parse(cleanJSON);
    return {
      url: json.url,
      title: json.headline,
      date: json.datePublished,
      image: json.image?.url || json.image?.[0]?.url
    };
  } catch (e) {
    console.log('JSON-LD parse error:', e.message);
    return null;
  }
}
