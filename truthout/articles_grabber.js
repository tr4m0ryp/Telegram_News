async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${url}`);
            }
            
            return await response.text();
        } catch (error) {
            console.error(`Attempt ${i + 1}/${maxRetries} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
        }
    }
}

export async function getNews() {
    const url = "https://truthout.org/latest/";
    
    try {
        const news_articles = await fetchWithRetry(url);
        return news_articles;
    } catch (error) {
        console.error("Error fetching Truthout news:", error.message);
        return null;
    }
}


