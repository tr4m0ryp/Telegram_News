// script will send message to telegram group
import TelegramBot from 'node-telegram-bot-api';
import { globalStats } from './utils/counter.js';
import { config } from './utils/config.js';

const bot = new TelegramBot(config.telegram.botToken, { polling: false });

// Function to send message with a single image while preserving Telegram's native discussion feature
export async function sendNewsMessage(text, imageUrl = null, url = null) {
    try {
        // Add the URL to the text if provided
        const messageText = url ? `${text}\n\n<a href="${url}">🌐 View Full Article</a>` : text;

        if (imageUrl) {
            // Send a single photo with caption
            await bot.sendPhoto(config.telegram.chatId, imageUrl, {
                caption: messageText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        } else {
            // If no image, send as a regular message
            await bot.sendMessage(config.telegram.chatId, messageText, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        }

        // Increment telegram messages counter
        globalStats.incrementTelegramMessages();
    } catch (error) {
        console.error('Error sending message:', error);
    }
}