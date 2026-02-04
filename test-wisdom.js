// test-wisdom.js - Test Wisdom Agent
require('dotenv').config();
const WisdomAgent = require('./Agents/wisdomAgent');

async function test() {
    console.log('🧪 Testing Wisdom Agent...\n');
    console.log('='.repeat(80));

    const agent = new WisdomAgent();

    const testQueries = [
        // Decision framework
        "I'm torn between taking a new leadership role or staying in my current position. Help me decide.",

        // Long-term planning
        "Create a 12-month life plan that balances career growth, parenting, and health.",

        // Accountability
        "I keep falling off my habits after two weeks. I need accountability and a system."
    ];

    const query = process.argv[2] || testQueries[0];

    console.log(`\n📝 Query: "${query}"\n`);
    console.log('='.repeat(80) + '\n');

    try {
        const result = await agent.process(query, {});

        console.log('\n' + '='.repeat(80));
        console.log('🧭 WISDOM AGENT RESULTS:');
        console.log('='.repeat(80) + '\n');

        console.log('Query Type:', result.query_type || 'General');
        console.log('Domains:', (result.domains || []).join(', '));
        console.log('Time Horizon:', result.time_horizon || 'N/A');

        if (result.guidance) {
            console.log('\n💡 Guidance:');
            console.log(result.guidance);
        }

        console.log('\n' + '='.repeat(80) + '\n');
        console.log('✅ Test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

test();
