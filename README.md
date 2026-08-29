# প্রকাশনী CRM

CRM for a Bengali educational publishing business. Two apps in this repo:

| Folder | What | Runs on |
| --- | --- | --- |
| [`crm/`](./crm) | React + TypeScript + Vite frontend | http://localhost:5173 |
| [`server/`](./server) | Node.js + Express + Prisma/MySQL REST API | http://localhost:4000 |

In production both are served by the single Express process: it serves the API
under `/api/*` and the built React app from `crm/dist` for every other path.

## Quick start

```bash
# Backend
cd server
cp .env.example .env
npm install
npm run dev

# In another terminal — Frontend
cd crm
cp .env.example .env.local
npm install
npm run dev
```

Then open http://localhost:5173 and log in as `admin@prokashoni.bd` / `admin123`.
The demo-account shortcuts render on the login screen in development only —
they are stripped from production builds so credentials never ship to users.

- Frontend architecture, screens, and design notes: [crm/README.md](./crm/README.md)
- Backend API surface, environment variables, and DB layout: [server/README.md](./server/README.md)

## Production deployment

The app boots HTTP first and initialises the database in the background, so the
health endpoint stays reachable even when the DB is unhappy:

```
GET /api/health -> {"ok":true,"dbReady":true,"dbError":null}
```

### Applying migrations

On boot the server tries `prisma migrate deploy`, bounded by a timeout
(`MIGRATE_TIMEOUT_MS`, default 90s) and treated as non-fatal. On constrained
shared hosts this step can fail — Prisma's schema engine is a separate binary
and may be blocked by the host's process limits (`EAGAIN`) or have its
executable bit stripped by the deploy (`EACCES`; the server re-applies `chmod +x`
at boot to counter this).

**If the boot log says a migration did not complete, apply it by hand:**

```bash
mysql -u "$DB_USER" -p -h 127.0.0.1 "$DB_NAME" < server/prisma/migrations/<migration>/migration.sql
```

Then record it so Prisma does not try to re-apply it:

```sql
INSERT INTO _prisma_migrations
  (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
VALUES (UUID(), '<sha256 of migration.sql>', '<migration dir name>', NOW(3), NOW(3), 1);
```

Get the checksum with `sha256sum server/prisma/migrations/<migration>/migration.sql`.
Skipping this step leaves Prisma believing the migration is pending, and the next
successful `migrate deploy` will try to re-create existing tables and abort.
