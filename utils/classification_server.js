
import express from 'express';
import { pipeline } from '@xenova/transformers';

const app = express();
app.use(express.json());

let classifier = null;

async function getClassifier() {
    if (!classifier) {
        classifier = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
            quantized: true
        });
    }
    return classifier;
}

app.post('/classify', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Text to classify is required' });
    }

    try {
        const model = await getClassifier();
        const result = await model(text);
        res.json(result);
    } catch (error) {
        console.error('Error during classification:', error);
        res.status(500).json({ error: 'Classification failed' });
    }
});

const PORT = process.env.CLASSIFICATION_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Classification server running on port ${PORT}`);
});

process.on('exit', () => {
    if (classifier) {
        classifier.dispose();
    }
});
