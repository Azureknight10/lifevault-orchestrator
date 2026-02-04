require('dotenv').config();
const axios = require('axios');

async function testPerplexity() {
    console.log('🧪 Testing Perplexity API...\n');
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ MISSING');
    console.log('');
    
    if (!apiKey) {
        console.error('❌ No API key found in .env file');
        console.log('\nAdd to your .env file:');
        console.log('PERPLEXITY_API_KEY=pplx-your_key_here\n');
        process.exit(1);
    }
    
    try {
        console.log('Sending test request to Perplexity API...\n');
        
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar-pro',
                messages: [
                    { role: 'user', content: 'Say hello in 5 words' }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        console.log('✅ Perplexity API is working!\n');
        console.log('Response:', response.data.choices[0].message.content);
        console.log('\nStatus Code:', response.status);
        console.log('Model Used:', response.data.model);
        console.log('\n✅ Test passed!\n');
        
    } catch (error) {
        console.error('❌ Perplexity API failed:\n');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('\nFull Error:', error.message);
        
        if (error.response?.status === 401) {
            console.log('\n💡 This is an authentication error. Check your API key.');
        } else if (error.response?.status === 400) {
            console.log('\n💡 This is a bad request error. Check the request format.');
        }
        
        process.exit(1);
    }
}

testPerplexity();
