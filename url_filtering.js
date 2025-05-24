import { getNews } from "./articles_grabber.js"

export async function url_filtering(){
    const raw_data = await getNews();
    //console.log(raw_data);
    const cleaned_data = raw_data.match(/https:\/\/consortiumnews\.com\/2025[^\s"'<>]*/g);
    //console.log(cleaned_data);
    return cleaned_data;
}


