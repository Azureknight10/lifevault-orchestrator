const { saveMemory, getMemoriesForTopic, closeDriver } = require('./graphstore');

require('dotenv').config();

async function main() {
    const userId = 'user-001';

    const responseText = 'Weekly plan to stabilize my blood sugar and workouts (manual test).';
    const topics = ['wisdom', 'nutrition', 'workouts'];

    await saveMemory({
        userId,
        id: `wisdom-manual-${Date.now()}`,
        text: responseText,
        topics,
        sourceAgent: 'wisdom',
    });

    const memories = await getMemoriesForTopic(userId, 'wisdom', 5);
    console.log('Wisdom memories from Neo4j:\n', memories);

    await closeDriver();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});