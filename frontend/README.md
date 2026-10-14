# IdentArchive Frontend

This is the React frontend for IdentArchive. It is a mock-first demo application and does not use real authentication or production data.

## Run the frontend

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

## Project structure

```text
frontend/
  src/
    components/
    context/
    mock/
    pages/
    services/
    styles/
    utils/
    App.jsx
    main.jsx
    index.css
  package.json
  README.md
```

## Demo accounts

The login page includes mock demo accounts for testing the UI. These credentials are for the frontend demo only and are marked as `mock data only, not real credentials`.

- Individual user: `individual@example.com` / `Password123!`
- Officer: `officer@example.com` / `Password123!`
- Admin: `admin@example.com` / `Password123!`

Use these only for local mock testing, not for any real service or production environment.
