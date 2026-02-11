# Lifevault Orchestrator

## Local quick start

Prereqs:
- Node.js (LTS)
- Azure Functions Core Tools

### 1) Start the Node server (coach API)

```powershell
node server.js
```

This serves the coach endpoint at:
- http://localhost:3000/api/coach-lite

### 2) Start the Functions host (Fitbit + meals)

Recommended (CORS for the Lite UI):

```powershell
func host start --cors http://localhost:5500
```

The Functions host listens on:
- http://localhost:7071/api

### 3) Verify endpoints

- http://localhost:7071/api/fitbit/summary/yesterday?date=YYYY-MM-DD
- http://localhost:7071/api/meals/recent?userId=user-1&limit=5

## Troubleshooting

- Port 3000 in use: stop the process using it, then rerun `node server.js`.
- If Functions are unreachable, make sure the host is running on 7071.
