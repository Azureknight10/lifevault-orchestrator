// fitbitAPI.js - Fitbit Web API helper
const https = require('https');
const { getValidAccessToken } = require('./fitbitTokens');

/**
 * Make an authenticated GET request to Fitbit API
 */
async function fitbitRequest(path) {
  const accessToken = await getValidAccessToken();

  const options = {
    hostname: 'api.fitbit.com',
    path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Fitbit API error: ${res.statusCode} - ${data}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse Fitbit response'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Get daily activity summary for a date (YYYY-MM-DD)
 */
async function getDailyActivity(date) {
  return fitbitRequest(`/1/user/-/activities/date/${date}.json`);
}

/**
 * Get sleep logs for a date (YYYY-MM-DD)
 */
async function getSleep(date) {
  return fitbitRequest(`/1.2/user/-/sleep/date/${date}.json`);
}

/**
 * Get activity log (workouts) for a date (YYYY-MM-DD)
 */
async function getActivityLog(date) {
  return fitbitRequest(`/1/user/-/activities/list.json?afterDate=${date}&sort=asc&offset=0&limit=20`);
}

/**
 * Get intraday heart rate (1-minute detail) for a date (YYYY-MM-DD)
 */
async function getHeartRateIntraday(date) {
  return fitbitRequest(`/1/user/-/activities/heart/date/${date}/1d/1min.json`);
}

/**
 * Get readiness score for a date (YYYY-MM-DD)
 */
async function getReadiness(date) {
  return fitbitRequest(`/1/user/-/readiness/date/${date}.json`);
}

/**
 * Get HRV summary for a date (YYYY-MM-DD)
 */
async function getHrv(date) {
  return fitbitRequest(`/1/user/-/hrv/date/${date}.json`);
}

/**
 * Get SpO2 for a date (YYYY-MM-DD)
 */
async function getSpo2(date) {
  return fitbitRequest(`/1/user/-/spo2/date/${date}.json`);
}

/**
 * Get skin temperature for a date (YYYY-MM-DD)
 */
async function getSkinTemp(date) {
  return fitbitRequest(`/1/user/-/temp/skin/date/${date}.json`);
}

/**
 * Get cardio fitness (VO2 max) for a date (YYYY-MM-DD)
 */
async function getCardioFitness(date) {
  return fitbitRequest(`/1/user/-/cardioscore/date/${date}.json`);
}

/**
 * Get sleep score for a date (YYYY-MM-DD)
 */
async function getSleepScore(date) {
  return fitbitRequest(`/1/user/-/sleep/score/date/${date}.json`);
}

/**
 * Get health metrics summary for a date (YYYY-MM-DD)
 */
async function getHealthMetrics(date) {
  return fitbitRequest(`/1/user/-/health/metrics/date/${date}.json`);
}

/**
 * Get food log for a date (YYYY-MM-DD)
 */
async function getFoodLog(date) {
  return fitbitRequest(`/1/user/-/foods/log/date/${date}.json`);
}

module.exports = {
  getDailyActivity,
  getSleep,
  getHeartRateIntraday,
  getActivityLog,
  getReadiness,
  getHrv,
  getSpo2,
  getSkinTemp,
  getCardioFitness,
  getSleepScore,
  getHealthMetrics,
  getFoodLog
};
