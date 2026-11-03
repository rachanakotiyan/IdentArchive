# IdentArchive

IdentArchive is a case management platform for missing and unidentified person records. The repository includes the full-stack system: React frontend, Express/Node.js backend, and MySQL database migrations.

## Getting Started

### Prerequisites

- Node.js (v18+)
- MySQL (v8.0+)

### Backend Setup

```powershell
cd backend
npm install
npm run migrate
npm run dev
```

The backend server runs on `http://localhost:3000` by default. See `docs/API.md` for endpoint documentation.

### Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

The application runs at the local Vite URL shown in the terminal, typically `http://localhost:5173`.

### Environment Configuration

The frontend connects to the backend API using `VITE_API_BASE_URL`:

- Variable: `VITE_API_BASE_URL`
- Default fallback (development): `http://localhost:3000/api`
- File: `frontend/.env` (see `frontend/.env.example`)

## Repository Structure

```text
.
├── frontend/        # React + Vite client application
├── backend/         # Express REST API server
├── database/        # MySQL migrations and seed scripts
├── docs/            # System and API documentation
└── package.json     # Workspace management
```

## Testing and Verification

- Frontend unit tests: `npm --prefix frontend test`
- Frontend linting: `npm --prefix frontend run lint`
- Frontend build: `npm --prefix frontend run build`
- Backend test suite: `npm --prefix backend test`
