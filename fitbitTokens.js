// fitbitTokens.js - store and load Fitbit OAuth tokens in Azure Tables
require('dotenv').config();
const { TableClient } = require('@azure/data-tables');
const https = require('https');

const TABLE_NAME = 'FitbitTokens';
const PARTITION_KEY = 'USER_shane-dev-001';
const ROW_KEY = 'fitbit';

function getTableClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is missing');
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

/**
 * Save tokens from Fitbit OAuth callback
 */
async function saveTokens({ userId, accessToken, refreshToken, scope, expiresIn }) {
  const client = getTableClient();
  const now = Date.now();
  const expiresAt = new Date(now + expiresIn * 1000).toISOString();

  const entity = {
    partitionKey: PARTITION_KEY,
    rowKey: ROW_KEY,
    userId,
    accessToken,
    refreshToken,
    scope,
    expiresAt
  };

  await client.upsertEntity(entity, 'Merge');
  return entity;
}

/**
 * Load tokens (no refresh)
 */
async function getTokens() {
  const client = getTableClient();
  const entity = await client.getEntity(PARTITION_KEY, ROW_KEY);

  return {
    userId: entity.userId,
    accessToken: entity.accessToken,
    refreshToken: entity.refreshToken,
    scope: entity.scope,
    expiresAt: entity.expiresAt
  };
}

/**
 * Get a valid access token, refreshing if expired
 */
async function getValidAccessToken() {
  const client = getTableClient();
  const entity = await client.getEntity(PARTITION_KEY, ROW_KEY);

  const now = new Date();
  const expiresAt = new Date(entity.expiresAt);

  // If token is still valid (with 5 min buffer), return it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return entity.accessToken;
  }

  // Token expired, refresh it
  console.log('[Fitbit] Access token expired, refreshing...');

  const tokenUrl = new URL(process.env.FITBIT_TOKEN_URL);
  const basicAuth = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64');

  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: entity.refreshToken
  }).toString();

  const options = {
    hostname: tokenUrl.hostname,
    path: tokenUrl.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);

          // Save new tokens
          const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
          await client.upsertEntity({
            partitionKey: PARTITION_KEY,
            rowKey: ROW_KEY,
            userId: entity.userId,
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            scope: json.scope,
            expiresAt: newExpiresAt
          }, 'Merge');

          console.log('[Fitbit] Token refreshed successfully');
          resolve(json.access_token);
        } catch (e) {
          reject(new Error('Failed to parse refresh token response: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  saveTokens,
  getTokens,
  getValidAccessToken
};
