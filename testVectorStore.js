const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { upsertMemory, searchMemories } = require('./vectorStore');

function requireEnv(name) {
    if (!process.env[name]) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
}

function validateVectorStoreEnv() {
    requireEnv('AZURE_SEARCH_ENDPOINT');
    requireEnv('AZURE_SEARCH_API_KEY');
    requireEnv('AZURE_SEARCH_INDEX_NAME');
    requireEnv('AZURE_OPENAI_ENDPOINT');
    requireEnv('AZURE_OPENAI_API_KEY');
    requireEnv('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT');
}

async function run() {
    validateVectorStoreEnv();
    const userId = 'demo-user';

    const inserted = await upsertMemory({
        userId,
        source: 'agent_insight',
        timestamp: new Date().toISOString(),
        text: 'I felt exhausted after a late-night coding session and skipped my workout.'
    });

    console.log('Upserted:', inserted.id);

    const results = await searchMemories({
        userId,
        query: 'fatigued after coding at night and missed exercise',
        topK: 3
    });

    console.log('Search results:');
    results.forEach((result, index) => {
        console.log(`${index + 1}. score=${result.score} source=${result.source} text=${result.text}`);
    });
}

run().catch((error) => {
    console.error('Vector store test failed:', error.message);
    process.exit(1);
});
