// test-sync.js
require('dotenv').config();
const { syncFitbitData } = require('./vitalityHelpers');

async function test() {
  const today = new Date().toISOString().split('T')[0];
  
  console.log('Syncing Fitbit data for:', today);
  const result = await syncFitbitData(today);
  
  console.log('\nSync result:', result);
}

test().catch(console.error);
