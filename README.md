# প্রকাশনী CRM

CRM for a Bengali educational publishing business. Two apps in this repo:

| Folder | What | Runs on |
| --- | --- | --- |
| [`crm/`](./crm) | React + TypeScript + Vite frontend | http://localhost:5173 |
| [`server/`](./server) | Node.js + Express + SQLite REST API | http://localhost:4000 |

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

Then open http://localhost:5173 and log in as `admin@prokashoni.bd` / `admin123` (demo accounts listed on the login screen).

- Frontend architecture, screens, and design notes: [crm/README.md](./crm/README.md)
- Backend API surface, environment variables, and DB layout: [server/README.md](./server/README.md)
