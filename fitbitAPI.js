const https = require('https');
const { getValidAccessToken } = require('./fitbitTokens');

// fitbitAPI.js - Fitbit Web API helper

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
 * Get intraday heart rate (1-minute detail) for a date (YYYY-MM-DD)
 */
async function getHeartRateIntraday(date) {
    return fitbitRequest(`/1/user/-/activities/heart/date/${date}/1d/1min.json`);
}

module.exports = {
    getDailyActivity,
    getSleep,
    getHeartRateIntraday
};