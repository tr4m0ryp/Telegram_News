import { getNews } from "./articles_grabber.js"

export async function url_filtering(){
    const raw_data = await getNews();
    if (!raw_data) {
        console.error("No data received from getNews");
        return null;
    }
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Create regex pattern for article URLs only (excluding archive pages)
    const pattern = new RegExp(`https:\\/\\/consortiumnews\\.com\\/${currentYear}\\/\\d{2}\\/[\\w-]+\\/?$`, 'g');
    const matches = raw_data.match(pattern);
    
    if (!matches) {
        return [];
    }
    
    // Remove duplicates using Set
    const cleaned_data = [...new Set(matches)];
    
    // Sort by URL to ensure consistent ordering
    return cleaned_data.sort();
}


