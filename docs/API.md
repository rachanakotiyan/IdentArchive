# IdentArchive API Reference

> **Base URL**: `/api`  
> **Content-Type**: `application/json` (all requests and responses)  
> **Authorization**: `Bearer <JWT>` header where required

---

## Response Envelope

All endpoints use a consistent JSON envelope:

```json
// Success
{ "success": true, "message": "...", "data": <payload>, "meta": <pagination?> }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [] } }
```

### Common Error Codes

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid or missing request fields |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 401 | `TOKEN_EXPIRED` | Expired JWT |
| 403 | `FORBIDDEN` | Authenticated but insufficient role/scope |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate or invalid state transition |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds 1 MB |
| 429 | `TOO_MANY_REQUESTS` | Rate limit hit |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |

---

## Rate Limits

| Limiter | Window | Max | Scope | Applies to |
|---------|--------|-----|-------|------------|
| `registerLimiter` | 1 hour | 5 | Per IP | `POST /api/auth/register` |
| `loginLimiter` | 15 min | 10 | Per IP + email | `POST /api/auth/login` |
| `submitReportLimiter` | 1 hour | 10 | Per authenticated user | `POST /api/reports` |
| `trackLimiter` | 15 min | 10 | Per IP | `POST /api/reports/track` |
| `casesLimiter` | 1 min | 120 | Per IP | `GET /api/cases`, `GET /api/cases/:caseNumber`, `GET /api/cases/:caseNumber/updates` |
| `pincodesLimiter` | 1 min | 120 | Per IP | `GET /api/pincodes/:pincode` |

> **Note**: All rate limits are relaxed to 1,000,000 requests/window when `NODE_ENV=test`.

---

## Public Endpoints (No Auth Required)

---

### GET /api/health

Returns application and database health status.

**Response 200**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-11-03T14:00:00.000Z",
    "uptime": 12345.6,
    "database": { "connected": true, "latencyMs": 2 }
  }
}
```

---

### POST /api/auth/register

Register a new individual user account.

**Rate limit**: 5 per hour per IP.

**Request body**
```json
{
  "name": "Full Name",
  "email": "user@example.com",
  "password": "minimum12chars",
  "phone": "9876543210"
}
```

**Response 201**
```json
{
  "success": true,
  "data": { "token": "<JWT>", "user": { "userId": "...", "name": "...", "email": "...", "role": "individual" } }
}
```

**Errors**: `409 CONFLICT` (duplicate email), `400 VALIDATION_ERROR`.

> Role is always `individual`; any `role` field in the body is silently ignored.

---

### POST /api/auth/login

Authenticate with email and password.

**Rate limit**: 10 per 15 minutes per IP + email pair.

**Request body**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Response 200**
```json
{
  "success": true,
  "data": { "token": "<JWT>", "user": { "userId": "...", "name": "...", "email": "...", "role": "..." } }
}
```

**Errors**: `401 UNAUTHORIZED` (wrong credentials – identical error for wrong email or wrong password to prevent enumeration).

---

### GET /api/cases

Search public (non-closed) cases. Closed cases are never returned.

**Rate limit**: 120 per minute per IP.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Full-text search across person_name, case_number, description |
| `kind` | `missing\|found` | Filter by case kind |
| `case_type` | string | Alias for `kind` |
| `gender` | `male\|female\|other\|unknown` | Filter by gender |
| `state` | string | Filter by state |
| `district` | string | Filter by district |
| `age_min` | int | Minimum age (inclusive) |
| `age_max` | int | Maximum age (inclusive) |
| `pincode` | string | Filter by location pincode (via linked reports) |
| `page` | int (≥1) | Page number (default: 1) |
| `limit` | int (1–100) | Results per page (default: 20) |

**Response 200**
```json
{
  "success": true,
  "data": [ { "case_number": "IA-2026-0001", "title": "...", "kind": "missing", ... } ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

> Reporter contact (`reporter_name`, `reporter_email`, `reporter_phone`), `case_id` (UUID), `assigned_officer_id`, and `review_note` are **never** included.

---

### GET /api/cases/:caseNumber

Get a single public case by its human-readable `case_number` (e.g., `IA-2026-0001`).

**Rate limit**: 120 per minute per IP.

**Response 200** – same shape as a single item from `GET /api/cases`.

**Errors**: `404 NOT_FOUND` (not found or closed), `400 VALIDATION_ERROR` (UUID passed instead of case_number).

---

### GET /api/cases/:caseNumber/updates

Get chronological public updates for a case.

**Rate limit**: 120 per minute per IP.

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "case_id": "...", "update_date": "2026-11-01", "note": "Search expanded to neighbouring districts.", "created_at": "..." }
  ]
}
```

**Errors**: `404 NOT_FOUND` (case not found or closed).

---

### POST /api/reports/track

Track a submitted report by reference number + reporter email. Replaces the old `GET` version. Email is never in the URL or access logs.

**Rate limit**: 10 per 15 minutes per IP.

**Request body**
```json
{ "reference_no": "REF-2026-ABCDEF01", "email": "reporter@example.com" }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "reference_no": "REF-2026-ABCDEF01",
    "status": "under_review",
    "report_type": "missing",
    "person_name": "John Doe",
    "created_at": "2026-11-01T10:00:00.000Z",
    "updated_at": "2026-11-03T08:00:00.000Z",
    "history": [ { "event": "Report submitted", "created_at": "..." } ]
  }
}
```

**Errors**: `404 NOT_FOUND` (generic – same body for wrong reference number OR wrong email to prevent enumeration). `review_note` and actor names are **never** returned.

---

### GET /api/pincodes/:pincode

Look up location data for a 6-digit Indian pincode.

**Rate limit**: 120 per minute per IP.

**Response 200**
```json
{ "success": true, "data": { "pincode": "560001", "city": "Bangalore", "district": "Bangalore Urban", "state": "Karnataka" } }
```

**Errors**: `400 VALIDATION_ERROR` (not exactly 6 digits), `404 NOT_FOUND`.

---

### GET /api/public/stats

Aggregate public statistics. Contains no personal data.

**Response 200**
```json
{
  "success": true,
  "data": {
    "activeCases": 120,
    "underReview": 34,
    "resolvedCases": 55,
    "reportsThisWeek": 8
  }
}
```

---

## Authenticated Individual Endpoints

Requires `Authorization: Bearer <JWT>` with role `individual`, `officer`, or `admin`.

---

### POST /api/reports

Submit a new missing/found person report.

**Rate limit**: 10 per hour per authenticated user.

**Request body**
```json
{
  "report_type": "missing",
  "reporter_name": "Jane Smith",
  "reporter_phone": "9876543210",
  "reporter_email": "jane@example.com",
  "person_name": "John Doe",
  "age": 28,
  "gender": "male",
  "event_date": "2026-10-15",
  "description": "Last seen at MG Road bus stop...",
  "location_pincode": "560001",
  "location_address": "10 MG Road, Bangalore"
}
```

> `location_pincode` must exist in the `pincodes` table. `location_city`, `location_district`, and `location_state` are derived from the pincode and **cannot** be overridden by the client.

**Response 201**
```json
{ "success": true, "data": { "report_id": "...", "reference_no": "REF-2026-ABCD1234", "status": "submitted", ... } }
```

**Errors**: `400 VALIDATION_ERROR` (including when pincode does not exist – returns 400, never 500).

---

### GET /api/reports/me

List reports submitted by the authenticated user.

**Response 200**
```json
{
  "success": true,
  "data": [ { "report_id": "...", "reference_no": "...", "status": "submitted", ... } ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## Staff Endpoints

Requires `Authorization: Bearer <JWT>` with role `officer` or `admin`.

**Scoping rule (server-enforced)**: Officers see only reports/cases where the linked report is assigned to them or unassigned. Admins see everything.

---

### GET /api/staff/reports

Paginated list of reports scoped to the caller.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by report status |
| `priority` | `low\|normal\|high\|urgent` | Filter by priority |
| `assigned` | `me\|unassigned` | Officers: restrict further. Admins: can also use officer_id |
| `report_type` | `missing\|found` | Filter by type |
| `q` | string | Search reference_no, person_name, description, city |
| `page` | int | Page number (default: 1) |
| `limit` | int (1–100) | Page size (default: 20) |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "report_id": "...", "reference_no": "...", "report_type": "missing",
      "status": "under_review", "priority": "normal",
      "reporter_name": "...", "reporter_phone": "...", "reporter_email": "...",
      "person_name": "...", "assigned_officer_id": "...", "assigned_officer_name": "...",
      "assigned_officer_badge": "B-001", "review_note": null, ...
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### GET /api/staff/reports/:reportId

Get full report detail including reporter contact, `review_note`, and audit history with actor names.

**Scoping**: Officer can only view a report assigned to them or unassigned.

**Response 200**
```json
{
  "success": true,
  "data": {
    "report_id": "...", "reporter_name": "Priya Sharma",
    "reporter_email": "priya@example.com", "reporter_phone": "9988776655",
    "review_note": "Initial assessment conducted.",
    "history": [
      { "id": 1, "event": "Report submitted", "actor_id": "...", "actor_name": "Priya Sharma", "created_at": "..." },
      { "id": 2, "event": "Report assigned for review", "actor_id": "...", "actor_name": "Officer Alpha", "created_at": "..." }
    ]
  }
}
```

**Errors**: `404 NOT_FOUND`, `403 FORBIDDEN` (officer accessing another officer's report).

---

### PATCH /api/staff/reports/:reportId/priority

Update report priority and log the change in `report_history`.

**Scoping**: Officer can only update priority of reports assigned to them or unassigned.

**Request body**
```json
{ "priority": "urgent" }
```
Valid values: `low`, `normal`, `high`, `urgent`.

**Response 200**
```json
{ "success": true, "data": { "report_id": "...", "priority": "urgent", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`.

---

### POST /api/staff/reports/:reportId/assign

Assign a report to an officer.

- **Officer**: self-assigns the report if it is currently unassigned. Returns `409 CONFLICT` if already assigned.
- **Admin**: assigns any active officer via `{ officer_id }`. Works even if admin has no officer profile.

**Request body** *(admin only)*
```json
{ "officer_id": "<officer_id UUID>" }
```

**Response 200**
```json
{ "success": true, "data": { "report_id": "...", "assigned_officer_id": "...", "status": "under_review", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT` (officer: already assigned).

---

### POST /api/staff/reports/:reportId/info-request

Request additional information from the reporter. Transitions report to `info_requested`.

**Scoping**: Officer can only act on reports assigned to them.

**Request body**
```json
{ "note": "Please provide the last known location with more precision." }
```

**Response 200**
```json
{ "success": true, "data": { "report_id": "...", "status": "info_requested", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`.

---

### POST /api/staff/reports/:reportId/reject

Reject a report. Transitions report to `rejected`.

**Scoping**: Officer can only act on reports assigned to them.

**Request body**
```json
{ "rejection_reason": "Incomplete details provided." }
```

**Response 200**
```json
{ "success": true, "data": { "report_id": "...", "status": "rejected", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`.

---

### POST /api/staff/reports/:reportId/approve

Approve a report and automatically create a linked case. Transitions report to `approved`.

**Scoping**: Officer can only act on reports assigned to them.

**Request body** *(all fields optional)*
```json
{
  "title": "Missing person: John Doe",
  "short_description": "Last seen 15 Oct 2026 near MG Road.",
  "crime_type": "missing_person",
  "case_status": "open"
}
```

Allowed `crime_type` values: `missing_person`, `unidentified_person`, `abduction`, `runaway`, `trafficking`, `other`.  
Allowed `case_status` values: `open`, `under_review`.

**Response 201**
```json
{
  "success": true,
  "data": {
    "report_id": "...",
    "case": { "case_id": "...", "case_number": "IA-2026-0001", "case_status": "open", ... }
  }
}
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT` (already approved or invalid transition).

---

### GET /api/staff/cases

List cases visible to the caller. Scoped for officers.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `case_status` | string | Filter by `open\|under_review\|resolved\|closed` |
| `kind` | `missing\|found` | Filter by case kind |
| `q` | string | Search case_number, title, person_name, city |
| `page` | int | Page number (default: 1) |
| `limit` | int (1–100) | Page size (default: 20) |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "case_id": "...", "case_number": "IA-2026-0001", "title": "...", "case_status": "open",
      "kind": "missing", "report_reference_no": "REF-2026-ABCD1234",
      "assigned_officer_name": "Officer Alpha", "assigned_officer_badge": "B-001", ...
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### GET /api/staff/cases/:caseId

Get full case detail including linked report reference, officer info, case updates, candidate matches, and report history.

**Scoping**: Officer can only view cases where the linked report is assigned to them.

**Response 200**
```json
{
  "success": true,
  "data": {
    "case_id": "...", "case_number": "IA-2026-0001",
    "report_reference_no": "REF-2026-ABCD1234",
    "assigned_officer_name": "Officer Alpha", "assigned_officer_badge": "B-001",
    "updates": [ { "id": 1, "note": "Lead verified.", "update_date": "2026-11-01", "created_at": "..." } ],
    "matches": [ { "match_id": "...", "similarity_score": 0.92, "status": "pending", ... } ],
    "history": [ { "event": "Report submitted", "actor_name": "Priya Sharma", "created_at": "..." } ]
  }
}
```

**Errors**: `404 NOT_FOUND`, `403 FORBIDDEN` (officer accessing another officer's case).

---

### POST /api/staff/cases/:caseId/updates

Add a timestamped update/note to a case.

**Request body**
```json
{ "note": "Local witnesses interviewed. Search continues." }
```

`note` must be ≤ 255 characters.

**Response 201**
```json
{ "success": true, "data": { "id": 3, "case_id": "...", "note": "...", "update_date": "2026-11-03", "created_at": "..." } }
```

**Errors**: `400 VALIDATION_ERROR` (missing note or > 255 chars), `404 NOT_FOUND`.

---

### POST /api/staff/cases/:caseId/assign *(Admin only)*

Reassign the linked report of a case to a different officer. Logs a case update and report history entry.

**Request body**
```json
{ "officer_id": "<officer_id UUID>" }
```

**Response 200**
```json
{ "success": true, "data": { "case_id": "...", "assigned_officer_id": "...", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN` (non-admin), `404 NOT_FOUND`.

---

### PATCH /api/staff/cases/:caseId/status

Update a case's status. Cannot transition from `closed`.

Valid transitions: `open → under_review → resolved → closed` (use `POST /close` for closing).

**Request body**
```json
{ "status": "resolved" }
```
Valid values: `open`, `under_review`, `resolved`.

**Response 200**
```json
{ "success": true, "data": { "case_id": "...", "case_status": "resolved", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 CONFLICT` (case is already closed).

---

### POST /api/staff/cases/:caseId/close

Close a case. Adds a closing note to `case_updates` and updates the linked report status to `closed`.

**Request body**
```json
{ "note": "Person found safe and returned to family." }
```

**Response 200**
```json
{ "success": true, "data": { "case_id": "...", "case_status": "closed", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 CONFLICT` (already closed).

---

### GET /api/staff/dashboard

Caller-scoped dashboard metrics. Officers see only their assigned data; admins see all.

**Response 200**
```json
{
  "success": true,
  "data": {
    "reportsByStatus": { "submitted": 5, "under_review": 12, "info_requested": 2, "approved": 30, "rejected": 4, "closed": 1 },
    "casesByStatus": { "open": 10, "under_review": 5, "resolved": 8, "closed": 3 },
    "casesByStatusList": [
      { "status": "Open", "count": 10, "color": "var(--accent)" },
      { "status": "Under Review", "count": 5, "color": "var(--warning)" },
      { "status": "Resolved", "count": 8, "color": "var(--success)" },
      { "status": "Closed", "count": 3, "color": "var(--muted)" }
    ],
    "pendingMatches": 7,
    "awaitingReview": 5,
    "infoRequested": 2,
    "unassigned": 3,
    "totalCases": 26,
    "resolvedCases": 8,
    "myItems": { "reports": 3, "cases": 2, "pendingMatches": 1 },
    "recentActivity": [
      { "reportId": "...", "referenceNo": "REF-...", "event": "Report assigned for review", "actorName": "Officer Alpha", "date": "..." }
    ],
    "reportsPerWeek": [
      { "week": "W44", "startDate": "2026-10-25", "count": 3 }
    ]
  }
}
```

`reportsPerWeek` contains the last 8 complete calendar weeks.

---

### GET /api/staff/matches

Paginated list of candidate matches for officer review.

**Scoping**: Officers see all matches (not individually scoped); for verification, scoping is enforced at the action level.

**Query parameters**: `status` (`pending|confirmed|dismissed`), `page`, `limit`.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "match_id": "...", "similarity_score": 0.92, "status": "pending",
      "missing_case_number": "IA-2026-0001", "missing_person_name": "John Doe",
      "found_case_number": "IA-2026-0002", "found_person_name": null, ...
    }
  ],
  "meta": { "total": 7, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### GET /api/staff/matches/:matchId

Get full detail of a single match including the latest verification record.

**Response 200**
```json
{
  "success": true,
  "data": {
    "match_id": "...", "similarity_score": 0.92, "status": "confirmed",
    "missing_case_number": "IA-2026-0001", "found_case_number": "IA-2026-0002",
    "latest_verification": {
      "id": 1, "decision": "confirmed", "remarks": "Verified by officer.", "officer_name": "Officer Alpha", "officer_badge": "B-001", "verification_date": "..."
    }
  }
}
```

**Errors**: `404 NOT_FOUND`.

---

### POST /api/staff/matches/:matchId/verify

Record an officer's or admin's verification decision on a match. Atomically inserts verification and updates match status.

**Scoping**:
- **Officers**: can only verify matches where at least one case (missing or found) is linked to a report assigned to them.
- **Admins**: can verify any match.

**Request body**
```json
{ "action": "confirmed", "notes": "Fingerprints and photograph confirmed identity." }
```

Valid `action` values: `confirmed`, `dismissed`.

**Response 200**
```json
{
  "success": true,
  "data": {
    "match_id": "...", "status": "confirmed",
    "latest_verification": { "decision": "confirmed", "officer_name": "...", ... }
  }
}
```

**Errors**: `400 VALIDATION_ERROR`, `403 FORBIDDEN` (officer outside scope), `404 NOT_FOUND`, `409 CONFLICT` (match already decided).

---

## Admin-Only Endpoints

Requires `Authorization: Bearer <JWT>` with role `admin`.

---

### POST /api/admin/staff

Create a new officer account. Transactionally creates a user row and an officers row. Rolls back if badge is duplicate.

**Request body**
```json
{
  "name": "Officer Name",
  "email": "officer@police.gov.in",
  "password": "SecurePassword12!",
  "badge": "B-001",
  "district": "Bangalore Urban"
}
```

**Response 201**
```json
{ "success": true, "data": { "userId": "...", "officerId": "...", "badge": "B-001", ... } }
```

**Errors**: `400 VALIDATION_ERROR`, `409 CONFLICT` (duplicate email or badge).

---

### GET /api/admin/staff

List all staff accounts (officers and admins). Never includes `password_hash`.

**Query parameters**: `page`, `limit`.

**Response 200**
```json
{
  "success": true,
  "data": [ { "user_id": "...", "name": "...", "email": "...", "role": "officer", "badge": "B-001", "active": true } ]
}
```

---

### PATCH /api/admin/staff/:id/active

Activate or deactivate an officer account.

**Request body**
```json
{ "active": false }
```

**Response 200**
```json
{ "success": true, "data": { "officerId": "...", "active": false } }
```

---

### GET /api/admin/officers

List all officer profiles with workload (count of active reports assigned). Supports search and pagination. Never returns `password_hash`.

**Query parameters**: `q` (search name/email/badge/district), `page`, `limit`.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "officer_id": "...", "user_id": "...", "name": "Officer Alpha",
      "email": "alpha@police.gov.in", "badge": "B-001",
      "district": "North District", "active": true, "workload": 2
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
}
```

`workload` = count of reports with status `submitted`, `under_review`, or `info_requested` assigned to this officer.

---

### GET /api/admin/users

List all user accounts. Never returns `password_hash`.

**Query parameters**: `q` (search name/email), `role` (filter by `individual|officer|admin`), `page`, `limit`.

**Response 200**
```json
{
  "success": true,
  "data": [
    { "user_id": "...", "name": "...", "email": "...", "role": "individual", "phone": "...", "created_at": "..." }
  ],
  "meta": { "total": 50, "page": 1, "limit": 20, "totalPages": 3 }
}
```

---

## Environment Variables

The following environment variables are relevant to API behaviour. See `.env.example` for defaults.

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `test` to disable rate limits |
| `TRUST_PROXY` | Passed to `app.set('trust proxy', ...)`. Set to `1` when behind a reverse proxy (nginx/load-balancer) so `req.ip` reflects the client IP from `X-Forwarded-For` |
| `JWT_SECRET` | Secret key for signing/verifying JWTs |
| `JWT_EXPIRES_IN` | Token TTL (e.g., `7d`) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `DB_TEST_NAME` | Test database name (must be `identarchive_test`) |
| `CORS_ORIGIN` | Allowed CORS origin |

---

## Data Model Summary

```
users  (user_id PK, name, email, password_hash, role[individual|officer|admin], phone)
  └── officers (officer_id PK, user_id FK, badge UNIQUE, district, active)
  └── reports (report_id PK, reporter_id FK→users, assigned_officer_id FK→officers,
               case_id FK→cases, status, priority, review_note, ...)
        └── report_history (id PK, report_id FK, event, actor_id FK→users)
cases  (case_id PK, case_number UNIQUE, title, kind[missing|found], case_status, ...)
  └── case_updates (id PK, case_id FK, note, update_date)
  └── matches (match_id PK, missing_case_id FK, found_case_id FK, similarity_score, status)
        └── match_verifications (id PK, match_id FK, officer_id FK, decision, remarks)
pincodes (pincode PK, city, district, state)
```

