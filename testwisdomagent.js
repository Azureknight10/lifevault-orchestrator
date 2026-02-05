require('dotenv').config();

const WisdomAgent = require('./Agents/wisdomAgent');
const { getMemoriesForTopic, closeDriver } = require('./graphstore');

async function main() {
  const userId = 'user-001';
  const query = 'Give me a plan to stabilize my blood sugar and workouts this week';

  // Create agent instance and call process directly
  const agent = new WisdomAgent();
  
  const result = await agent.process(query, {
    userId,
    context: { userId }
  });

  console.log('\n=== WISDOM AGENT RESPONSE ===\n');
  console.log('Success:', result.success);
  console.log('\nGuidance:\n', result.guidance);
  console.log('\nQuery Type:', result.query_type);
  console.log('Domains:', result.domains);
  console.log('Time Horizon:', result.time_horizon);

  console.log('\n=== MEMORIES STORED IN NEO4J ===\n');
  const memories = await getMemoriesForTopic(userId, 'wisdom', 5);
  memories.forEach((m, i) => {
    console.log(`${i + 1}. [${m.sourceAgent}] ${m.text.substring(0, 80)}...`);
  });

  await closeDriver();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
