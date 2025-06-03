// url_filtering.js
import { getLatestArticle } from './articles_grabber.js';
import { logError } from '../utils/logger.js';
import { monitor as proPublicaMonitor } from '../utils/monitoring.js';
import { classifyUrl } from '../utils/url_classifier.js';

let lastFetchTime = 0;
const FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes (ms)

/**
 * On each invocation, if FETCH_INTERVAL hasn’t elapsed, returns null. 
 * Otherwise, calls getLatestArticle() → compares to lastPublishedUrl → 
 * returns an array [articleData] if it’s new, or [] if none new.  
 */
export async function url_filtering(isStartupPhase = false) {
  const now = Date.now();
  if (!isStartupPhase && now - lastFetchTime < FETCH_INTERVAL) {
    const secsLeft = Math.ceil((FETCH_INTERVAL - (now - lastFetchTime)) / 1000);
    console.log(`Skipping ProPublica fetch (next in ${secsLeft}s)`);
    return null;
  }
  lastFetchTime = now;

  let latest;
  try {
    latest = await getLatestArticle();
  } catch (err) {
    proPublicaMonitor.logParse('ProPublica', {
      status: 'error',
      phase: 'fetch',
      error: err.message,
    });
    logError(`url_filtering → getLatestArticle error: ${err.message}`);
    return null;
  }

  if (!latest) {
    console.log('No article found on ProPublica archive.');
    proPublicaMonitor.logParse('ProPublica', {
      status: 'info',
      phase: 'filter',
      message: 'Archive page found zero <.story-river-item>.',
    });
    return [];
  }

  // If this is startup, we simply return the single latest article once.
  // Otherwise, we should classify it and only return if it’s “newer.”
  if (isStartupPhase) {
    console.log('Startup phase: publishing the current latest article.');
    const toReturn = [latest];
    // (Optionally, you could classify or logParse here as well.)
    return toReturn;
  }

  // At runtime: check if this URL was already processed.
  // We keep a simple in-memory Set of “already seen” URLs.
  if (!url_filtering.seenUrls) {
    url_filtering.seenUrls = new Set();
  }

  if (url_filtering.seenUrls.has(latest.url)) {
    console.log('Latest article already seen; nothing to publish.');
    return [];
  }

  // New article—mark it seen, classify, and return.
  url_filtering.seenUrls.add(latest.url);
  console.log(`New ProPublica article found: ${latest.title}`);

  // Run classification if needed; optional, but follows prior pattern:
  let classificationResult = {};
  try {
    classificationResult = await classifyUrl(latest.url, latest.title);
  } catch (err) {
    console.warn(`URL classification failed: ${err.message}`);
  }

  const fullRecord = {
    ...latest,
    date: latest.date.toISOString(),
    previewImage: latest.previewImage,
    ...classificationResult,
  };

  proPublicaMonitor.logParse('ProPublica', {
    status: 'success',
    phase: 'filter',
    articlesFound: 1,
    classificationResults: [fullRecord],
  });

  return [fullRecord];
}
