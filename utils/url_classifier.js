import fetch from 'node-fetch';

const CLASSIFICATION_API_URL = process.env.CLASSIFICATION_API_URL || 'http://localhost:3000/classify';

export async function classifyUrl(url, title) {
    try {
        const urlParts = url.split('/').filter(Boolean);
        const lastPart = urlParts[urlParts.length - 1].replace(/-/g, ' ');
        const textToClassify = `${title} ${lastPart}`.toLowerCase();

        const response = await fetch(CLASSIFICATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToClassify })
        });

        if (!response.ok) {
            throw new Error(`Classification request failed with status ${response.status}`);
        }

        const result = await response.json();
        const score = result[0].score;

        return {
            isRelevant: score > 0.6,
            confidence: score,
            reason: `Confidence score: ${(score * 100).toFixed(1)}%`
        };
    } catch (error) {
        console.error('Error classifying URL:', error);
        return { isRelevant: true, confidence: 1, reason: 'Classification failed' };
    }
}
