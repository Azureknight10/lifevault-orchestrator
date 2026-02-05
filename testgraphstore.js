const { saveMemory, getMemoriesForTopic, closeDriver } = require('./graphstore');

require('dotenv').config();

async function main() {
    const userId = 'user-001';

    console.log('Saving a test memory...');
    await saveMemory({
        userId,
        id: 'mem-test-001',
        text: 'Testing Neo4j graphStore wiring from LifeVault.',
        topics: ['lifevault', 'projects'],
        sourceAgent: 'wisdom',
    });

    console.log('Querying memories for topic "lifevault"...');
    const memories = await getMemoriesForTopic(userId, 'lifevault');
    console.log(memories);

    await closeDriver();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});