// script will send message to telegram group
import TelegramBot from 'node-telegram-bot-api';
import { globalStats } from './utils/counter.js';
import { config } from './utils/config.js';
import { monitor } from './utils/monitoring.js';
import fetch from 'node-fetch';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { writeFile } from 'fs/promises';

const bot = new TelegramBot(config.telegram.botToken, { polling: false });

async function sendWithRetry(sendFunction, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await sendFunction();
            return true;
        } catch (error) {
            monitor.logParse('Telegram', {
                status: 'error',
                phase: 'send',
                attempt,
                error: error.message
            });
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
            console.log(`Telegram send attempt ${attempt} failed, retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return false;
}

// Function to send message with a single image while preserving Telegram's native discussion feature
export async function sendNewsMessage(text, imageUrl = null, url = null) {
    try {
        console.log('Preparing to send message to Telegram...');
        console.log('Message text:', text?.substring(0, 100) + '...');
        console.log('Image URL:', imageUrl || 'None');
        console.log('Article URL:', url || 'None');
        
        // Add the URL to the text if provided
        const messageText = url ? `${text}\n\n<a href="${url}"> 🌐View Full Article</a>` : text;

        let success = false;
        if (imageUrl) {
            console.log('Attempting to send message with image:', imageUrl);
            
            // Validate image URL
            try {
                const imageUrlObj = new URL(imageUrl);
                if (!imageUrlObj.protocol.startsWith('http')) {
                    throw new Error('Invalid image URL protocol');
                }
                
                // Validate image is accessible
                const response = await fetch(imageUrl, { method: 'HEAD' });
                if (!response.ok) {
                    throw new Error(`Image not accessible: ${response.status}`);
                }
                
                // Check content type
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.startsWith('image/')) {
                    throw new Error(`Invalid content type: ${contentType}`);
                }
                
                console.log('Image validation passed');
            } catch (error) {
                console.error('Image validation failed:', error.message);
                // Fall back to sending text-only message
                imageUrl = null;
            }
        }

        if (imageUrl) {
            // Send a single photo with caption
            success = await sendWithRetry(async () => {
                try {
                    console.log('Preparing to send photo message to Telegram...');
                    console.log('Chat ID:', config.telegram.chatId);
                    console.log('Image URL:', imageUrl);
                    
                    // First try sending directly with URL
                    try {
                        console.log('Attempting to send image directly via URL...');
                        await bot.sendPhoto(config.telegram.chatId, imageUrl, {
                            caption: messageText,
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        });
                        console.log(' Photo message sent successfully via URL');
                        return;
                    } catch (urlError) {
                        console.log('Direct URL send failed, falling back to buffer method:', urlError.message);
                        console.log('URL Error details:', urlError.response?.body || urlError.stack || 'No additional details');
                    }

                    // If URL method fails, try downloading and sending as buffer
                    console.log('Downloading image...');
                    const imageResponse = await fetch(imageUrl);
                    if (!imageResponse.ok) {
                        throw new Error(`Failed to download image: ${imageResponse.status} - ${imageResponse.statusText}`);
                    }

                    const buffer = Buffer.from(await imageResponse.arrayBuffer());
                    
                    // Send directly using buffer
                    try {
                        await bot.sendPhoto(config.telegram.chatId, buffer, {
                            caption: messageText,
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        });
                        console.log('Photo message sent successfully via buffer');
                    } catch (bufferError) {
                        console.error(' Error sending photo via buffer:', bufferError.message);
                        console.error('Buffer Error details:', bufferError.response?.body || bufferError.stack || 'No additional details');
                        // Fall back to text-only message with image link
                        console.log('Falling back to text-only message');
                        await bot.sendMessage(config.telegram.chatId, `${messageText}\n\n[Image available at: ${imageUrl}]`, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: false // Allow preview for image URL
                        });
                    }
                    
                } catch (error) {
                    console.error(' Error sending photo:', error);
                    console.error('Error details:', error.response?.body || 'No additional details');
                    
                    // Fall back to text-only message with image link
                    console.log(' Falling back to text-only message');
                    await bot.sendMessage(config.telegram.chatId, `${messageText}\n\n[Image available at: ${imageUrl}]`, {
                        parse_mode: 'HTML',
                        disable_web_page_preview: false // Allow preview for image URL
                    });
                }
            });
        } else {
            // If no image, send as a regular message
            success = await sendWithRetry(async () => {
                await bot.sendMessage(config.telegram.chatId, messageText, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
            });
        }

        if (success) {
            monitor.logParse('Telegram', {
                status: 'success',
                phase: 'send',
                hasImage: !!imageUrl,
                url: url || 'none'
            });
            // Increment telegram messages counter
            globalStats.incrementTelegramMessages();
        }
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}