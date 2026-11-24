# NeoTarget

Doctor-targeting web app focused on Zusatzfach **Neonatologie und pädriatrische Intensivmedizin**, adapted from the Vienna Target / Vienna Doctor Explorer approach.

- Backend: Node.js + Express (password gate, DataMatcherAPI JWT auth, in-memory cache, pagination)
- Frontend: HTML / CSS / Vanilla JS + Chart.js
- Login: simple shared password (`APP_PASSWORD`) with HttpOnly session cookie
- No database

## Product focus

- **Default UX:** Zusatzfach `Neonatologie und pädriatrische Intensivmedizin` is pre-selected
- **Not exclusive:** Server loads doctors for `SEARCH_COUNTRY` (default `Austria`); users can clear/expand Zusatzfach and browse other specializations
- **Geography:** City is a client-side multi-select filter (not locked to Wien)
- **Login hero:** Full DataDominance “Know Your Client” artwork
- **Post-login hero:** Shorter simplified banner derived from the same source

## Features

- Server-side login password check (password never shipped to the client bundle as a constant for comparison)
- DataMatcherAPI: `X-API-Key` → JWT, auto-refresh on 401
- Paginated upstream fetch (`take` ≤ 500), EVOID dedupe, 15‑minute cache
- Stats: total, focus-Zusatzfach count, cities in current filter, filtered hit count
- Top-10 cities chart for current results
- Filters: name, EVOID, city, main specialization, additional specialization (+ PLZ/Geschlecht if present)
- Sortable paginated table (25 / 50 / 100)
- `/health`, rate-limited `/api/doctors` and `/api/login`

## Setup

```bash
cp .env.example .env
# Set APP_PASSWORD, SESSION_SECRET, DATAMATCHER_API_URL, DATAMATCHER_API_KEY
npm install
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_PASSWORD` | yes | Shared login password |
| `SESSION_SECRET` | yes (prod) | HMAC secret for session cookies |
| `DATAMATCHER_API_URL` | yes (live data) | Base URL of DataMatcherAPI |
| `DATAMATCHER_API_KEY` | yes (live data) | API key sent as `X-API-Key` |
| `SEARCH_COUNTRY` | no | Default `Austria` |
| `PORT` | no | Default `3000` |
| `CACHE_TTL_MINUTES` | no | Default `15` |
| `API_TIMEOUT_MS` | no | Default `30000` |

## Run locally

```bash
npm start
# open http://localhost:3000/login
```

```bash
npm run dev
```

## Tests

```bash
# Upstream API (needs DATAMATCHER_API_URL + DATAMATCHER_API_KEY)
npm run test:api

# Local smoke against a running server (login gate, heroes, authz)
# Tip: USE_MOCK_DATA=1 serves fixture doctors when the API URL is missing
npm start &
npm run test:smoke
```

## Railway

1. Deploy from this repository / branch.
2. Set `APP_PASSWORD`, `SESSION_SECRET`, `DATAMATCHER_API_URL`, `DATAMATCHER_API_KEY`.
3. Health check: `/health`.

## Project layout

```
├── server.js
├── src/
│   ├── auth.js            # Password gate + signed session cookie
│   ├── config.js
│   ├── cache.js
│   └── datamatcher.js
├── public/
│   ├── login.html         # Full DataDominance hero
│   ├── index.html         # App shell + short hero
│   └── assets/
├── scripts/
│   ├── test-api.js
│   └── smoke-local.js
└── .env.example
```

## Notes

- Do not commit `.env` or real API keys / passwords.
- API keys and JWTs never leave the backend.
- This branch is a NeoTarget deliverable adapted inside the ViennaTarget checkout for handoff / rename to a dedicated NeoTarget repo if desired.
