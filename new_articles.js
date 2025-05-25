import { url_filtering } from './url_filtering.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export async function new_articles_loop(interval_ms = 6000) {
    console.log("starting article monitor loop...");

    let previous_urls = await url_filtering() || [];


    await sleep(interval_ms);

    const current_urls = await url_filtering() || [];
    const new_urls = current_urls.filter(url => !previous_urls.includes(url));

    /*
    if (new_urls.length > 0) {
        console.log(`Found ${new_urls.length} new URLs:`);
        new_urls.forEach(url => console.log(url));
    } else {
        //
    }
    */

    previous_urls = current_urls;
    return new_urls;
}

