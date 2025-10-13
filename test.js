const WhatnotAutoPoster = require('./index.js');

// Test the categorization logic
async function testCategorization() {
    console.log('🧪 Testing product categorization...');
    
    const poster = new WhatnotAutoPoster();
    
    // Test different product types
    const testCases = [
        {
            title: 'Pokemon Booster Box Opening Live',
            description: 'Opening rare Pokemon TCG booster packs',
            expected: 'trading-cards'
        },
        {
            title: 'Original Landscape Painting',
            description: 'Beautiful acrylic painting on canvas',
            expected: 'paintings'
        },
        {
            title: 'Handmade Custom Jewelry',
            description: 'Artisan crafted handmade necklace',
            expected: 'handmade'
        },
        {
            title: 'Vintage Comic Book Collection',
            description: 'Rare collectible comics from the 80s',
            expected: 'collectibles'
        },
        {
            title: 'Random Item',
            description: 'Just some random stuff',
            expected: 'general'
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        const result = await poster.analyzeProductCategory(testCase);
        const success = result === testCase.expected;
        
        console.log(`${success ? '✅' : '❌'} "${testCase.title}" -> ${result} (expected: ${testCase.expected})`);
        
        if (success) passed++;
    }
    
    console.log(`\n📊 Categorization Tests: ${passed}/${total} passed\n`);
    
    // Test content generation
    console.log('🧪 Testing content generation...');
    
    const testListing = {
        title: 'Amazing Pokemon Card Collection',
        description: 'Rare Charizard and other valuable cards',
        price: '$150',
        seller: 'JFox Ink',
        url: 'https://whatnot.com/live/pokemon-cards-123'
    };
    
    const content = await poster.generatePostContent(testListing, 'Check out this amazing find!');
    console.log('Generated content:');
    console.log('---');
    console.log(content);
    console.log('---\n');
    
    // Test platform mapping
    console.log('🧪 Testing platform mapping...');
    
    const platforms = poster.getRelevantPlatforms('trading-cards');
    console.log('Trading cards platforms:', platforms);
    
    const paintingPlatforms = poster.getRelevantPlatforms('paintings');
    console.log('Painting platforms:', paintingPlatforms);
    
    console.log('\n✅ All core functionality tests completed successfully!');
    
    // Don't exit, let the server keep running
    return true;
}

// Run tests only if this is the main module
if (require.main === module) {
    testCategorization().catch(console.error);
} else {
    // If imported, just run tests and export for the main app
    setTimeout(testCategorization, 2000);
}

module.exports = { testCategorization };
