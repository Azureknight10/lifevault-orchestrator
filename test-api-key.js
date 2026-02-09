const axios = require('axios');

require('dotenv').config();

console.log('Checking USDA API Key setup...\n');
console.log('API Key exists:', !!process.env.USDA_API_KEY);
console.log('API Key length:', process.env.USDA_API_KEY?.length);
console.log('First 5 chars:', process.env.USDA_API_KEY?.substring(0, 5));
console.log('Last 5 chars:', process.env.USDA_API_KEY?.substring(process.env.USDA_API_KEY.length - 5));

// Test the API directly with a simple GET request

async function testAPIKey() {
    try {
        const url = `https://api.nal.usda.gov/fdc/v1/food/534358?api_key=${process.env.USDA_API_KEY}`;
        console.log('\nTesting API with direct GET request...');
        const response = await axios.get(url);
        console.log('✅ API Key is valid! Response status:', response.status);
    } catch (error) {
        console.log('❌ API Key test failed:', error.response?.status, error.response?.statusText);
        console.log('Response data:', error.response?.data);
    }
}

testAPIKey();