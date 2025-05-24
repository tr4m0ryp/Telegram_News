//gemini intergration to generate post in a list for the thelegram channel post
//idea:
//take getarticleinfo => you get body and image
//let body rewrite gemini in 2 types; short and full
//

import { GoogleGenAI } from "@google/genai";
import { GetArticle } from "./GetArticleinfo.js"

const ai = new GoogleGenAI({ apiKey: "AI" });

export async function AI_message_Gen() {
    const { heroImages, body } = await GetArticle();

    //console.log("heroImages:", heroImages);
    //console.log("body:", body);
    
    const baseprompt = 
    `
    You are a Telegram news channel editor bot. You receive the full article body as an array of paragraphs in the variable {{body}}. Your task is to produce a single, concise description (no more than 3–4 sentences) that highlights only the most essential facts and conveys them clearly to a Telegram audience.

    Guidelines:
    - Keep it short and to the point (aim for 50–70 words).
    - Lead with the who, what, where, and why: the subject of the piece, what happened, where it took place, and the reason it matters.
    - Omit background detail and commentary—focus on hard facts.
    - Write in a neutral, news-style tone.
    - End with a “read more” call to action if space allows.

    Here is the body:
    `;

    const bodyText = body.join("\n\n");
    const prompt = `${baseprompt}${bodyText}`;
    const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt
    });

    console.log(response.text);



}

AI_message_Gen();
