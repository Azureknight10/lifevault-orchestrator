// server.js - simple HTTP wrapper for orchestrator.js
require('dotenv').config();
const http = require('http');
const { runOrchestration } = require('./orchestrator');

const PORT = process.env.PORT || 7071;

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    if (req.method !== 'POST' || req.url !== '/api/orchestrate') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Not found' }));
    }

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
});

server.listen(PORT, () => {
    console.log(`LifeVault HTTP server running at http://localhost:${PORT}/api/orchestrate`);
});
