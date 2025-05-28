import { GoogleGenAI } from "@google/genai";
import { GetArticles } from "./GetArticleinfo.js"

const ai = new GoogleGenAI({ apiKey: "YOUR_OWN_API_KEY" }); // Replace with your actual API key

export async function AI_message_Gen() {
    const article = await GetArticles();
    if (!article || !article.body || article.body.length === 0) {
        console.log("No new article found on consortiumnews");
        return null;
    }

    const { url, heroImages, body } = article;

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
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
    });

    const summary = response.text;
    console.log("Generated summary:", summary);

    return {
        summary,
        url,
        heroImage: heroImages[0] || null
    };
}
