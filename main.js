import { AI_message_Gen as ConsortiumNewsGen } from './consortiumnews/AI-messageGen.js';
import { AI_message_Gen as ProPublicaGen } from './ProPublica/AI-messageGen.js';
import { AI_message_Gen as TruthoutGen } from './truthout/AI-messageGen.js';
import { sendNewsMessage } from './sender.js';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function monitorNewsSource(name, generator, CHECK_INTERVAL, ERROR_RETRY_INTERVAL) {
    console.log(`Starting ${name} monitor...`);
    
    while (true) {
        try {
            const startTime = Date.now();
            
            const article = await generator();
            
            if (article) {
                const { summary, url, heroImage } = article;
                
                // Send to Telegram
                await sendNewsMessage(summary, heroImage, url);
                console.log(`Successfully sent ${name} article to Telegram:`, url);
            }
            
            // Calculate how long to wait until next check
            const elapsed = Date.now() - startTime;
            const waitTime = Math.max(0, CHECK_INTERVAL - elapsed);
            
            console.log(`Waiting ${Math.round(waitTime/1000)} seconds until next ${name} check...`);
            await sleep(waitTime);
        } catch (error) {
            console.error(`Error in ${name} monitor:`, error);
            console.log(`Retrying ${name} in ${ERROR_RETRY_INTERVAL/1000} seconds...`);
            await sleep(ERROR_RETRY_INTERVAL);
        }
    }
}

async function startNewsMonitors() {
    const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
    const ERROR_RETRY_INTERVAL = 30 * 1000; // Wait 30 seconds after error
    
    // Start all monitors in parallel
    await Promise.all([
        monitorNewsSource('Consortium News', ConsortiumNewsGen, CHECK_INTERVAL, ERROR_RETRY_INTERVAL),
        monitorNewsSource('ProPublica', ProPublicaGen, CHECK_INTERVAL, ERROR_RETRY_INTERVAL),
        monitorNewsSource('Truthout', TruthoutGen, CHECK_INTERVAL, ERROR_RETRY_INTERVAL)
    ]);
}

// Start the monitors
console.log('Starting news monitoring service...');
startNewsMonitors().catch(err => {
    console.error('Fatal error in news monitors:', err);
    process.exit(1);
});