# প্রকাশনী CRM — Backend

Node.js + Express + Prisma + MySQL REST API for the [CRM frontend](../crm/README.md).

## Stack

- **Node.js ≥ 20** + **TypeScript** (`tsx` in dev)
- **Express 5** for routing
- **Prisma 6** as the ORM
- **MySQL 8** as the database — same URL shape works for local dev and Hostinger's managed MySQL. Switching between them is `DATABASE_URL` only, no code changes.
- **JWT** with **access + refresh tokens** — access is short-lived (15m), refresh rotates on each use and is revocable server-side
- **bcryptjs** for password hashing

## Local setup

### 1. MySQL

**Option A — local dev on this machine (already set up in this repo)**

MySQL 8.4 Community Server is installed under `C:\Program Files\MySQL\MySQL Server 8.4\bin\`. A project-local, passwordless data directory lives at `server/mysql-data/` (git-ignored). To start it:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" `
  --datadir="C:\Claude website\server\mysql-data" `
  --port=3306 --console
```

The `crm` database is already created (`utf8mb4` for Bengali). If you nuke the data dir, recreate it with:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --initialize-insecure --datadir="C:\Claude website\server\mysql-data"
# start mysqld (command above), then:
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -h 127.0.0.1 -e "CREATE DATABASE crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

**Option B — Hostinger's managed MySQL** (or any other MySQL host)

- Create a MySQL database in Hostinger's control panel (Databases → MySQL Databases → Create).
- Note the host / port / username / password / database name.
- In `.env` set:

  ```env
  DATABASE_URL=mysql://<user>:<pass>@<host>:3306/<db>
  ```

  If Hostinger requires TLS, append `?sslmode=REQUIRED` (Prisma supports it via the URL).

- Run `npm run migrate:deploy` to apply migrations against the remote DB.

**No code changes needed to switch between local and Hostinger — only `.env`.**

### 2. Backend

```bash
cd server
cp .env.example .env
# edit .env — at minimum change JWT_SECRET + JWT_REFRESH_SECRET before deploy
npm install
npx prisma migrate deploy        # apply migrations to the DB
npm run dev                      # start on http://localhost:4000
```

On first boot with an empty database, `SEED_ON_EMPTY=true` seeds demo data (4 users, 4 pipelines, 3 stores, 25 customers with 1–4 notes each).

Set `SEED_ON_EMPTY=false` in production so a redeploy against an empty DB won't accidentally re-seed a demo dataset over your real data.

Demo passwords (change in `src/seed.ts` before production):

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
| `CORS_ORIGIN` | | `*` | Comma-separated allow-list of frontend origins |
| `JWT_SECRET` | ✓ | — | Long random string. `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | ✓ | — | Separate from `JWT_SECRET`. Same generator. |
| `JWT_ACCESS_EXPIRES_IN` | | `15m` | Short. Client auto-refreshes. |
| `JWT_REFRESH_EXPIRES_IN` | | `30d` | Refresh is server-side revocable via `POST /api/auth/logout`. |
| `DATABASE_URL` | ✓ | — | `mysql://user[:pass]@host:port/db[?params]` |
| `SEED_ON_EMPTY` | | `true` | Demo seed on empty DB. Set `false` for production. |

## API surface

Every route except `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/health` requires `Authorization: Bearer <accessToken>`. Errors return `{ "error": "..." }`.

### Auth
- `POST /api/auth/login` — `{ email, password }` → `{ user, accessToken, refreshToken }`
- `POST /api/auth/refresh` — `{ refreshToken }` → new `{ user, accessToken, refreshToken }`. The old refresh is revoked (rotation).
- `POST /api/auth/logout` — `{ refreshToken }` → 204. Server marks the refresh revoked.
- `GET /api/auth/session` — validates current access token → `{ user }`

### Customers (role-scoped)
- `GET /api/customers` → `Customer[]` (store manager sees only their own store)
- `GET /api/customers/:id`
- `POST /api/customers` / `PATCH /api/customers/:id` / `DELETE /api/customers/:id`

### Notes (nested)
- `POST /api/customers/:customerId/notes` — `{ text }` → creates with sequential `number` (`max+1`, never recycled)
- `PATCH /api/customers/:customerId/notes/:noteId` — `{ text }`
- `DELETE /api/customers/:customerId/notes/:noteId`

Server enforces `canModifyNote(user, note)`: admin always; other roles only their own note if `canEditOwnNotes` is true.

### Pipelines / Stages (admin-only mutations)
- `GET /api/pipelines`
- `POST /api/pipelines` / `PATCH /api/pipelines/:pipelineId` / `DELETE /api/pipelines/:pipelineId` (delete blocked with count if any customer references it)
- `POST /api/pipelines/:pipelineId/stages` / `PATCH .../stages/:stageId` / `DELETE .../stages/:stageId` (delete blocked with count if any customer sits on it)
- `POST /api/pipelines/:pipelineId/reorder` — `{ orderedIds: string[] }`

### Users
- `GET /api/users` (any user can read)
- `POST /api/users` / `PATCH /api/users/:id` / `DELETE /api/users/:id` (admin only; admin role can never be deleted or downgraded)

### Stores
- `GET /api/stores` (any user)
- CRUD (admin)

### Settings
- `GET /api/settings` → `{ sources }`
- `PUT /api/settings/sources` — admin only

### Health
- `GET /api/health` → `{ ok, ts }`

## Structure

```
server/
├─ prisma/
│  ├─ schema.prisma       schema (models = tables)
│  └─ migrations/          `prisma migrate` output
├─ src/
│  ├─ index.ts             express bootstrap + error handler
│  ├─ db.ts                Prisma client singleton
│  ├─ seed.ts              demo seed (idempotent on empty DB)
│  ├─ auth.ts              JWT signing / verification / refresh-token rotation
│  ├─ utils.ts             asyncHandler + makeId + p() param coercion
│  ├─ types.ts             mirrors crm/src/types/index.ts
│  └─ routes/              one file per resource
├─ .env.example
├─ tsconfig.json
└─ package.json
```

## Working with the schema

```bash
# Edit prisma/schema.prisma, then create a migration:
npx prisma migrate dev --name your_change

# In production (or against Hostinger):
npx prisma migrate deploy

# Open Prisma Studio (visual DB browser):
npx prisma studio
```

## Not for production yet

- The `JWT_SECRET` / `JWT_REFRESH_SECRET` in `.env` are dev-only. Replace before deploying anywhere.
- No rate limit on `/api/auth/login` — add `express-rate-limit` before exposing to the public internet.
- Bodies capped at 256 KB in `src/index.ts`.
