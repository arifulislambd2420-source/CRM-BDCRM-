# প্রকাশনী CRM — Backend

Node.js + Express REST API for the [CRM frontend](../crm/README.md).

## Stack

- **Node.js ≥ 20** + **TypeScript** (via `tsx` in dev, `tsc` for prod build)
- **Express 5** for routing
- **better-sqlite3** — synchronous, file-based, zero external DB required. Swap for PostgreSQL later by rewriting `src/db.ts` and each `db.prepare(...)` call site; the rest of the code is DB-agnostic.
- **JWT** via `jsonwebtoken` for stateless auth
- **bcryptjs** for password hashing (pure JS, no native build)
- **cors** — the frontend origin is controlled via `CORS_ORIGIN` env var

## Getting started

```bash
cp .env.example .env
# edit .env — at minimum change JWT_SECRET for anything past local dev
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default. On first boot with an empty database it seeds the same demo data the frontend used to bundle (4 users, 4 pipelines, 3 stores, 25 customers with 1–4 notes each, 7 sources). After that it will not re-seed unless the DB is deleted.

Demo passwords (change these in `src/seed.ts` before going anywhere near production):

| Email | Password | Role |
| --- | --- | --- |
| admin@prokashoni.bd | admin123 | Admin |
| subadmin@prokashoni.bd | sub123 | Sub-admin |
| dhaka@prokashoni.bd | store123 | Store Manager (ঢাকা) |
| ctg@prokashoni.bd | store123 | Store Manager (চট্টগ্রাম) |

## Environment

| Var | Required | Default | Notes |
| --- | :---: | --- | --- |
| `PORT` | | 4000 | HTTP port |
| `CORS_ORIGIN` | | `*` | Comma-separated list of frontend origins to allow. Set to your Vite dev origin in dev. |
| `JWT_SECRET` | ✓ | — | Long random string. Generate with `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`. |
| `JWT_EXPIRES_IN` | | `7d` | Any [`jsonwebtoken`-compatible](https://github.com/vercel/ms) duration string. |
| `DB_PATH` | | `./data/crm.db` | SQLite file. Created on first boot. |
| `SEED_ON_EMPTY` | | `true` | Set to `false` once you have real data. |

## API surface

All routes except `/api/auth/login`, `/api/auth/session` accept a `Authorization: Bearer <token>` header. Errors return `{ "error": "..." }` with a status code.

### Auth
- `POST /api/auth/login` — `{ email, password }` → `{ user, token }`
- `GET /api/auth/session` — validates current token → `{ user }`

### Customers (role-scoped: store managers only see their own store)
- `GET /api/customers` → `Customer[]`
- `GET /api/customers/:id` → `Customer`
- `POST /api/customers` → creates one
- `PATCH /api/customers/:id` → partial update
- `DELETE /api/customers/:id`

### Notes (nested under a customer; server enforces `canModifyNote`)
- `POST /api/customers/:customerId/notes` — `{ text }` → creates note with sequential `number` (uses `max(number)+1`, never recycles)
- `PATCH /api/customers/:customerId/notes/:noteId` — `{ text }`
- `DELETE /api/customers/:customerId/notes/:noteId`

### Pipelines (read: any user; write: admin only)
- `GET /api/pipelines` → `Pipeline[]` (each with its stages, sorted)
- `POST /api/pipelines` — `{ name }`
- `PATCH /api/pipelines/:pipelineId` — `{ name }` (rename)
- `DELETE /api/pipelines/:pipelineId` — **blocked** if any customer references the pipeline (returns 400 with count message)
- `POST /api/pipelines/:pipelineId/stages` — `{ name }`
- `PATCH /api/pipelines/:pipelineId/stages/:stageId` — `{ name }`
- `DELETE /api/pipelines/:pipelineId/stages/:stageId` — **blocked** if customers sit on it
- `POST /api/pipelines/:pipelineId/reorder` — `{ orderedIds: string[] }`

### Users (read: any user; write: admin only)
- `GET /api/users` → `PublicUser[]` (no password hash)
- `POST /api/users` — creates Sub-admin or Store Manager
- `PATCH /api/users/:id`
- `DELETE /api/users/:id` — 400 if the target is admin

### Stores
- `GET /api/stores` → `Store[]` with `managerIds`
- Admin-only mutation endpoints as above

### Settings
- `GET /api/settings` → `{ sources: string[] }`
- `PUT /api/settings/sources` — admin only

### Health
- `GET /api/health` → `{ ok: true, ts }`

## Structure

```
server/
├─ src/
│  ├─ index.ts            express bootstrap + error handler + route mounting
│  ├─ db.ts               better-sqlite3 open + migrations
│  ├─ seed.ts             initial demo data (idempotent — only runs if users empty)
│  ├─ auth.ts             signToken / verifyToken / requireAuth / requireRole
│  ├─ utils.ts            asyncHandler + makeId
│  ├─ types.ts            mirrors crm/src/types/index.ts
│  └─ routes/             one file per resource
├─ .env.example
├─ tsconfig.json
└─ package.json
```

## Swapping SQLite for PostgreSQL later

Everything DB-touching lives in either `src/db.ts` (schema + connection) or a route file's `db.prepare(...)` calls. The rest of the code is DB-agnostic: routes never receive a DB object, they just call the prepared statements. To move to Postgres:

1. Replace `better-sqlite3` with `pg`.
2. Rewrite `src/db.ts` to expose a `query(sql, params)` helper.
3. Replace `db.prepare(...).run/get/all(...)` calls with `await query(...)`.
4. Move `bcrypt.compareSync`/`.hashSync` to async variants (they're already fine either way).

The API shape doesn't need to change.

## Not for production yet

- Passwords use bcrypt, but the JWT secret in `.env` must be replaced before any real deployment.
- No rate limiting on the login endpoint. Add `express-rate-limit` if this is exposed to the public internet.
- Bodies are limited to 256 KB in `src/index.ts` — bump for imports if needed.
