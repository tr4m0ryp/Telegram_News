import { pipeline } from '@xenova/transformers';

let classifier = null;

// Initialize the classifier once and reuse it
async function getClassifier() {
    if (!classifier) {
        classifier = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
            quantized: true // Use quantized model for smaller memory footprint
        });
    }
    return classifier;
}

export async function classifyUrl(url, title) {
    try {
        const model = await getClassifier();
        
        // Extract meaningful parts from URL and title
        const urlParts = url.split('/').filter(Boolean);
        const lastPart = urlParts[urlParts.length - 1].replace(/-/g, ' ');
        
        // Combine URL and title for classification
        const textToClassify = `${title} ${lastPart}`.toLowerCase();
        
        // Get classification
        const result = await model(textToClassify);
        
        // Get confidence score (0-1)
        const score = result[0].score;
        
        return {
            isRelevant: score > 0.6, // Threshold for relevance
            confidence: score,
            reason: `Confidence score: ${(score * 100).toFixed(1)}%`
        };
    } catch (error) {
        console.error('Error classifying URL:', error);
        // If classification fails, default to accepting the URL
        return { isRelevant: true, confidence: 1, reason: 'Classification failed' };
    }
}

// Clean up classifier when Node.js exits
process.on('exit', () => {
    if (classifier) {
        classifier.dispose();
    }
});
