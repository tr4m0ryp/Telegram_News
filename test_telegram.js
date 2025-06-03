import { sendNewsMessage } from './sender.js';
import { config } from './utils/config.js';
import { monitor } from './utils/monitoring.js';
import { url_filtering as proPublicaUrlFiltering } from './ProPublica/url_filtering.js';
import { url_filtering as consortiumUrlFiltering } from './consortiumnews/url_filtering.js';
import { GetLatestArticle } from './consortiumnews/GetArticleinfo.js';
import { AI_message_Gen } from './consortiumnews/AI-messageGen.js';

async function testTelegram() {
  console.log('🔄 Testing Telegram configuration and full pipeline…');

  // Verify environment variables
  console.log('🔍 Checking environment variables...');
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    throw new Error('Missing required Telegram environment variables');
  }
  console.log('✅ Environment variables present');

  // 1) Fetch latest ProPublica article
  console.log('\n📥 Fetching latest ProPublica article…');
  let propubArticles;
  try {
    propubArticles = await proPublicaUrlFiltering(false);
  } catch (err) {
    console.error('❌ Error in ProPublica url_filtering:', err);
    propubArticles = [];
  }

  if (propubArticles.length === 0) {
    console.log('⚠️ No recent ProPublica articles found');
  } else {
    const latestPropub = propubArticles[0];
    console.log('✅ Latest ProPublica article URL:', latestPropub.url);

    // Send ProPublica message: include title, URL, and preview image if available
    const propubText = `📰 *ProPublica*\n[${latestPropub.title}](${latestPropub.url})`;
    const propubImage = latestPropub.previewImage || null;

    console.log('\n📤 Sending ProPublica test message...');
    try {
      await sendNewsMessage(propubText, propubImage, null);
      console.log('✅ ProPublica test message sent successfully');
    } catch (error) {
      console.error('❌ Error sending ProPublica message:', error);
    }
  }

  // 2) Fetch latest ConsortiumNews article and generate AI summary
  console.log('\n📥 Fetching latest ConsortiumNews article…');
  let consArticles;
  try {
    consArticles = await consortiumUrlFiltering(false);
  } catch (err) {
    console.error('❌ Error in ConsortiumNews url_filtering:', err);
    consArticles = [];
  }

  if (consArticles.length === 0) {
    console.log('⚠️ No recent ConsortiumNews articles found');
    return;
  }

  console.log(`✅ Found ${consArticles.length} ConsortiumNews articles, picking latest…`);
  let consArticle;
  try {
    consArticle = await GetLatestArticle(consArticles);
  } catch (err) {
    console.error('❌ Error in GetLatestArticle:', err);
    consArticle = null;
  }

  if (!consArticle) {
    console.log('⚠️ Could not retrieve detailed ConsortiumNews article');
    return;
  }

  console.log('✅ Latest ConsortiumNews URL:', consArticle.url);
  console.log('🔄 Generating AI summary for ConsortiumNews article…');

  let aiResult;
  try {
    aiResult = await AI_message_Gen(false);
  } catch (err) {
    console.error('❌ Error generating AI summary:', err);
    aiResult = null;
  }

  if (!aiResult) {
    console.log('⚠️ AI summary failed or returned null');
    return;
  }

  // Construct Telegram message: AI summary + “read more” link + hero image
  const consText = `🗞️ *ConsortiumNews*\n${aiResult.summary}\n\n[Read more ›](${consArticle.url})`;
  const consImage = aiResult.heroImage || null;

  console.log('\n📤 Sending ConsortiumNews test message...');
  try {
    await sendNewsMessage(consText, consImage, null);
    console.log('✅ ConsortiumNews test message sent successfully');
  } catch (error) {
    console.error('❌ Error sending ConsortiumNews message:', error);
  }
}

// Run the Telegram test
console.log('🎬 Starting Telegram test sequence...');
testTelegram()
  .then(() => {
    console.log('\n✨ All Telegram tests completed!');
  })
  .catch(err => {
    console.error('Fatal error in Telegram tests:', err);
    process.exit(1);
  });
