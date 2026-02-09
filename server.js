const { saveTokens } = require('./fitbitTokens');
const { URL } = require('url');
const https = require('https');

// server.js - simple HTTP wrapper for orchestrator.js
require('dotenv').config();
console.log('FITBIT env check:', {
  id: process.env.FITBIT_CLIENT_ID,
  secret: process.env.FITBIT_CLIENT_SECRET ? 'set' : 'missing',
  redirect: process.env.FITBIT_REDIRECT_URI,
  authUrl: process.env.FITBIT_AUTH_URL,
  tokenUrl: process.env.FITBIT_TOKEN_URL
});
const http = require('http');
const { runOrchestration } = require('./orchestrator');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  console.log('REQUEST:', req.method, req.url); // debug line

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const path = req.url.split('?')[0];

  // 1) Fitbit auth start: GET /auth/fitbit
  if (req.method === 'GET' && path === '/auth/fitbit') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.FITBIT_CLIENT_ID,
      redirect_uri: process.env.FITBIT_REDIRECT_URI,
      scope: 'activity heartrate sleep'
    });

    const authorizeUrl = `${process.env.FITBIT_AUTH_URL}?${params.toString()}`;
    console.log('Redirecting to Fitbit:', authorizeUrl);
    res.writeHead(302, { Location: authorizeUrl });
    return res.end();
  }

  // 2) Fitbit callback: GET /auth/fitbit/callback?code=...
  if (req.method === 'GET' && path === '/auth/fitbit/callback') {
    const urlObj = new URL(req.url, 'http://localhost:3000');
    const code = urlObj.searchParams.get('code');
    console.log('Fitbit callback code:', code);

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing code');
    }

    const tokenUrl = new URL(process.env.FITBIT_TOKEN_URL);
    const basicAuth = Buffer.from(
      `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
    ).toString('base64');

    const postData = new URLSearchParams({
      client_id: process.env.FITBIT_CLIENT_ID,
      grant_type: 'authorization_code',
      redirect_uri: process.env.FITBIT_REDIRECT_URI,
      code
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

    const tokenReq = https.request(options, tokenRes => {
      let data = '';
      tokenRes.on('data', chunk => (data += chunk));
      tokenRes.on('end', async () => {
        try {
          const json = JSON.parse(data);

          // Save to Azure Table
          const saved = await saveTokens({
            userId: json.user_id,
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            scope: json.scope,
            expiresIn: json.expires_in
          });

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            message: 'Fitbit tokens saved',
            userId: saved.userId,
            scope: saved.scope,
            expiresAt: saved.expiresAt
          }));
        } catch (e) {
          console.error('Error parsing/saving Fitbit tokens:', e, data);
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: 'Failed to save tokens' }));
        }
      });
    });

    tokenReq.on('error', err => {
      console.error('Fitbit token error:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Token request failed' }));
    });

    tokenReq.write(postData);
    tokenReq.end();
    return;
  }

  // 3) Existing orchestrate endpoint: POST /api/orchestrate
  if (req.method === 'POST' && path === '/api/orchestrate') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');

        const {
          userId = 'shane-dev-001',
          persona = 'dev',
          intent = 'plan_day',
          inputText = '',
          uiContext = {}
        } = payload;

        const result = await runOrchestration(inputText, {
          userId,
          persona,
          intent,
          uiContext
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error(err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: err.message || 'Server error' }));
      }
    });
    return;
  }

  // Fallback 404
  console.log('FALLTHROUGH 404 for:', req.method, path);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`LifeVault HTTP server running at http://localhost:${PORT}/api/orchestrate`);
});
