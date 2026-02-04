const AnalyticsAgent = require('./Agents/analyticsagent');

async function test() {
    console.log('🧪 Testing Analytics Agent...\n');
    
    const agent = new AnalyticsAgent();
    
    // Mock data for testing
    const mockContext = {
        conversationHistory: [],
        historical_data: [
            { date: '2026-01-20', workout_duration: 45, energy_level: 7 },
            { date: '2026-01-22', workout_duration: 50, energy_level: 8 },
            { date: '2026-01-25', workout_duration: 30, energy_level: 5 },
            { date: '2026-01-27', workout_duration: 55, energy_level: 8 },
            { date: '2026-01-30', workout_duration: 60, energy_level: 9 },
            { date: '2026-02-01', workout_duration: 45, energy_level: 7 },
            { date: '2026-02-03', workout_duration: 65, energy_level: 9 }
        ]
    };
    
    const result = await agent.process(
        'Why do I have more energy on some workout days?',
        mockContext
    );
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYTICS AGENT RESULTS:');
    console.log('='.repeat(80) + '\n');
    console.log(JSON.stringify(result, null, 2));
}

test();