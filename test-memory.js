// test-memory.js - Test the Memory Agent
require('dotenv').config();
const MemoryAgent = require('./Agents/Memoryagent');

async function test() {
    console.log('🧪 Testing Advanced Memory Agent...\n');
    console.log('='.repeat(80));
    
    const agent = new MemoryAgent();
    
    // Test queries
    const testQueries = [
        "Show me my workout history from the past week",
        "How am I doing?",
        "Compare my energy levels this month vs last month",
        "Why do I feel tired on Mondays?"
    ];
    
    // Pick first query or use command line argument
    const query = process.argv[2] || testQueries[0];
    
    console.log(`\n📝 Query: "${query}"\n`);
    console.log('='.repeat(80) + '\n');
    
    try {
        const result = await agent.process(query, {
            conversationHistory: []
        });
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 MEMORY AGENT RESULTS:');
        console.log('='.repeat(80) + '\n');
        
        // Display summary
        console.log('⏱️  Processing Time:', result.processing_time_ms, 'ms\n');
        
        console.log('📦 Data Retrieved:');
        console.log('  - Azure Records:', result.data_sources.azure_records);
        console.log('  - Perplexity Searches:', result.data_sources.perplexity_searches);
        console.log('  - Cross-Domain Records:', result.data_sources.cross_domain_records);
        console.log('  - Total:', result.data_sources.total, '\n');
        
        if (result.intelligence_outputs) {
            console.log('🧠 Intelligence Outputs:');
            console.log('  - Patterns Detected:', result.intelligence_outputs.patterns_detected);
            console.log('  - Anomalies Found:', result.intelligence_outputs.anomalies_found);
            console.log('  - Correlations:', result.intelligence_outputs.correlations_discovered);
            console.log('  - Forecast Horizon:', result.intelligence_outputs.forecast_horizon_days, 'days');
            console.log('  - Proactive Insights:', result.intelligence_outputs.proactive_insights, '\n');
        }
        
        // Display detailed insights
        if (result.detailed_insights) {
            console.log('='.repeat(80));
            console.log('🔍 DETAILED INSIGHTS:');
            console.log('='.repeat(80) + '\n');
            
            if (result.detailed_insights.patterns.length > 0) {
                console.log('📈 PATTERNS:');
                result.detailed_insights.patterns.forEach((p, i) => {
                    console.log(`\n  [${i + 1}] ${p.type}`);
                    console.log(`      ${p.insight}`);
                });
                console.log('\n');
            }
            
            if (result.detailed_insights.anomalies.length > 0) {
                console.log('🚨 ANOMALIES:');
                result.detailed_insights.anomalies.forEach((a, i) => {
                    console.log(`\n  [${i + 1}] ${a.type} (${a.severity})`);
                    console.log(`      ${a.insight}`);
                });
                console.log('\n');
            }
            
            if (result.detailed_insights.correlations.length > 0) {
                console.log('🔗 CORRELATIONS:');
                result.detailed_insights.correlations.forEach((c, i) => {
                    console.log(`\n  [${i + 1}] ${c.type}`);
                    console.log(`      ${c.insight}`);
                    console.log(`      Strength: ${c.strength}%`);
                });
                console.log('\n');
            }
            
            if (result.detailed_insights.proactive_suggestions.length > 0) {
                console.log('💡 PROACTIVE SUGGESTIONS:');
                result.detailed_insights.proactive_suggestions.forEach((s, i) => {
                    console.log(`\n  [${i + 1}] ${s.priority.toUpperCase()}`);
                    console.log(`      ${s.message}`);
                    console.log(`      Action: ${s.action_suggestion}`);
                });
                console.log('\n');
            }
        }
        
        // Display analysis
        console.log('='.repeat(80));
        console.log('📝 FINAL ANALYSIS:');
        console.log('='.repeat(80) + '\n');
        console.log(result.analysis);
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Success
        console.log('✅ Test completed successfully!\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run test
test();
