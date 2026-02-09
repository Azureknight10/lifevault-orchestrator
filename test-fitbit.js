// test-fitbit.js
require('dotenv').config();
const { getDailyActivity, getSleep, getHeartRateIntraday } = require('./fitbitAPI');

async function test() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  console.log('Fetching today\'s Fitbit data for:', today);

  try {
    const activity = await getDailyActivity(today);
    console.log('\n=== ACTIVITY ===');
    console.log('Steps:', activity.summary.steps);
    console.log('Calories:', activity.summary.caloriesOut);
    console.log('Active Minutes:', activity.summary.fairlyActiveMinutes + activity.summary.veryActiveMinutes);

    const sleep = await getSleep(today);
    console.log('\n=== SLEEP ===');
    if (sleep.sleep && sleep.sleep.length > 0) {
      const main = sleep.sleep[0];
      console.log('Duration:', main.duration / 1000 / 60, 'minutes');
      console.log('Efficiency:', main.efficiency);
      console.log('Stages:', main.levels?.summary);
    } else {
      console.log('No sleep data for today yet');
    }

    const hr = await getHeartRateIntraday(today);
    console.log('\n=== HEART RATE ===');
    console.log('Resting HR:', hr['activities-heart'][0]?.value?.restingHeartRate);
    console.log('Intraday samples:', hr['activities-heart-intraday']?.dataset?.length || 0);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
