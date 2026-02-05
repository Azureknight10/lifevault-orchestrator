require('dotenv').config();

const { saveMemory, getMemoriesForTopic, closeDriver } = require('./graphstore');
const { startWisdomAgent } = require('./Agents/wisdomAgent');

async function main() {
  const userId = 'user-001';
  const query = 'Give me a plan to stabilize my blood sugar and workouts this week';

  const result = await startWisdomAgent({ userId, query, context: {} });
  console.log('Wisdom response:\n', result.response);

  const memories = await getMemoriesForTopic(userId, 'wisdom', 5);
  console.log('\nWisdom memories from Neo4j:\n', memories);

  await closeDriver();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
