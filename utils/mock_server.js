import { logDebug } from './logger.js';

const mockArticles = {
    consortiumNews: new Map(),
    proPublica: new Map(),
    truthout: new Map()
};

// Template functions to generate mock HTML
function generateConsortiumNewsHTML(articles) {
    return `
    <!DOCTYPE html>
    <html>
    <body>
        <div class="content">
            ${articles.map(({ url, title, date }) => `
                <article class="post-article">
                    <h2><a href="${url}">${title}</a></h2>
                    <time datetime="${date}">${new Date(date).toLocaleDateString()}</time>
                </article>
            `).join('')}
        </div>
    </body>
    </html>`;
}

function generateProPublicaHTML(articles) {
    return `
    <!DOCTYPE html>
    <html>
    <body>
        <div class="archive-content">
            ${articles.map(({ url, title, date }) => `
                <article class="archive-article">
                    <h3><a href="${url}">${title}</a></h3>
                    <time>${new Date(date).toLocaleString()} EDT</time>
                </article>
            `).join('')}
        </div>
    </body>
    </html>`;
}

function generateTruthoutHTML(articles) {
    return `
    <!DOCTYPE html>
    <html>
    <body>
        <div class="latest-articles">
            ${articles.map(({ url, title, date }) => `
                <article class="article-item">
                    <h2><a href="${url}">${title}</a></h2>
                    <time datetime="${date}">${new Date(date).toLocaleString()}</time>
                </article>
            `).join('')}
        </div>
    </body>
    </html>`;
}

// Function to add a mock article
function addMockArticle(site, article) {
    const id = Date.now().toString();
    mockArticles[site].set(id, {
        ...article,
        date: article.date || new Date().toISOString()
    });
    logDebug(`MOCK: Added article to ${site}`, article);
    return id;
}

// Function to get mock HTML
function getMockHTML(site) {
    const articles = Array.from(mockArticles[site].values());
    switch (site) {
        case 'consortiumNews':
            return generateConsortiumNewsHTML(articles);
        case 'proPublica':
            return generateProPublicaHTML(articles);
        case 'truthout':
            return generateTruthoutHTML(articles);
        default:
            throw new Error(`Unknown site: ${site}`);
    }
}

// Mock fetch function that returns site content
export function mockFetch(url) {
    logDebug(`MOCK: Fetching ${url}`);
    
    if (url.includes('consortiumnews.com')) {
        return { text: () => getMockHTML('consortiumNews') };
    } else if (url.includes('propublica.org')) {
        return { text: () => getMockHTML('proPublica') };
    } else if (url.includes('truthout.org')) {
        return { text: () => getMockHTML('truthout') };
    }
    
    throw new Error(`Unknown URL: ${url}`);
}

// Export functions to manipulate mock data
export const mockServer = {
    addConsortiumNewsArticle: (article) => addMockArticle('consortiumNews', article),
    addProPublicaArticle: (article) => addMockArticle('proPublica', article),
    addTruthoutArticle: (article) => addMockArticle('truthout', article),
    clearAllArticles: () => {
        mockArticles.consortiumNews.clear();
        mockArticles.proPublica.clear();
        mockArticles.truthout.clear();
        logDebug('MOCK: Cleared all articles');
    }
};