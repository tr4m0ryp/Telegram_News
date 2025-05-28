// script will send message to telegram group
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot('yOUR_OWN_BOT_KEY', { polling: false });
const CHAT_ID = '-1002561834559'; //YOUR_OWN_CHAT_ID

// Function to send message with a single image while preserving Telegram's native discussion feature
export async function sendNewsMessage(text, imageUrl = null, url = null) {
    try {
        // Add the URL to the text if provided
        const messageText = url ? `${text}\n\n<a href="${url}">🌐 View Full Article</a>` : text;

        if (imageUrl) {
            // Send a single photo with caption
            await bot.sendPhoto(CHAT_ID, imageUrl, {
                caption: messageText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        } else {
            // If no image, send as a regular message
            await bot.sendMessage(CHAT_ID, messageText, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}