const { storeMemory, searchMemories } = require('./vectorStore');

async function run() {
  const userId = 'test-user';

  // 1) Store a test memory
  const content = 'This is a test memory about workouts';
  const metadata = { category: 'fitness', note: 'vector test' };

  const memoryId = await storeMemory(userId, content, metadata);
  console.log('Stored memory ID:', memoryId);

  // 2) Query with a very similar phrase
  const query = 'test memory about workouts';

  const results = await searchMemories(userId, query, 5);
  console.log('Search results:');
  for (const r of results) {
    console.log(`Score: ${r.score.toFixed(3)} | Id: ${r.id} | Content: ${r.content}`);
    console.log('Metadata:', r.metadata);
  }
}

run().catch(err => {
  console.error('Test failed:', err);
});
