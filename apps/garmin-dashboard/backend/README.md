# Garmin Fitness Dashboard — Python Backend

A local backend that authenticates with your Garmin Connect account and exposes your fitness data as a REST API.

## Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure credentials
cp .env.example .env
# Edit .env with your Garmin email and password
```

## Run

```bash
python server.py
```

The server starts on `http://localhost:5000`. The React dev server (Vite) is configured to proxy `/api/*` requests to this backend automatically.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/profile` | Your Garmin profile (name, ID) |
| `GET /api/activities?start=0&limit=50` | Paginated activities |
| `GET /api/activities/:id` | Activity detail (HR zones, GPS, splits) |
| `GET /api/daily-summary?startDate=2024-01-01&endDate=2024-01-07` | Daily health metrics |
| `GET /api/personal-records` | Personal records |
| `GET /api/training-status` | VO2 max, training load, recovery |

## Session Persistence

The server saves your Garmin session to `.garmin_session/` so you don't need to re-authenticate on every restart. If the session expires, restart the server and it will re-login.

## Security Notes

- **Never commit `.env`** — it contains your password
- The `.garmin_session/` directory is gitignored
- This is for personal/local use only
