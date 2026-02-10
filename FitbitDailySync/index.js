// FitbitDailySync/index.js - Azure Function for daily Fitbit sync
const { syncFitbitData } = require('../vitalityHelpers');

module.exports = async function (context, myTimer) {
  const timestamp = new Date().toISOString();
  
  if (myTimer.isPastDue) {
    context.log('⚠️ Timer is running late');
  }

  context.log(`🔄 Starting daily Fitbit sync at ${timestamp}`);

  try {
    // Sync yesterday's data (finalized overnight)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    const result = await syncFitbitData(yesterdayDate);
    
    context.log(`✅ Fitbit sync completed for ${yesterdayDate}`);
    context.log(`   Steps: ${result.steps}, Calories: ${result.calories}`);
    context.log(`   Sleep: ${result.sleepMinutes} min, Resting HR: ${result.restingHR}`);

    context.res = {
      status: 200,
      body: {
        success: true,
        syncDate: yesterdayDate,
        timestamp,
        data: result
      }
    };

  } catch (error) {
    context.log.error('❌ Fitbit sync failed:', error);
    
    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        timestamp
      }
    };
  }
};
