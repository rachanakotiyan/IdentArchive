# IdentArchive: Frontend Brief

Save this file in the repo as `docs/FRONTEND_BRIEF.md`. Every frontend prompt tells the agent to read it first. If a prompt and this brief disagree, ask before guessing.

## 1. Product

IdentArchive is a web system for recording missing-person and unidentified-person cases, linking missing and found records through potential matches, and tracking case progress. Tagline: **"Every detail on record."**

Audiences:
- **Public (individuals):** browse active cases, submit missing/found reports (account required), track a report.
- **Officers (reviewers):** review reports, manage assigned cases, review potential matches.
- **Admins:** everything officers do, plus user and officer management.

Tone: serious, calm, respectful. This is about real people. Plain, direct wording. No jokes, no hype.

## 2. Hard rules (treat as core requirements)

1. **Privacy boundary.** Public pages and public services must never receive or render: reporter name/phone/email, review notes, assigned officer, verification details, or report status for reports that are not yet approved. Only cases with status `open`, `under_review` or `resolved` appear publicly. Unverified reports are never public.
2. **Mock data is isolated.** All fake data lives in `src/mock/`. Pages and components import only from `src/services/`. Services are the single place that can later be swapped for real API calls. Public components must not import anything from `services/staffService`.
3. **No photos anywhere.** Cases show a neutral line icon chosen from `crime_type` (see section 4).
4. **Avoid list.** No auto-playing video, stock-photo hero, heavy gradients, emoji as icons, pop-ups on page load, neon "hacker" look, cartoonish illustrations, or cluttered dashboards.
5. **No fake security.** The mock login is for demo only. Label it clearly in the UI ("Demo mode") and in the README. Never store real credentials.
6. **Confirm numbers before launch.** Emergency numbers shown (112, 1098, 181, 1930) must be re-verified before deployment.

## 3. Stack and conventions

- React + Vite (already scaffolded in `frontend/`), JavaScript, `react-router-dom`.
- Plain CSS with CSS custom properties. No Bootstrap, no Tailwind, no component library. One CSS file per component or feature, tokens in `src/styles/tokens.css`.
- Fonts via `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` (self-hosted, no CDN).
- Icons: `lucide-react` only (line icons).
- Charts: Recharts is acceptable, themed with CSS variables. Keep to two charts.
- Folder layout:
  ```
  src/
    components/{ui,layout,case,staff}/
    pages/{public,auth,report,staff}/
    services/        (authService, publicService, reportService, staffService)
    mock/            (data files + latency helper)
    context/         (AuthContext, ThemeContext, ToastContext)
    hooks/  utils/  styles/
  ```
- Naming: components PascalCase, one component per file. API/mock JSON uses camelCase.
- Every list/table/form handles four states: loading, empty, error, success.

## 4. Design system

**Style:** official and structured, with case-file dossier touches. Restrained: the dossier details are accents, not decoration everywhere.

**Themes:** light and dark, user can switch (toggle in the header). Default follows the system setting; remember the choice in localStorage. Colors are CSS variables only, defined on `:root` for light and overridden for dark (`@media (prefers-color-scheme: dark)` plus `[data-theme]` overrides so the toggle wins both ways).

| Token | Dark (Night Desk) | Light |
|---|---|---|
| `--bg` | `#0F1419` | `#EEF1F4` |
| `--surface` | `#1B232C` | `#FFFFFF` |
| `--surface-2` | `#232D38` | `#F5F7F9` |
| `--line` | `#2E3A47` | `#D3DAE1` |
| `--ink` | `#E7E3D8` | `#0F1419` |
| `--muted` | `#9AA6B2` | `#5B6977` |
| `--accent` | `#5AA2E8` | `#2B6FB8` |
| `--danger` | `#E0524D` | `#C23B36` |
| `--success` | `#4FB286` | `#2E8B67` |
| `--warning` | `#E0A63A` | `#B9791A` |

Check text contrast in both themes; adjust a value if body text or stamps fall below readable contrast.

**Type:** IBM Plex Sans for text. IBM Plex Mono for case numbers, reference numbers, IDs, stamps and small labels. Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36. Body 16px (14px in dense tables). Headings use `text-wrap: balance`.

**Shape and spacing:** radius 6px on controls and cards, 4px on small tags. Spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48. Public pages max width 1200px, centred, 16px minimum side gutter.

**Dossier motifs (use these, consistently):**
- File-tab heading: section titles on case detail and staff panels sit on a small tab shape.
- Mono case numbers and reference numbers everywhere (`IA-2026-0001`, `REF-20260920-001`).
- Stamp-style status badges: uppercase, Plex Mono, bordered, square-ish, semantic color. Not rotated in tables or lists.
- `InternalPanel`: any staff-only block is wrapped in a panel labelled "INTERNAL ONLY" with a lock icon and a dashed border. Never reuse this for public content.

**Buttons:** square-ish (6px), solid primary, outline secondary, text-style tertiary. Visible keyboard focus (2px outline, offset 2px) on every interactive element.

**Status stamps:**
- Case: `open` OPEN, `under_review` UNDER REVIEW, `resolved` RESOLVED, `closed` CLOSED.
- Report: `submitted` RECEIVED, `under_review` UNDER REVIEW, `info_requested` INFO NEEDED, `approved` APPROVED, `rejected` REJECTED, `closed` CLOSED.
- Match: `pending` PENDING, `confirmed` CONFIRMED, `dismissed` DISMISSED.
- Priority: `low` / `normal` / `high` / `urgent`.

**Case icons:** one file `src/utils/caseIcons.js` maps `crimeType` to a lucide icon. Provide a mapping for `missing_person`, `unidentified_person`, plus at least four more plausible types (for example `abduction`, `runaway`, `trafficking`, `other`), and a generic folder/file icon as fallback for unknown values. Use one `CaseIcon` component everywhere (small on cards, large in the dossier header).

**Feedback components:** toast (success/info/error, auto-dismiss, stacked), top-of-page banner (for system notices), modal (only for destructive actions: reject, close case, dismiss match), inline field errors, skeleton loaders, empty states with a clear next action.

## 5. Layout and navigation

**Public layout** (`PublicLayout`):
- Two-tier header. Top utility bar: emergency helpline (112), theme toggle. Main bar: slim, sticky, logo top-left, horizontal links: Home, Browse Cases, Report, Track Report, Safety & FAQ; right side: Log in / Register, or the account menu when logged in.
- Mobile: main links collapse into a menu button with a drawer.
- Footer: full (About, How it works, Safety & FAQ, Emergency contacts, Privacy note, Staff login link) with an **emergency helpline strip** above it listing 112, 1098 (child helpline), 181 (women helpline), 1930 (cybercrime).

**Welcome page** (`/`): the very first page for logged-out visitors. Logo **centred** with the tagline, a short introduction to what IdentArchive is (three short points), and three actions: "Enter IdentArchive" (goes to `/home`), "Log in", "Register". Logged-in users skip it and go to `/home`. This is the only page with a centred logo.

**Logo:** monogram badge "IA" in a shield or file-folder shape, as an inline SVG component `Logo` (props for size and whether to show the wordmark "IdentArchive"). It must work in both themes (use `currentColor` and tokens).

**Staff layout** (`StaffLayout`), under `/staff/*`, visually distinct from the public site: denser, darker-leaning surfaces, slim top bar with a visible "STAFF" marker, notifications bell, theme toggle and account menu. Left sidebar, collapsible to an icon rail (remember the state). Tablet defaults to the rail. Mobile: sidebar becomes a drawer, tables become stacked cards.

## 6. Routes and roles

Public: `/` welcome, `/home`, `/cases`, `/cases/:caseId`, `/report/new` (wizard; account required, redirect to login and return), `/report/confirmation/:referenceNo`, `/track`, `/safety` (safety tips, FAQ, emergency contacts), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `*` not found.

Staff (`officer` or `admin`): `/staff` dashboard, `/staff/reports`, `/staff/reports/:reportId`, `/staff/cases`, `/staff/cases/:caseId` (tabs), `/staff/matches`, `/staff/matches/:matchId`.
Admin only: `/staff/admin/users`, `/staff/admin/officers`.

Guards: logged-out users hitting a protected route go to `/login` and return after. Wrong role shows a clear "No access" page (not a blank screen). Officers see only reports and cases assigned to them or unassigned; admins see all (enforce in the mock services so the UI behaves like the real thing will).

## 7. Mock data and service contract

Mock files in `src/mock/` simulate the database. Every service function is `async`, waits 300 to 700 ms, and can be forced to fail through a single `mockConfig.simulateErrors` flag so error states can be demoed. All JSON is camelCase.

**Public case (from the public views; never more fields than this):**
```
{ caseId, caseNumber, title, crimeType, caseStatus, kind: 'missing'|'found',
  personName|null, age|estimatedAge|null, gender, date (lastSeenDate|foundDate),
  shortDescription, city, district, state }
```
Case detail adds: `description`, `physicalFeatures`, `identifyingMarks`, `heightCm`, `updates` (public timeline of status changes with dates only, no notes).

**Report (reporter's own view and staff view differ):**
```
{ reportId, referenceNo, reportType: 'missing'|'found', status, priority, createdDate,
  dateReported, description, person: { name, age, gender, heightCm, physicalFeatures,
  identifyingMarks, date }, location: { address, pincode, city, district, state } }
```
Staff view adds: `reporter { name, phone, email }`, `assignedOfficer { officerId, name }`, `caseId|null`, `reviewNote|null`, `history[]`.

**Match:** `{ matchId, similarityScore, status, missing: {...}, found: {...}, verifications: [{ officerName, decision, remarks, verificationDate }] }`.

**Services (names are the contract; add more only if needed):**
- `publicService`: `listCases(filters, page, pageSize)`, `getCase(caseId)`, `getPublicStats()`, `getPinInfo(pincode)`.
- `reportService`: `submitReport(payload) -> { referenceNo }`, `trackReport({ referenceNo, email })`, `listMyReports()`.
- `authService`: `login`, `register`, `logout`, `getCurrentUser`, `requestPasswordReset`, `resetPassword`, `verifyEmail`.
- `staffService`: `getDashboard()`, `listReports(filters, page, pageSize)`, `getReport(id)`, `decideReport(id, { action, note })` (actions: approve, reject, requestInfo), `assignOfficer(id, officerId)`, `setPriority(id, priority)`, `listCases(...)`, `getCaseDetail(id)`, `closeCase(id, note)`, `listMatches(filters)`, `getMatch(id)`, `reviewMatch(id, { decision, remarks })`, `listOfficers()`, `listUsers()` (admin).

**Seed volume:** about 12 public cases (mix of missing and found, several crime types, spread across at least four cities), 10 reports across every report status, 4 officers, 5 matches (pending, confirmed, dismissed), verification history on two of them, and 3 mock accounts (individual, officer, admin) shown in a small "Demo accounts" box on the login page.

**Tracking privacy:** `/track` needs the reference number **and** the email used on the report. It shows only a simplified public status and dates. It never shows `reviewNote`. For "info needed", show a generic message ("An officer needs more information. Check your email or contact the helpline.").

## 8. Page specifications

**Home (`/home`):** search-first hero (headline "A clearer way to report and track cases.", a large search box for name, case number or place) combined with a live stats strip (active cases, resolved cases, reports this week). Primary CTA "Report a missing person", secondary "Search active cases". Then: How it works, Safety tips, Resolved-case stories, Emergency contacts, FAQ (accordion). No stock photos.

**Browse (`/cases`):** Missing / Found switch, search bar plus an Advanced panel (status, gender, age range, date range), active filters shown as removable chips, grid/list toggle, compact respectful cards (case icon, name or title, status stamp, one-to-two-line description, last seen or found place), sort, numbered pagination. Mobile: one column, or two small cards per row where text stays readable. Empty state: "No cases match these filters" with a clear-filters action.

**Case detail (`/cases/:caseId`):** single-column dossier. File-tab header with the large icon, mono case number and status stamp, then key facts, description, physical features, identifying marks, last seen or found place and date, public update timeline, and a "Have information? Contact the helpline" block (no personal contact details of anyone).

**Report wizard (`/report/new`):** progress bar and five steps: Who is reporting (prefilled from the account), Who is missing / who was found, Where and when (address, pincode auto-fills city/district/state from the mock lookup), Description, Review. Validation inline as the user types, with clear messages. Review page shows every answer with an Edit link per section. Draft kept in sessionStorage so a refresh does not lose it. Missing-versus-found is chosen by a query parameter (`?type=found`) and changes the labels.

**Confirmation:** success message, reference number in large mono type with a copy button, "A copy has been sent to your email" (mock), what happens next, and a printable acknowledgement (print stylesheet, button calls `window.print()`).

**Auth:** login (centred card on a plain background), register, forgot password, reset password, verify email. Clear errors, show/hide password, loading state on submit.

**Safety page:** safety tips, FAQ accordion, emergency contacts table. Content must read as real guidance for families and the public.

**Staff dashboard:** "Needs my action" queue first (reports awaiting review, info-requested replies, unassigned reports, pending matches), each row with a direct action. Then summary stats, then two charts: cases by status, reports over time. Officer sees their own queue; admin sees the whole system.

**Report review (`/staff/reports/:id`):** full report detail, reporter details in an InternalPanel, actions: Approve (creates a case in the mock), Reject with a reason (modal, reason required), Request more information (note), Assign officer, Escalate priority. Toast on success, never a silent change.

**Case management:** table (comfortable rows, numbered pagination with page-size selector) and a case detail with tabs: Overview, Matches, Verification history, Internal notes. Close case uses a confirmation modal.

**Match review:** side-by-side missing and found comparison with similarity score and field-by-field highlighting of agreements and differences, actions Confirm or Dismiss (dismiss uses a modal, remarks required), and the verification history below.

**Admin tabs:** Users and Officers lists (read-only is enough in Phase 1).

## 9. Responsive and quality bar

- Desktop: centred, max width about 1200px. Tablet: two-column grids, staff sidebar as an icon rail. Mobile: fully responsive including staff (tables become cards, forms single column, 44px minimum tap targets).
- No horizontal page scroll at any width. Test at 360, 768 and 1280px.
- Both themes verified on every page.
- Keyboard: every control reachable and visibly focused; labels linked to inputs; modals trap focus and close with Escape.
- Every page sets a meaningful document title.
- `npm run lint` and `npm run build` pass with no warnings you can fix.

## 10. Out of scope for Phase 1

Real authentication, real API calls, MySQL, real email, real image upload, multi-language, evidence/file attachments.