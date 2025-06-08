import { 
    processLatestArticle as ppProcessLatest,
    checkForNewArticles as ppCheckNew,
    loadPreviousUrls as ppLoadUrls,
    savePreviousUrls as ppSaveUrls
} from './ProPublica/main.js';
import { 
    processLatestArticle as cnProcessLatest,
    checkForNewArticles as cnCheckNew,
    loadPreviousUrls as cnLoadUrls,
    savePreviousUrls as cnSaveUrls
} from './consortiumnews/main.js';
import { BotController } from './bot_controller.js';
import { monitor } from './utils/monitoring.js';
import { logTerminal, logError } from './utils/logger.js';

// Global bot controller instance
let botController = null;

async function initializeNewsSources() {
    try {
        console.log('Initializing news sources...');
        
        // Load previous URLs for both sources
        console.log('Loading ProPublica previous URLs...');
        await ppLoadUrls();
        
        console.log('Loading ConsortiumNews previous URLs...');
        await cnLoadUrls();
        
        console.log('News sources initialized successfully');
    } catch (error) {
        console.error('Error initializing news sources:', error);
        throw error;
    }
}

async function runNewsSources() {
    try {
        logTerminal('Starting news source aggregation...');
        console.log('Starting news source aggregation...');
        
        // Run both news sources sequentially to avoid conflicts
        console.log('Checking ProPublica for new articles...');
        const ppResults = await ppCheckNew();
        
        console.log('Checking ConsortiumNews for new articles...');
        const cnResults = await cnCheckNew();
        
        const totalFound = (ppResults?.length || 0) + (cnResults?.length || 0);
        const successMessage = `Successfully processed ${totalFound} new articles (ProPublica: ${ppResults?.length || 0}, ConsortiumNews: ${cnResults?.length || 0})`;
        logTerminal(successMessage);
        console.log(successMessage);
        
        // Log performance
        monitor.logPerformance('Main', {
            action: 'cycle_complete',
            timestamp: new Date().toISOString(),
            sources: ['ProPublica', 'ConsortiumNews'],
            articlesFound: totalFound
        });
        
    } catch (error) {
        const errorMessage = `Error running news sources: ${error.message}`;
        logError(errorMessage);
        console.error(errorMessage);
        throw error;
    }
}

async function startBot() {
    try {
        console.log('Starting enhanced Telegram bot...');
        botController = new BotController();
        
        // Log bot startup
        monitor.logPerformance('Bot', {
            action: 'startup',
            timestamp: new Date().toISOString(),
            features: ['log_download', 'stop_command', 'rerun_command', 'status_monitoring']
        });
        
        console.log('Enhanced Telegram bot started successfully');
        return botController;
    } catch (error) {
        const errorMessage = `Error starting bot: ${error.message}`;
        logError(errorMessage);
        console.error(errorMessage);
        throw error;
    }
}

async function runContinuousProcess() {
    const INTERVAL_MINUTES = 30; // Run every 30 minutes
    const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
    
    console.log(`Starting continuous news aggregation (every ${INTERVAL_MINUTES} minutes)`);
    
    // Initialize news sources first
    await initializeNewsSources();
    
    // Run immediately on startup
    await runNewsSources();
    
    // Then run on interval
    setInterval(async () => {
        try {
            console.log(`\nRunning scheduled news check (${new Date().toLocaleString()})`);
            await runNewsSources();
        } catch (error) {
            console.error('Error in scheduled run:', error);
            logError(`Scheduled run error: ${error.message}`);
        }
    }, INTERVAL_MS);
}

async function main() {
    try {
        console.log('Starting Enhanced Telegram News Bot');
        console.log('=====================================');
        
        // Start the bot controller first
        await startBot();
        
        // Run continuous process
        await runContinuousProcess();
        
    } catch (error) {
        console.error('Fatal error in main process:', error);
        logError(`Fatal error in main: ${error.message}`);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (botController) {
        await botController.stop();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (botController) {
        await botController.stop();
    }
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logError(`Uncaught Exception: ${error.message}\nStack: ${error.stack}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logError(`Unhandled Rejection: ${reason}`);
    process.exit(1);
});

// Export for external use
export { runNewsSources, initializeNewsSources, startBot, botController };

// Run the main function
main();