import { GoogleGenAI } from "@google/genai";
import { GetArticles } from "./GetArticleinfo.js";
import { globalStats } from '../utils/counter.js';
import { config } from '../utils/config.js';

const ai = new GoogleGenAI({ apiKey: config.google.apiKey });

export async function AI_message_Gen() {
    console.log('Starting Truthout article processing...');
    
    const article = await GetArticles();
    console.log('GetArticles result:', article ? 'Article found' : 'No article found');
    
    if (!article || !article.body || article.body.length === 0) {
        console.log("No new article found on Truthout");
        return null;
    }

    const { url, heroImages, body } = article;
    console.log('Processing article:', url);
    console.log('Hero images:', heroImages.length);
    console.log('Body paragraphs:', body.length);

    const baseprompt = 
    `
    You are a Telegram news channel editor bot. You receive the full article body as an array of paragraphs in the variable {{body}}. Your task is to produce a single, concise description (no more than 3–4 sentences) that highlights only the most essential facts and conveys them clearly to a Telegram audience.

    Guidelines:
    - Keep it short and to the point (aim for 50–70 words).
    - Lead with the who, what, where, and why: the subject of the piece, what happened, where it took place, and the reason it matters.
    - Omit background detail and commentary—focus on hard facts.
    - Write in a neutral, news-style tone.
    - End with a "read more" call to action if space allows.

    Here is the body:
    `;

    const bodyText = body.join("\n\n");
    const prompt = `${baseprompt}${bodyText}`;
    
    console.log('Generating AI summary...');
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
    });

    const summary = response.text;
    console.log("Generated summary length:", summary.length);

    // Increment AI message counter
    globalStats.incrementAiMessages();

    return {
        summary,
        url,
        heroImage: heroImages[0] || null
    };
}
