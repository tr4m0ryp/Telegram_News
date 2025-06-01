import { AI_message_Gen as ConsortiumNewsGen } from './consortiumnews/AI-messageGen.js';
import { AI_message_Gen as ProPublicaGen } from './ProPublica/AI-messageGen.js';
import { AI_message_Gen as TruthoutGen } from './truthout/AI-messageGen.js';
import { url_filtering as filterConsortium } from './consortiumnews/url_filtering.js';
import { url_filtering as filterProPublica } from './ProPublica/url_filtering.js';
import { url_filtering as filterTruthout } from './truthout/url_filtering.js';
import { monitor as mainMonitor } from './utils/monitoring.js';
import { sendNewsMessage } from './sender.js';
import { FETCH_INTERVAL, ERROR_RETRY_INTERVAL } from './utils/constants.js';
import { spawn } from 'child_process';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTelegramTests() {
    console.log('🚀 Running Telegram connection tests...');
    return new Promise((resolve, reject) => {
        const testProcess = spawn('node', ['test_telegram.js']);
        
        testProcess.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        testProcess.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        testProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Telegram tests failed with code ${code}`));
            }
        });
    });
}

async function sendInitialArticles() {
    console.log('\n🔍 Testing article fetching from each source...');

    try {
        // ConsortiumNews
        console.log('\n=== ConsortiumNews Test ===');
        const consortiumArticles = await filterConsortium(true);
        if (consortiumArticles?.length > 0) {
            const article = await ConsortiumNewsGen();
            if (article?.summary) {
                await sendNewsMessage(
                    `📰 Latest from ConsortiumNews:\n${article.summary}`,
                    article.heroImage,
                    article.url
                );
                console.log('✅ ConsortiumNews test successful');
            }
        }

        await sleep(10000); // Wait 10 seconds between sources

        // ProPublica
        console.log('\n=== ProPublica Test ===');
        const proPublicaArticles = await filterProPublica(true);
        if (proPublicaArticles?.length > 0) {
            const article = await ProPublicaGen();
            if (article?.summary) {
                await sendNewsMessage(
                    `📰 Latest from ProPublica:\n${article.summary}`,
                    article.heroImage,
                    article.url
                );
                console.log('✅ ProPublica test successful');
            }
        }

        await sleep(10000);

        // Truthout
        console.log('\n=== Truthout Test ===');
        const truthoutArticles = await filterTruthout(true);
        if (truthoutArticles?.length > 0) {
            const article = await TruthoutGen();
            if (article?.summary) {
                await sendNewsMessage(
                    `📰 Latest from Truthout:\n${article.summary}`,
                    article.heroImage,
                    article.url
                );
                console.log('✅ Truthout test successful');
            }
        }

        return {
            consortiumNews: consortiumArticles?.length || 0,
            proPublica: proPublicaArticles?.length || 0,
            truthout: truthoutArticles?.length || 0
        };
    } catch (error) {
        console.error('❌ Error during initial article testing:', error);
        throw error;
    }
}

async function monitorNewsSource(name, generator, filterFn, interval, retryInterval) {
    console.log(`🔄 Starting ${name} monitor...`);
    
    while (true) {
        try {
            const startTime = Date.now();
            const urls = await filterFn();
            
            if (urls?.length > 0) {
                const article = await generator();
                if (article?.summary) {
                    await sendNewsMessage(
                        `📰 Latest from ${name}:\n${article.summary}`,
                        article.heroImage,
                        article.url
                    );
                }
            }
            
            const elapsed = Date.now() - startTime;
            const waitTime = Math.max(0, interval - elapsed);
            
            console.log(`⏳ Next ${name} check in ${Math.round(waitTime/1000)}s`);
            await sleep(waitTime);
        } catch (error) {
            console.error(`❌ Error in ${name} monitor:`, error);
            await sleep(retryInterval);
        }
    }
}

async function main() {
    try {
        // Step 1: Test Telegram connection
        await runTelegramTests();
        console.log('✅ Telegram tests passed\n');

        // Step 2: Test article fetching and sending
        const articleCounts = await sendInitialArticles();
        mainMonitor.logParse('Main', {
            status: 'success',
            phase: 'startup',
            articleCounts
        });

        console.log('\n🚀 Starting continuous monitoring...');
        await sleep(20000); // Wait 20 seconds before starting regular monitoring

        // Step 3: Start continuous monitoring
        const monitors = [
            monitorNewsSource('ConsortiumNews', ConsortiumNewsGen, filterConsortium, FETCH_INTERVAL, ERROR_RETRY_INTERVAL),
            monitorNewsSource('ProPublica', ProPublicaGen, filterProPublica, FETCH_INTERVAL, ERROR_RETRY_INTERVAL),
            monitorNewsSource('Truthout', TruthoutGen, filterTruthout, FETCH_INTERVAL, ERROR_RETRY_INTERVAL)
        ];

        await Promise.all(monitors);
    } catch (error) {
        console.error('❌ Fatal error:', error);
        mainMonitor.logParse('Main', {
            status: 'error',
            phase: 'main',
            error: error.message
        });
        process.exit(1);
    }
}

// Start the application
console.log('📰 News Monitoring Service Starting...\n');
main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});