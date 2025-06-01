// Test image sending functionality
import { sendNewsMessage } from './sender.js';
import { config } from './utils/config.js';

// Test URLs representing different scenarios
const TEST_CASES = [
    {
        name: 'ConsortiumNews JPEG',
        imageUrl: 'https://consortiumnews.com/wp-content/uploads/2024/01/featured-image.jpg',
        message: '🧪 Testing ConsortiumNews JPEG image',
        articleUrl: 'https://consortiumnews.com/test-article'
    },
    {
        name: 'ProPublica PNG',
        imageUrl: 'https://assets-c3.propublica.org/images/articles/example.png',
        message: '🧪 Testing ProPublica PNG image',
        articleUrl: 'https://www.propublica.org/test-article'
    },
    {
        name: 'Truthout WebP',
        imageUrl: 'https://truthout.org/wp-content/uploads/2024/example.webp',
        message: '🧪 Testing Truthout WebP image',
        articleUrl: 'https://truthout.org/test-article'
    },
    {
        name: 'Invalid URL',
        imageUrl: 'https://invalid-domain-123456.com/image.jpg',
        message: '🧪 Testing invalid image URL handling',
        articleUrl: 'https://example.com/test'
    },
    {
        name: 'No Image',
        imageUrl: null,
        message: '🧪 Testing message without image',
        articleUrl: 'https://example.com/test-no-image'
    }
];

async function testImageSend() {
    console.log('🧪 Starting comprehensive image sending tests...');
    
    for (const testCase of TEST_CASES) {
        console.log(`\n📋 Testing case: ${testCase.name}`);
        try {
            await sendNewsMessage(
                testCase.message,
                testCase.imageUrl,
                testCase.articleUrl
            );
            console.log(`✅ Test case "${testCase.name}" completed successfully`);
        } catch (error) {
            console.error(`❌ Test case "${testCase.name}" failed:`, error);
            // Continue testing other cases even if one fails
            continue;
        }
        
        // Add a delay between tests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Run all tests
console.log('Starting image sending tests...');
testImageSend().then(() => {
    console.log('\n🎉 All tests completed!');
}).catch(err => {
    console.error('Fatal error in image tests:', err);
    process.exit(1);
});
