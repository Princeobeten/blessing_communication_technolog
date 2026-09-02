# Computer Repair Management System (CRMS)

A web-based repair management system built as a final year project prototype:
device intake, repair tracking, technician assignment, spare-part inventory,
billing and management reporting, with automatic customer notifications.

Built with **Next.js 15 (App Router, TypeScript)** and **MongoDB via Mongoose**.

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET
npm run seed              # loads demonstration data (clears existing data first)
npm run dev               # http://localhost:3000
```

### Demonstration accounts

| Role          | Email               | Password      |
| ------------- | ------------------- | ------------- |
| Administrator | `admin@crms.test`   | `password123` |
| Technician    | `tunde@crms.test`   | `password123` |
| Technician    | `amaka@crms.test`   | `password123` |
| Technician    | `ibrahim@crms.test` | `password123` |

Customers do not sign in. They open `/track` and enter the tracking number from
their intake receipt (for example `TRK-2026-0005`).

---

## How the system maps to the project design

The navigation follows the high-level model in **Fig 3.7**:

| Fig 3.7 module      | Where it lives                                            |
| ------------------- | --------------------------------------------------------- |
| Login               | `/login`, JWT session cookie                               |
| Repair Intake       | `/repairs/new` - register customer, record device, document issue, schedule diagnosis |
| Service Module      | `/repairs/[id]` - diagnosis & estimation, update status, approve quote |
| Admin Dashboard     | `/dashboard`, `/technicians`, `/repairs`, `/reports`, `/inventory` |
| Logout              | Sidebar, clears the session cookie                         |

And to the objectives in **Chapter One**:

1. **Centralised database** - one MongoDB database; every module reads and writes the same records, so customer, repair, parts and billing data can no longer drift apart.
2. **Automated workflow** - a repair moves through a guarded lifecycle (`pending → diagnosing → awaiting_approval → in_progress → awaiting_parts → completed → delivered`), with assignment and a full audit trail per job.
3. **Improved communication** - every status change, quote, invoice and payment writes a customer notification, visible at `/notifications`, plus a public status page at `/track`.
4. **Inventory management** - parts are drawn down automatically when fitted to a repair, every movement is recorded, and low-stock alerts appear on the dashboard.
5. **Reports and analytics** - `/reports` gives repair volume, billed vs collected revenue, device mix, technician performance and average turnaround.

---

## Architecture

```
src/
  app/
    (app)/           Authenticated pages (sidebar shell)
    api/             REST API - the only place that touches the database
    login/  track/   Public pages
  components/        UI primitives, sidebar, chart toolkit
  lib/               db, auth, session, constants, notifications, helpers
  models/            Mongoose schemas
  middleware.ts      Route protection at the edge
scripts/seed.ts      Demonstration data
docs/screenshots/    Captured screens for the project report
```

**Request flow:** page (client component) → `fetch` to an API route → `requireSession()` / `requireAdmin()` → Zod validation → Mongoose → JSON response.

### Data model

| Collection      | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `users`         | Staff accounts (administrator / technician), bcrypt password hash |
| `customers`     | Customer records                                                |
| `repairjobs`    | Work orders: device, fault, diagnosis, status, quote, parts used, timeline |
| `parts`         | Spare-part catalogue and stock levels                           |
| `stockmovements`| Audit trail of every stock change                               |
| `invoices`      | Line items, tax, discount, payments                             |
| `notifications` | Every automated customer message                                |
| `counters`      | Atomic sequences for `TRK-…` and `INV-…` numbers                |

### Security

- Passwords hashed with bcrypt; the hash is never selected by default.
- Sessions are signed JWTs in an `httpOnly`, `sameSite=lax` cookie (8 hours).
- `middleware.ts` guards pages; every API route re-checks the session itself.
- Technicians see and edit **only** jobs assigned to them; reassignment, staff management, inventory changes and reports are administrator-only.
- Status changes are validated against an allowed-transitions map, so a job cannot skip stages.
- Stock is decremented with a conditional update, so a part cannot be issued twice.

---

## Notifications

`src/lib/notify.ts` records every message in the `notifications` collection, then
hands it to a **delivery driver**. The prototype ships a console driver, so
messages are logged and stored rather than actually emailed - no API keys needed
to demonstrate the feature. To send real email or SMS, implement the
`DeliveryDriver` interface with a provider (Resend, SendGrid, Termii…) and swap
the `driver` constant. Nothing else in the system changes.

---

## API reference

| Method | Endpoint                        | Access        | Purpose                          |
| ------ | ------------------------------- | ------------- | -------------------------------- |
| POST   | `/api/auth/login`               | Public        | Sign in                          |
| POST   | `/api/auth/logout`              | Public        | Sign out                         |
| GET    | `/api/auth/me`                  | Staff         | Current session                  |
| GET    | `/api/dashboard`                | Staff         | Dashboard figures (role-scoped)  |
| GET/POST | `/api/customers`              | Staff         | List / register customers        |
| GET/PATCH/DELETE | `/api/customers/[id]` | Staff / Admin | Customer with repair history     |
| GET/POST | `/api/repairs`                | Staff         | List jobs / device intake        |
| GET/PATCH/DELETE | `/api/repairs/[id]`   | Staff / Admin | Job detail and edits             |
| POST   | `/api/repairs/[id]/status`      | Staff         | Advance the repair stage         |
| POST/PATCH | `/api/repairs/[id]/quote`   | Staff         | Prepare quote / record approval  |
| POST/DELETE | `/api/repairs/[id]/parts`  | Staff         | Fit / return a spare part        |
| POST   | `/api/repairs/[id]/invoice`     | Staff         | Generate the invoice             |
| GET    | `/api/invoices`, `/api/invoices/[id]` | Staff   | Billing                          |
| POST   | `/api/invoices/[id]/payments`   | Staff         | Record a payment                 |
| GET/POST | `/api/parts`                  | Staff / Admin | Inventory                        |
| GET/PATCH/DELETE | `/api/parts/[id]`     | Staff / Admin | Part detail and stock adjustment |
| GET/POST | `/api/technicians`            | Staff / Admin | Staff directory                  |
| PATCH/DELETE | `/api/technicians/[id]`   | Admin         | Manage a staff account           |
| GET    | `/api/notifications`            | Staff         | Notification log                 |
| GET    | `/api/reports`                  | Admin         | Analytics aggregations           |
| GET    | `/api/track/[ticket]`           | **Public**    | Customer repair status           |

---

## Scripts

| Command         | Does                                        |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Development server                          |
| `npm run build` | Production build                            |
| `npm start`     | Run the production build                    |
| `npm run seed`  | Reset and load demonstration data           |

## Known limitations

Consistent with the scope stated in Chapter One:

- Notifications are recorded and logged, not delivered to a real inbox until a provider is configured.
- Payment recording is manual; no payment gateway is wired up.
- No hardware-level diagnostic tools - the system manages the repair workflow only.
- Multi-document operations (for example fitting a part) are not wrapped in MongoDB transactions; single-document atomic updates are used instead, which is sufficient at prototype scale.
