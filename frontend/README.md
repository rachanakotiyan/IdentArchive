# IdentArchive Frontend

This is the React frontend for IdentArchive, built with Vite and React Router.

## Running the Application

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal, typically `http://localhost:5173`.

## Project Structure

```text
frontend/
  src/
    components/
    context/
    hooks/
    pages/
    services/
    styles/
    utils/
    App.jsx
    main.jsx
    index.css
  test/
  package.json
  README.md
```

## Features & Navigation

1. **Public Portal**: Browse public case listings, search by filters, view case updates, track submitted reports, and review safety guidance.
2. **Account Management**: User registration, login, and profile tracking.
3. **Report Submission**: Step-by-step reporting workflow with pincode-based location lookup.
4. **Staff Operations**: Scoped dashboard, reports queue, active case dossiers, candidate match verification, and administrative roster management.
5. **Role-Based Access Control**: Route guards restrict individual users from staff areas and prevent officers from accessing admin consoles.

## API Client & Backend Integration

The frontend uses an API client at `src/services/apiClient.js` built around native `fetch`, connecting directly to the IdentArchive Express backend.

### Configuration (`VITE_API_BASE_URL`)

The backend base URL is configured via environment variables:

- Variable: `VITE_API_BASE_URL`
- Default fallback (local development): `http://localhost:3000/api`
- Configuration file: `frontend/.env` (see `frontend/.env.example`)

> [!CAUTION]
> **Security Notice**: Variables prefixed with `VITE_` are bundled into browser-accessible JavaScript. Never place backend secrets or sensitive keys in frontend environment files.

### Key Features & Design Principles

1. **Automatic Content-Type & Serialization**: Objects passed as `body` are automatically serialized as `application/json`.
2. **Structured Backend Errors**: Error responses conforming to `{ success: false, error: { code, message, details } }` are wrapped in `ApiError` instances exposing `status`, `code`, `message`, and `details`.
3. **HTTP 401 vs 403 Handling**:
   - HTTP 401 (Unauthorized) triggers automatic session clearing and redirection to `/login`.
   - HTTP 403 (Forbidden) surfaces access denial without clearing authentication state.
4. **Token Management**: JWT tokens are securely stored in session storage (`ia-token`) and automatically attached to authenticated requests as Bearer headers.
5. **No Credential Logging**: Sensitive inputs and passwords are never logged to the browser console.

## Running Tests and Linting

```powershell
cd frontend
npm run lint    # Run oxlint
npm test        # Run Node.js test runner
npm run build   # Production build
```
