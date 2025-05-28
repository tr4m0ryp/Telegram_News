import { getNews } from "./articles_grabber.js"

export async function url_filtering(){
    const raw_data = await getNews();
    if (!raw_data) {
        console.error("No data received from getNews");
        return null;
    }
    
    // Pattern for ProPublica article URLs - matches article URLs while excluding sections and other pages
    const pattern = /https:\/\/www\.propublica\.org\/article\/[a-z0-9-]+\/?$/g;
    const matches = raw_data.match(pattern);
    
    if (!matches) {
        return [];
    }
    
    // Remove duplicates using Set
    const cleaned_data = [...new Set(matches)];
    
    // Sort by URL to ensure consistent ordering
    return cleaned_data.sort();
}


