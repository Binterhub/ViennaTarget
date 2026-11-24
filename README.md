# Vienna Doctor Explorer

Simple demonstrator web app for browsing and filtering doctors in **Wien** via the Evolantis **DataMatcherAPI**.

- Backend: Node.js + Express (JWT auth, in-memory cache, pagination)
- Frontend: HTML / CSS / Vanilla JS + Chart.js
- No database, no end-user login

## Features

- Server-side API authentication (`X-API-Key` → JWT, auto-refresh)
- Loads **all** Vienna doctors with pagination (`take` ≤ 500)
- In-memory cache (default **15 minutes**)
- Stats: total doctors, distinct main specializations, additional specializations, filtered hit count
- Horizontal bar chart of the top 10 main specializations
- Filters: name free-text, main/additional specialization (multi-select), EVOID
- Postleitzahl / Geschlecht filters appear **only** if those fields exist in real API responses
- Sortable table with page sizes 25 / 50 / 100
- Health check at `/health`
- Rate limiting on `/api/doctors`

## Setup

```bash
cp .env.example .env
# Edit .env and set DATAMATCHER_API_URL + DATAMATCHER_API_KEY
npm install
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATAMATCHER_API_URL` | yes (for live data) | Base URL of DataMatcherAPI (no trailing slash needed) |
| `DATAMATCHER_API_KEY` | yes (for live data) | API key sent as `X-API-Key` to `/api/auth/token` |
| `PORT` | no | Server port (default `3000`) |
| `CACHE_TTL_MINUTES` | no | Cache lifetime in minutes (default `15`) |
| `API_TIMEOUT_MS` | no | Upstream request timeout (default `30000`) |

## Run locally

```bash
npm start
# open http://localhost:3000
```

Development (auto-restart on file changes, Node 18+):

```bash
npm run dev
```

## API connection test

```bash
npm run test:api
```

Verifies token issuance and a small Vienna doctor search against the configured upstream API.

## Health check

```bash
curl http://localhost:3000/health
```

## Railway deployment

1. Create a Railway project from this repository.
2. Set environment variables: `DATAMATCHER_API_URL`, `DATAMATCHER_API_KEY` (and optionally `CACHE_TTL_MINUTES`).
3. Deploy. Railway uses `railway.toml` / `Procfile` (`npm start`).
4. Health check path: `/health`.

## Project layout

```
├── server.js              # Express app entry
├── src/
│   ├── config.js          # Env config
│   ├── cache.js           # In-memory TTL cache
│   └── datamatcher.js     # JWT + paginated doctor fetch
├── public/                # Static frontend
├── scripts/test-api.js    # Connection smoke test
├── .env.example
├── railway.toml
└── Procfile
```

## Notes

- The city filter is fixed to **Wien** on the server; clients cannot query other cities.
- API keys and JWTs never leave the backend.
- Do not commit a real `.env` file.
