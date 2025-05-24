export async function getNews(){
    const url = "https://consortiumnews.com/";

    try {
        const request = await fetch(url);
        const news_articles = await request.text();
        return news_articles;
    }
    catch (error) {
        console.error(error.message);
    
}
return news_articles;
}


