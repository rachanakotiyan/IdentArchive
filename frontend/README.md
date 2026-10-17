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