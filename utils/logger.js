import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve('./logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const errorLogPath = path.join(LOG_DIR, 'errors.log');
const newArticlesLogPath = path.join(LOG_DIR, 'new_articles.log');
const terminalLogPath = path.join(LOG_DIR, 'terminal.log');
const debugLogPath = path.join(LOG_DIR, 'debug.log');

function appendToFile(filePath, message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(filePath, `[${timestamp}] ${message}\n`, { encoding: 'utf8' });
}

export function logError(message) {
    appendToFile(errorLogPath, `ERROR: ${message}`);
    logDebug(`ERROR: ${message}`);
}

export function logNewArticle(source, url) {
    appendToFile(newArticlesLogPath, `[${source}] ${url}`);
    logDebug(`NEW ARTICLE: [${source}] ${url}`);
}

export function logTerminal(message) {
    appendToFile(terminalLogPath, message);
    logDebug(`TERMINAL: ${message}`);
}

export function logDebug(message, data = null) {
    const debugMessage = data ? 
        `${message}\nDATA: ${JSON.stringify(data, null, 2)}` : 
        message;
    appendToFile(debugLogPath, debugMessage);
}

// Special debug categories for detailed tracking
export function logFetch(source, url, success, details) {
    logDebug(`FETCH: ${source} - ${success ? 'SUCCESS' : 'FAIL'} - ${url}`, details);
}

export function logParse(source, url, success, details) {
    logDebug(`PARSE: ${source} - ${success ? 'SUCCESS' : 'FAIL'} - ${url}`, details);
}

export function logAI(source, url, success, details) {
    logDebug(`AI: ${source} - ${success ? 'SUCCESS' : 'FAIL'} - ${url}`, details);
}

export function logTelegram(source, url, success, details) {
    logDebug(`TELEGRAM: ${source} - ${success ? 'SUCCESS' : 'FAIL'} - ${url}`, details);
}
