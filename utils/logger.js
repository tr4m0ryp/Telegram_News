import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve('./logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const errorLogPath = path.join(LOG_DIR, 'errors.log');
const newArticlesLogPath = path.join(LOG_DIR, 'new_articles.log');
const terminalLogPath = path.join(LOG_DIR, 'terminal.log');

function appendToFile(filePath, message) {
    fs.appendFileSync(filePath, message + '\n', { encoding: 'utf8' });
}

export function logError(message) {
    appendToFile(errorLogPath, `[${new Date().toISOString()}] ERROR: ${message}`);
}

export function logNewArticle(source, url) {
    appendToFile(newArticlesLogPath, `[${new Date().toISOString()}] [${source}] ${url}`);
}

export function logTerminal(message) {
    appendToFile(terminalLogPath, `[${new Date().toISOString()}] ${message}`);
}
