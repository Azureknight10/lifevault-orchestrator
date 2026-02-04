// test-vitality.js - Test the Vitality Agent
require('dotenv').config();
const VitalityAgent = require('./agents/vitalityAgent');

async function test() {
    console.log('🧪 Testing Vitality Agent...\n');
    console.log('='.repeat(80));
    
    const agent = new VitalityAgent();
    
    const testQueries = [
        "Grade my meal: Grilled chicken breast, brown rice, broccoli, and olive oil",
        "Why do I feel tired after workouts?",
        "Analyze my workout patterns",
        "How can I improve my sleep quality?"
    ];
    
    const query = process.argv[2] || testQueries[0];
    
    console.log(`\n📝 Query: "${query}"\n`);
    console.log('='.repeat(80) + '\n');
    
    // Mock vitality data
    const mockContext = {
        historical_data: [
            { date: '2026-02-01', workout_duration: 45, energy_level: 7, sleep_hours: 7 },
            { date: '2026-02-02', workout_duration: 50, energy_level: 8, sleep_hours: 8 },
            { date: '2026-02-03', workout_duration: 30, energy_level: 5, sleep_hours: 6 }
        ]
    };
    
    try {
        const result = await agent.process(query, mockContext);
        
        console.log('\n' + '='.repeat(80));
        console.log('💪 VITALITY AGENT RESULTS:');
        console.log('='.repeat(80) + '\n');
        
        console.log('Query Type:', result.query_type);
        console.log('Data Points:', result.vitality_data_points);
        console.log('\n' + '='.repeat(80));
        console.log('📊 ANALYSIS:');
        console.log('='.repeat(80) + '\n');
        console.log(result.analysis);
        console.log('\n' + '='.repeat(80) + '\n');
        
        console.log('✅ Test completed successfully!\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

test();
