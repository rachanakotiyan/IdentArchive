# IdentArchive

IdentArchive is a mock-first case management frontend for missing and unidentified person records. The repository currently includes the frontend app and supporting project files for local UI development.

## Frontend

Run the frontend from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

The app runs at the local Vite URL shown in the terminal, usually `http://localhost:5173`.

## Project structure

```text
.
├── frontend/
│   ├── src/
│   ├── package.json
│   └── README.md
├── backend/
├── database/
├── docs/
├── README.md
└── package.json
```

## Demo accounts

The frontend includes mock demo accounts for local testing. These are marked as `mock data only, not real credentials`.

- Individual user: `individual@example.com` / `Password123!`
- Officer: `officer@example.com` / `Password123!`
- Admin: `admin@example.com` / `Password123!`

Use them only for the local mock UI experience, not for any live or production service.
