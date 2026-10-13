# IdentArchive

IdentArchive is a planned system for managing missing and unidentified person records. This repository currently contains only the initial frontend and backend scaffolding; application features, API endpoints, and database tables will be added step by step.

## Project structure

- `frontend/` - React application built with Vite.
- `backend/` - Express server and the future REST API.
- `database/scripts/` - Reserved for future MySQL setup and migration scripts.
- `docs/` - Reserved for project documentation.

The backend will keep HTTP routes, business logic, and database access in separate layers as those features are introduced.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MySQL will be needed when database integration is implemented.

## Setup

Install frontend dependencies:

```powershell
Set-Location frontend
npm install
```

In one terminal, start the frontend development server:

```powershell
Set-Location frontend
npm run dev
```

In a second terminal, install backend dependencies:

```powershell
Set-Location backend
npm install
```

Then start the backend in development mode:

```powershell
Set-Location backend
npm run dev
```

The frontend runs on Vite's displayed local URL (usually `http://localhost:5173`). The backend listens on port `3000` by default. Set `PORT` in `backend/.env` to choose a different backend port; use `backend/.env.example` as a reference and never put real secrets in version control.

There are no API endpoints or database tables yet. The backend currently only starts an Express server.
