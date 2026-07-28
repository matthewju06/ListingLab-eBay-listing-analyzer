# ListingLab eBay Listing Analyzer

Search, filter, and analyze eBay listings with statistical price-range detection, interactive charts, and CSV export.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Angular 22, Apache ECharts, AG Grid, SCSS |
| Backend | FastAPI, Pydantic, Uvicorn |
| API | eBay Browse API (OAuth client credentials) |

## Project Structure

```
├── backend/
│   ├── alembic/              # DB migrations
│   ├── app/
│   │   ├── api/routes/       # HTTP route handlers
│   │   ├── clients/          # External API clients (eBay)
│   │   ├── db/               # SQLAlchemy engine + ORM models
│   │   ├── models/           # Pydantic request/response schemas
│   │   ├── services/         # Business logic (search, price analysis)
│   │   ├── config.py         # Settings via pydantic-settings
│   │   └── main.py           # FastAPI app entry point
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   └── src/app/
│       ├── core/             # Constants, models, utilities
│       ├── pages/            # Home, search analyzer, saved, tracking
│       └── services/         # Search, history, chart services
└── docker-compose.yml
```

## App Routes

| Path | Page |
|------|------|
| `/` | Home — brand + search entry |
| `/search?q=...` | Analyzer workspace (charts + table); query params hold search state |
| `/saved` | Saved searches (placeholder) |
| `/tracking` | Price tracking (placeholder) |

## Run Locally

### Prerequisites

- Python 3.10+
- Node.js 20+
- eBay API credentials (Client ID + Client Secret)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # Add CLIENT_ID, CLIENT_SECRET, DATABASE_URL
uvicorn app.main:app --reload --port 8000

# Apply DB migrations (Neon Postgres)
alembic upgrade head
```

### Frontend

```bash
cd frontend
npm install
npm start                   # http://localhost:4200 (proxies /api to :8000)
```

### Docker Compose

```bash
cp backend/.env.example backend/.env   # Add credentials
docker compose up
```

Frontend: http://localhost:4200 · API: http://localhost:8000 · Docs: http://localhost:8000/docs

## API

### `GET /api/search`

**Query parameters**

| Param | Example | Notes |
|-------|---------|-------|
| `query` | `pokemon` | Required |
| `minPrice` | `0` | Optional; empty for auto mode |
| `maxPrice` | `200` | Optional; empty triggers auto price range |
| `category` | `220` | Optional eBay category ID |
| `condition` | `new` | Optional: `new` or `used` |
| `filterStrength` | `4` | Auto mode strength: `3` strict, `4` normal, `6` loose |

Example:

```
GET /api/search?query=pokemon&minPrice=&maxPrice=&category=220&condition=new&filterStrength=4
```

**Response**
```json
{
  "itemSummaries": [
    {
      "title": "...",
      "price": "12.99",
      "condition": "New",
      "itemWebUrl": "...",
      "username": "...",
      "feedbackPercentage": "99.5",
      "categoryName": "...",
      "imageUrl": "...",
      "itemCreationDate": "..."
    }
  ]
}
```

### Persistence (Neon Postgres)

Scoped by `user_id` (today: `X-User-Id` header or `DEV_USER_ID`; later: Clerk JWT).

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/saved-searches` | List / create saved searches |
| GET/PATCH/DELETE | `/api/saved-searches/{id}` | Read / update / delete |
| GET/POST | `/api/tracked-listings` | List / create tracked listings |
| GET/PATCH/DELETE | `/api/tracked-listings/{id}` | Read / update / delete |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | eBay API client ID |
| `CLIENT_SECRET` | eBay API client secret |
| `CORS_ORIGINS` | Comma-separated allowed origins (default: `http://localhost:4200`) |
| `DATABASE_URL` | Neon Postgres connection string |
| `DEV_USER_ID` | Fallback user id before Clerk auth (default: `dev-user`) |

## Roadmap (auth)

1. Neon + these tables (current)
2. Wire Saved / Tracking UI to the APIs
3. **Clerk** auth — replace `X-User-Id` with verified JWT `sub`

## License

Source-available (Non-Commercial / No-Redistribution / No-Public-Deployment). See [`LICENSE.md`](LICENSE.md).
