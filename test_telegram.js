import TelegramBot from 'node-telegram-bot-api';
import { config } from './utils/config.js';
import { monitor as telegramMonitor } from './utils/monitoring.js';

const bot = new TelegramBot(config.telegram.token, { polling: false });
const CHAT_ID = config.telegram.chatId;

async function sendTestMessages() {
    try {
        // Send three test messages
        console.log('Sending test messages...');
        
        await bot.sendMessage(CHAT_ID, '🔄 Test Message 1: System startup initiated');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await bot.sendMessage(CHAT_ID, '📡 Test Message 2: Checking news sources connection');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await bot.sendMessage(CHAT_ID, '✅ Test Message 3: All systems operational');
        
        console.log('Test messages sent successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error sending test messages:', error);
        telegramMonitor.logParse('Telegram', {
            status: 'error',
            phase: 'test',
            error: error.message
        });
        process.exit(1);
    }
}

// Run the test
sendTestMessages();
