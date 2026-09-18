# Productivity Tracker

An hour-resolution personal productivity tracker with a month-at-a-glance Gantt
timeline. Every day of the selected month is a row; the 24 hours are the
columns; activities are bars placed at their exact start and end minute.

There are two pages: a landing page at `/` describing what the app does, and
the tracker itself at `/tracker`, which requires a signed-in account.

## Project Overview

The problem it solves: knowing where your hours actually went, at a resolution
fine enough to be honest about it.

**Major capabilities**

- **Month view, day rows, hour columns.** Pick a month from the calendar; each
  day of that month becomes a row and the 24 hours run across as columns.
- **Two-minute grid, minute-exact bars.** Each hour is divided into 30 cells of
  2 minutes. The grid is a visual and snapping reference only — an activity
  starting at 03:53 is stored and drawn at 03:53, not rounded to a cell.
- **Expandable bars.** A bar with sub-activities expands to show them as
  sub-bars on the same time axis, so you can see what you were doing at a
  particular moment inside a larger block.
- **Full CRUD.** Add, edit and delete activities and sub-activities. Click any
  empty grid slot to start a new entry pre-filled at that time.
- **Sticky two-axis scrolling.** Scroll down and the hour header stays put;
  scroll right and the day panel stays put.
- **A real mobile view.** On phones the timeline turns vertical: one day at a
  time with hours running down the screen, swiping between days.
- **Overlaps and overnight work.** Overlapping activities stack into lanes and
  the row grows to fit. An activity crossing midnight renders on both day rows,
  clipped at midnight with a continuation edge.
- **Monthly summary.** Total tracked time, days covered, average per active day,
  and the split by category.
- **Zoom.** 120 / 240 / 480 px per hour, plus a 24h / 12h clock toggle.
- **Per-account data.** Sign in with Google; your activities and your category
  palette belong to your account and are not visible to any other.

## Architecture Overview

```
Browser ──► React + Vite frontend (port 5173)
   │            │  /api proxied in dev
   │            ▼
   │        FastAPI backend (port 8000)
   │            │  SQLAlchemy 2.0
   │            ▼
   │        Postgres (Docker) or SQLite (local)
   │
   └──► Google Identity Services (ID token only)
```

- **frontend** — React 19 + TypeScript renders the timeline. All time-to-pixel
  maths lives in one module (`src/lib/timeline-geometry.ts`); day splitting and
  lane packing live in `src/lib/timeline-layout.ts`. Both are pure functions.
- **backend** — FastAPI exposes a small REST API. Business rules (interval
  validity, sub-activity containment) live in `app/services/`, separate from the
  routers.
- **database** — four tables: `users`, `categories`, `activities`,
  `sub_activities`. Activities and categories are owned by a user.
- **auth** — the browser gets a Google ID token, the backend verifies it
  against Google's public keys and issues its own session JWT in an httpOnly
  cookie. No Google token is stored and no client secret is used.

See [ARCHITECTURE.md](ARCHITECTURE.md) for details and diagrams.

## Technology Stack

| Layer    | Technology                                                            |
| -------- | --------------------------------------------------------------------- |
| Frontend | React 19, TypeScript (strict, no `any`), Vite, Tailwind CSS v4, Radix UI, TanStack Query, React Router |
| Backend  | Python 3.13+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn, google-auth, PyJWT |
| Design   | Petrona + Hanken Grotesk (self-hosted via `@fontsource`)               |
| Auth     | Google Identity Services (ID-token flow) + httpOnly session cookie     |
| Database | Postgres 17 (Docker) · SQLite (local development)                     |
| Tooling  | Prettier, pytest, Docker Compose                                      |

## Prerequisites

Pick whichever matches your machine:

**Option A — no Docker (what this project was developed against)**

- Node.js 20+ and npm
- Python 3.12+ (3.14 verified)

**Option B — Docker**

- Docker Desktop (provides Python and Postgres; nothing else needed locally)

## Setup

Copy the backend environment template and adjust if needed:

```bash
cp backend/.env.example backend/.env
```

The default `DATABASE_URL` points at a local SQLite file, so the API runs with
no external services. Switch the commented Postgres line in when you want it.

### Google sign-in (optional for local work)

`AUTH_DEV_BYPASS=1` is on by default, so the app runs immediately as a fixed
local account and you can defer this. The tracker shows a banner in the account
menu whenever the bypass is active, so it is never mistaken for a real sign-in.

To enable real sign-in:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth 2.0 Client ID** of type **Web application**.
2. Add `http://localhost:5173` under *Authorised JavaScript origins*. No
   redirect URI is needed — this is the ID-token flow, not the redirect flow.
3. Put the client ID in `backend/.env` as `GOOGLE_CLIENT_ID`, and set
   `AUTH_DEV_BYPASS=0`.
4. Set a real `SESSION_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The client **secret** is not used by this flow and should not be added anywhere.
The client **ID** is public by design and is served to the browser.

### Upgrading a database created before accounts existed

`create_all` adds missing tables but never alters existing ones, so a database
from before the accounts change needs a one-off migration:

```bash
backend/.venv/Scripts/python.exe backend/scripts/migrate_add_accounts.py
```

Then sign in once and claim the pre-existing rows for your account:

```bash
backend/.venv/Scripts/python.exe backend/scripts/claim_legacy_activities.py you@example.com
```

Both scripts are idempotent. Back up the `.db` file first regardless.

## Running the Project

### Option A — locally, without Docker

One-time backend setup:

```bash
python -m venv backend/.venv
```

```bash
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
```

> On macOS/Linux use `backend/.venv/bin/python` instead of
> `backend/.venv/Scripts/python.exe`.

Start the API (terminal 1):

```bash
cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Start the frontend (terminal 2):

```bash
npm --prefix frontend install
```

```bash
npm --prefix frontend run dev
```

Open <http://localhost:5173>. Tables are created and the default categories are
seeded automatically on first start.

Optionally load a month of realistic sample data (with the API running):

```bash
backend/.venv/Scripts/python.exe backend/scripts/load_sample_data.py 2026-09
```

### Option B — Docker

```bash
docker compose up --build
```

Frontend on <http://localhost:5173>, API on <http://localhost:8000>, Postgres on
`localhost:5432`.

## Design

The interface follows one committed direction — **Warm Workspace**. The feeling
to leave is a well-made paper planner: calm, tactile, inviting.

- **Type.** Petrona (soft serif) for display, Hanken Grotesk for body and for
  numerals. Numerals use tabular figures so a column of times aligns
  digit-for-digit down 31 day rows.
- **Colour.** Sand ground, warm ink, and clay as the single interactive accent.
  Red is reserved for functional status (the now-line, destructive actions).
  Clay is never used for a category, so an accent never reads as data.
- **Surfaces.** Rounded 12–22px cards lifted on two-layer soft shadows; depth
  carries hierarchy and borders are a quiet secondary.
- **Texture.** A faint fixed paper grain over the page, so large areas of sand
  read as a material rather than a colour fill.
- **Motion.** Slow and eased. Surfaces settle in, bars grow in. Nothing
  animates on scroll.

Design tokens live in `frontend/src/index.css`. Use the `.display`,
`.display-italic`, `.readout` and `.label-soft` classes rather than
re-specifying type per component, and the `shadow-lift-1/2/3` utilities rather
than ad-hoc shadows.

### Responsive behaviour

A 24-hour by 31-day grid cannot be read on a phone, so below Tailwind's `md`
breakpoint the timeline **rotates**: hours run top-to-bottom for a single day
and you swipe left or right between days. It uses the same geometry module as
the month grid, applied to the vertical axis, so a 03:53 start is exactly as
precise.

The switch happens in `useIsMobile()` (`src/hooks/use-media-query.ts`), which
reads the match synchronously on first render so a phone never paints the
desktop tree for a frame.

## Development

- Frontend source lives in `frontend/src`; the `@/` import alias maps to it.
- Keep all time arithmetic in `src/lib/timeline-geometry.ts`. Deriving pixel
  offsets anywhere else is how a timeline drifts out of alignment.
- Backend business rules belong in `app/services/`, not in routers. Routers
  should only translate HTTP to a service call.
- Both layers validate independently; never rely on the frontend's checks.

Useful commands:

```bash
npm --prefix frontend run format
```

```bash
npm --prefix frontend run typecheck
```

## API

Interactive docs while the backend runs: <http://localhost:8000/docs>.

| Method   | Path                                     | Purpose                                     |
| -------- | ---------------------------------------- | ------------------------------------------- |
| `GET`    | `/health`                                | Liveness check                              |
| `GET`    | `/api/auth/session`                      | Current session; never errors when signed out |
| `POST`   | `/api/auth/google`                       | Exchange a Google ID token for a session cookie |
| `POST`   | `/api/auth/logout`                       | Clear the session cookie                    |
| `GET`    | `/api/categories`                        | List categories                             |
| `POST`   | `/api/categories`                        | Create a category                           |
| `PATCH`  | `/api/categories/{id}`                   | Rename or recolour a category               |
| `DELETE` | `/api/categories/{id}`                   | Delete a custom category (built-ins are protected) |
| `GET`    | `/api/activities?month=YYYY-MM`          | Activities overlapping a month, sub-activities nested |
| `GET`    | `/api/activities/{id}`                   | One activity                                |
| `POST`   | `/api/activities`                        | Create, optionally with sub-activities      |
| `PATCH`  | `/api/activities/{id}`                   | Partial update                              |
| `DELETE` | `/api/activities/{id}`                   | Delete (sub-activities cascade)             |
| `POST`   | `/api/activities/{id}/sub-activities`    | Add a sub-activity                          |
| `PATCH`  | `/api/sub-activities/{id}`               | Update a sub-activity                       |
| `DELETE` | `/api/sub-activities/{id}`               | Delete a sub-activity                       |
| `GET`    | `/api/stats/month?month=YYYY-MM`         | Monthly totals per day and per category     |

Every route except `/health` and `/api/auth/*` requires a session and is scoped
to the signed-in account. A request for another account's activity returns
`404`, not `403`: a distinct status would confirm the id exists.

**Timestamps** are naive local wall-clock ISO strings without an offset
(`"2026-09-18T03:53:00"`). Seconds are truncated to the minute. See
[ARCHITECTURE.md](ARCHITECTURE.md#time-handling) for why.

**Errors** always use the same envelope:

```json
{ "detail": [{ "field": "end_at", "message": "end_at must be later than start_at" }] }
```

Status codes: `401` no/expired session, `422` validation, `404` missing or
not-yours, `409` conflict.

## Testing

```bash
cd backend && .venv/Scripts/python.exe -m pytest
```

70 tests cover CRUD, the interval rules, sub-activity containment, month
filtering, overnight splitting, monthly aggregation, session tokens, and
cross-account isolation (one account cannot read, edit or delete another's
activities, sub-activities or categories).

## Build

```bash
npm --prefix frontend run build
```

Emits a static bundle to `frontend/dist`. The backend needs no build step; run
it under Uvicorn (or Gunicorn with Uvicorn workers) in production.

## Environment Variables

Backend (`backend/.env`, template in `backend/.env.example`):

| Variable       | Default                                | Purpose                                     |
| -------------- | -------------------------------------- | ------------------------------------------- |
| `DATABASE_URL` | `sqlite:///./productivity_tracker.db`  | SQLAlchemy URL. Use `postgresql+psycopg://…` for Postgres |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins      |
| `SQL_ECHO`     | `0`                                    | Set to `1` to log SQL statements            |
| `GOOGLE_CLIENT_ID` | *(empty)*                          | Public OAuth client ID; empty disables Google sign-in |
| `SESSION_SECRET`   | dev placeholder                    | HS256 key for the session cookie. **Override in any deployment** |
| `SESSION_TTL_HOURS`| `336`                              | Session lifetime (14 days)                  |
| `SESSION_COOKIE_SECURE` | `0`                           | Set to `1` when served over HTTPS           |
| `AUTH_DEV_BYPASS`  | `1`                                | Treat unauthenticated requests as a local account. **Must be `0` in a deployment** |

Frontend (optional, `frontend/.env.local`):

| Variable                 | Default                 | Purpose                                     |
| ------------------------ | ----------------------- | ------------------------------------------- |
| `VITE_API_BASE_URL`      | `/api`                  | Call the API directly instead of via the dev proxy |
| `VITE_API_PROXY_TARGET`  | `http://127.0.0.1:8000` | Where the dev server proxies `/api`         |

Docker Compose also reads `POSTGRES_USER`, `POSTGRES_PASSWORD` and
`POSTGRES_DB` (all default to `tracker` / `tracker` / `productivity_tracker`).
Override them for anything beyond local use. No secrets are committed.
