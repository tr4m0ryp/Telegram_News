//gemini intergration to generate post in a list for the thelegram channel post
//idea:
//take getarticleinfo => you get body and image
//let body rewrite gemini in 2 types; short and full
//

import { GoogleGenAI } from "@google/genai";
import { GetArticle } from "./GetArticleinfo.js"

const ai = new GoogleGenAI({ apiKey: "nigga" });

export async function AI_message_Gen() {
    const getarticle = await GetArticle();
    console.log(getarticle);
    
    
    /*const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "is a nigger a nigger if he is a white nigger?",
    });
    console.log(response.text); */


}

AI_message_Gen();
