// test-father.js - Test Father Agent with progress tracking
require('dotenv').config();
const FatherAgent = require('./Agents/fatherAgent');

async function test() {
    console.log('🧪 Testing Father Agent with Progress Tracking...\n');
    console.log('='.repeat(80));
    
    const agent = new FatherAgent();
    
    const testQueries = [
        // Test logging
        "Log session: Amelia practiced sight words for 15 minutes. Mastered 3 new words (the, and, is). Got frustrated once. Total now 48 words.",
        
        // Test progress report
        "Show me Amelia's reading progress report",
        
        // Test guidance
        "How can I help Evander focus better on homework?",
        
        // Test comparison
        "Compare Amelia's progress this week vs last week"
    ];
    
    const query = process.argv[2] || testQueries[0];
    
    console.log(`\n📝 Query: "${query}"\n`);
    console.log('='.repeat(80) + '\n');
    
    try {
        const result = await agent.process(query, {});
        
        console.log('\n' + '='.repeat(80));
        console.log('👨‍👦 FATHER AGENT RESULTS:');
        console.log('='.repeat(80) + '\n');
        
        console.log('Child Focus:', result.child_focus || 'General');
        console.log('Topic:', result.topic);
        console.log('Action:', result.action);
        
        if (result.session_data) {
            console.log('\n📋 Session Data Logged:');
            console.log(JSON.stringify(result.session_data, null, 2));
        }
        
        if (result.feedback) {
            console.log('\n📊 Session Feedback:');
            console.log(result.feedback);
        }
        
        if (result.report) {
            console.log('\n📈 Progress Report:');
            console.log(result.report);
        }
        
        if (result.guidance) {
            console.log('\n💡 Parenting Guidance:');
            console.log(result.guidance);
        }
        
        if (result.comparison) {
            console.log('\n📊 Progress Comparison:');
            console.log(result.comparison);
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
