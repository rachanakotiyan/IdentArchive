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

- Public user: `priya@demo.test` / `demo1234`
- Officer: `officer@demo.test` / `demo1234`
- Admin: `admin@demo.test` / `demo1234`

Use these only for local mock testing, not for any real service or production environment.

## Quick tour

The app is a mock-first frontend: authentication, reports, and public data are for demonstration, not real-world use.

1. Start the app and open `/`. Browse the public home page, case listings and details, tracking, safety guidance, `/about`, and `/faq`.
2. Open `/login` and choose a demo account with **Use this account**. Try a wrong password first to see the login error.
3. As the public user, submit a report at `/report/new`. The wizard has five steps, saves a draft for the session, and lets you edit answers from Review. To try a found-person report, open `/report/new?type=found`.
4. Submit the report to see its confirmation and reference number. Use **Track this report** or open `/track` and enter the reference and report email. Your submitted reports are also listed at `/my-reports`.
5. Log out from the account menu, then sign in as the officer. Open `/staff` to explore the staff dashboard, reports, cases, matches, and `/staff/settings`. The admin can also open `/staff/admin/users` and `/staff/admin/officers`.
6. Try role restrictions: the public user cannot access `/staff`, and the officer cannot access `/staff/admin/users`; both should see an Access denied page.

You can also try registration at `/register` and the forgot-password, reset-password, and email-verification screens. These are mock flows and do not send real email. Demo report data and wizard drafts are kept in browser session storage.

## API Client & Backend Integration

The frontend includes a reusable API client at `src/services/apiClient.js` built around native `fetch`, designed to integrate with the IdentArchive Express backend while preserving the standalone mock demo UI.

### Configuration (`VITE_API_BASE_URL`)

The backend base URL is configured via Vite environment variables:

- File: `frontend/.env` (see `frontend/.env.example`)
- Variable: `VITE_API_BASE_URL`
- Default fallback (local development): `http://localhost:3000/api`

> [!CAUTION]
> **Security Notice**: Environment variables prefixed with `VITE_` are bundled into browser-accessible JavaScript. Never place backend secrets, private keys, or sensitive credentials in frontend environment files.

### Usage

```javascript
import apiClient, { ApiError } from './services/apiClient.js';

// GET request
try {
  const data = await apiClient.get('/cases');
  console.log(data);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Status: ${error.status}, Code: ${error.code}, Message: ${error.message}`);
  }
}

// POST request with JSON body
const report = await apiClient.post('/reports', {
  category: 'missing',
  fullName: 'John Doe',
});
```

### Key Features & Design Principles

1. **Automatic Content-Type & Serialization**: Objects passed as `body` are automatically serialized with `Content-Type: application/json`. Non-object payloads (e.g. `FormData`, `Blob`, raw text) retain their headers and body without alteration.
2. **Structured Backend Errors**: Backend error responses adhering to `{ success: false, error: { code, message, details } }` are wrapped in `ApiError` instances exposing `error.status`, `error.code`, `error.message`, and `error.details`.
3. **HTTP 401 vs 403 Handling**: 
   - HTTP 401 (Unauthorized) triggers the registered `unauthorizedHandler` callback (e.g. for automatic session clearing or redirection to login).
   - HTTP 403 (Forbidden) throws an `ApiError` but **never** triggers session logout, avoiding disruptive logouts when a user simply lacks permission for a specific resource.
4. **Session & Token Bridge**:
   - `authService.getStoredToken()` and `authService.getStoredSession()` provide the abstraction bridge for real tokens stored under the session key `ia-token`.
   - In demo mock mode, `getStoredToken()` safely returns `null`. Mock user accounts are never transmitted as Bearer tokens.
   - Bearer headers (`Authorization: Bearer <token>`) are attached only when an authentic, non-empty string token is present or explicitly passed in request options.
5. **No Credential Logging**: Passwords, tokens, and sensitive report bodies are never logged to the browser console.

### Running Frontend Tests

Frontend tests run using Node's built-in test runner without additional external test frameworks:

```powershell
cd frontend
npm test
```