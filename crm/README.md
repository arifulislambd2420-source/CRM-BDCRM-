# প্রকাশনী CRM

একটি বাংলা শিক্ষা প্রকাশনা ব্যবসার জন্য কাস্টমার রিলেশনশিপ ম্যানেজমেন্ট (CRM) টুল।

CRM for a Bengali educational publishing business — tracks leads from multiple sources through **fully customizable named pipelines** (Facebook Ad লিড, WhatsApp লিড, নতুন স্টুডেন্ট, General …), with role-based access, a numbered notes timeline per customer, and a pluggable WhatsApp integration layer.

## Stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS 3** with a custom navy / gold / teal palette
- **React Router** for navigation
- **Recharts** for dashboard charts
- **@dnd-kit** for Kanban drag-and-drop (installed; wired in the next iteration)
- **lucide-react** for icons
- **Noto Sans Bengali** + **Hind Siliguri** for Bengali text rendering

## Getting started

The frontend now talks to a real Node/Express + SQLite backend in the sibling `server/` folder. Start both:

```bash
# Terminal 1 — backend on :4000
cd ../server
cp .env.example .env
npm install
npm run dev

# Terminal 2 — frontend on :5173
cd crm
cp .env.example .env.local     # points VITE_API_URL at http://localhost:4000
npm install
npm run dev
```

Open http://localhost:5173.

## Demo accounts

Click one on the login screen to auto-fill.

| Role | Email | Password |
| ---- | ----- | -------- |
| Admin | admin@prokashoni.bd | admin123 |
| Sub-admin | subadmin@prokashoni.bd | sub123 |
| Store Manager (ঢাকা) | dhaka@prokashoni.bd | store123 |
| Store Manager (চট্টগ্রাম) | ctg@prokashoni.bd | store123 |

25 customers are seeded across the 4 pipelines, all sources, and 3 stores, each with 1–4 sample notes.

## Roles & permissions

| Capability | Admin | Sub-admin | Store Manager |
| ---------- | :---: | :-------: | :-----------: |
| View / edit customers | all stores | all stores | own store only |
| View / add notes | ✓ | ✓ | ✓ (own store) |
| Edit / delete **own** notes | ✓ | if `canEditOwnNotes` on | if `canEditOwnNotes` on |
| Edit / delete **anyone's** notes | ✓ | — | — |
| User management | ✓ | — | — |
| Pipelines / sources / stores settings | ✓ | — | — |

Enforced in two places: routes (`src/components/ProtectedRoute.tsx`) and data (`src/services/customers.ts`, `src/services/notes.ts`).

## Data model

- **Pipeline** — `{ id, name, stages: Stage[] }`. Stage list is fully editable by Admin; no fixed count.
- **Customer** — belongs to one pipeline and sits at one of its stages; carries a chronological `notes[]`.
- **Note** — sub-entity of Customer. `number` is sequential per-customer and **never reused** (uses `max + 1`, not `length + 1`, so deleting a note doesn't recycle its number). Every note stamps `createdAt` + `createdById` + `createdByName` (name snapshotted for display resilience).
- **User** — includes a `canEditOwnNotes` flag Admin toggles per user.
- **Store** — has assigned `managerIds`.

## Project structure

```
src/
├─ components/           layout, sidebar, protected route, customer form modal
├─ context/              AuthContext + DataContext (useSyncExternalStore over mock db)
├─ data/mockData.ts      seed users, pipelines, stores, customers (with notes), sources
├─ pages/                Login, Dashboard, Customers, Placeholder (Pipeline/Users/Settings)
├─ services/
│  ├─ store.ts           in-memory + localStorage mock db (the ONE place mock data lives)
│  ├─ auth.ts            login / logout / session
│  ├─ customers.ts       role-scoped CRUD + moveCustomerStage()
│  ├─ notes.ts           addNote / updateNote / deleteNote with canModifyNote() guards
│  ├─ pipelines.ts       CRUD for pipelines and their stages (+ reorderStages)
│  ├─ users.ts, stores.ts, settings.ts
│  └─ whatsapp/          integration layer (see below)
├─ types/                shared TS types
├─ App.tsx               routes
├─ main.tsx              entry
└─ index.css             tailwind + component classes
```

## Swapping in a real backend

Everything talks to the backend through `src/services/`. Replace the bodies of `login`, `getCustomers`, `createCustomer`, `addNote`, etc. with real `fetch()` calls — components will not change. The `src/services/store.ts` in-memory layer is only for mock mode; delete it once the API is live.

## WhatsApp integration

`src/services/whatsapp/` supports two modes, selected via `whatsappConfig.mode`:

### Mode A — Click-to-chat (`'click_to_chat'`, default, safe, live now)

- `generateWhatsAppLink({ storeNumber, message, sourceTag })` builds a `wa.me/…?text=…` URL. `sourceTag` (e.g. `fb-ad-tafseer-2026`) is embedded as `[src:<tag>]` inside the message so incoming chats stay attributable.
- `parseSourceTag(messageBody)` reads that tag back out.
- Customer list has a WhatsApp icon per row that opens the prefilled chat.
- The Customer form has a **"WhatsApp যোগাযোগ লগ করুন"** button that fills the note field with a timestamped `WhatsApp-এ যোগাযোগ হয়েছে` line — the manual bridge until we wire up real message capture.

**Embedding the chat button on your website**

_WordPress (via Custom HTML block or a Code Snippets plugin):_

```html
<a
  href="https://wa.me/8801700000000?text=%E0%A6%86%E0%A6%B8%E0%A6%B8%E0%A6%BE%E0%A6%B2%E0%A6%BE%E0%A6%AE%E0%A7%81%E0%A6%A6%E0%A6%B0%20%E0%A6%86%E0%A6%B2%E0%A6%BE%E0%A6%87%E0%A6%95%E0%A7%81%E0%A6%AE%20%5Bsrc%3Awp-home%5D"
  target="_blank" rel="noopener"
  style="position:fixed;bottom:24px;right:24px;background:#25d366;color:#fff;
         padding:14px 18px;border-radius:999px;font-family:sans-serif;
         text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.15);z-index:9999;">
  💬 WhatsApp-এ কথা বলুন
</a>
```

Change `8801700000000` to your business number and `wp-home` to a page-specific tag (`wp-checkout`, `fb-ad-tafseer-2026`, etc.) so the CRM knows which page/campaign produced the chat.

_Custom HTML site (drop before `</body>`):_

```html
<script>
  (function () {
    var tag = document.currentScript.getAttribute('data-tag') || 'site';
    var num = '8801700000000';
    var msg = encodeURIComponent(
      'আসসালামু আলাইকুম, আমি আপনাদের বই সম্পর্কে জানতে চাই। [src:' + tag + ']',
    );
    var a = document.createElement('a');
    a.href = 'https://wa.me/' + num + '?text=' + msg;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '💬 WhatsApp';
    a.style.cssText =
      'position:fixed;bottom:24px;right:24px;background:#25d366;color:#fff;' +
      'padding:14px 18px;border-radius:999px;font-family:sans-serif;' +
      'text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.15);z-index:9999';
    document.body.appendChild(a);
  })();
</script>
<script data-tag="landing-tafseer" src="/whatsapp-button.js"></script>
```

Different `data-tag` per landing page lets you segment by campaign in the CRM later.

### Mode B — WhatsApp Business Cloud API (`'cloud_api'`, stub only)

`src/services/whatsapp/cloudApiAdapter.ts` exposes typed `sendMessage()`, `receiveWebhook()`, and `syncIncomingLead()` as clearly marked TODO stubs. Going live needs:

1. Meta Business Verification approved
2. A registered WhatsApp Business phone number (dedicated — not tied to a personal WhatsApp)
3. A Meta App with the WhatsApp product enabled → Phone Number ID + permanent System User access token
4. A public HTTPS webhook URL (with a verify token) for incoming messages
5. Pre-approved message templates for anything sent outside the 24-hour customer-initiated window

The adapter should ultimately live server-side; **do not ship the access token in the browser bundle**. Expose it to the CRM as a thin `/api/whatsapp/*` proxy.

### What we intentionally do **not** support

No unofficial / QR-session / reverse-engineered WhatsApp libraries. They violate WhatsApp's terms of service and routinely get business numbers banned. If we ever want that route it belongs in a separate, isolated microservice — never in this core CRM.

## Design notes

Palette avoids generic SaaS purple/indigo. It uses:
- **Deep navy** (`navy-*`) as the primary surface and text color
- **Warm gold/mustard** (`gold-*`) for accents and highlights
- **Muted teal-green** (`teal-*`) for success / progress states

All UI copy is in Bengali; the app is `lang="bn"` and preloads Noto Sans Bengali + Hind Siliguri from Google Fonts.

## Build order

You asked to build in stages and review each. Current status:

- ✅ **1. Data model + mock data + auth** — types, seeded users/pipelines/stores/customers+notes, mock auth, role-based routing
- ✅ **2. Dashboard + customer list** — stat cards, pipeline-selectable stage chart, per-pipeline totals, source pie, recent list, admin performance panel; customer list with pipeline+stage cascading filter, WhatsApp quick-action, notes count
- ✅ **3. Pipeline / Kanban view** — pipeline selector, dynamically-rendered stage columns, `@dnd-kit` drag-and-drop with PointerSensor + KeyboardSensor + DragOverlay; each card also has a stage dropdown (accessibility/mobile fallback), WhatsApp quick-action, click-to-open-detail. Store managers only see their own store's cards.
- ✅ **4. Customer detail page + notes timeline** — left column: customer info (inline edit) + pipeline/stage selectors; right column: newest-first numbered notes timeline with author + timestamp, always-available "add note" form, per-note edit/delete gated on `canModifyNote()` (admin always, others only if `canEditOwnNotes` and it's their own note). Sequential note numbers use `max(number)+1` so deleting doesn't recycle. Reached from customer-list name links and Kanban card clicks.
- ✅ **5. Settings page (Admin)** — tabbed: Pipelines (create/rename/delete pipeline, add/rename/delete stages, reorder stages via `@dnd-kit/sortable` drag-and-drop AND up/down arrow buttons), Sources (add/rename/delete), Stores (add/rename/delete). Delete confirms include hints about knock-on effects.
- ✅ **6. User management (Admin)** — list all users with role/store/notes-permission columns, add-user form (Sub-admin or Store Manager, with store assignment for managers), inline role+store editing, `canEditOwnNotes` checkbox toggle (admins always shown as "সবসময়"), delete for non-admin non-self users.
- ⏳ 5. Settings — pipelines (add / rename / delete / reorder stages), sources, stores
- ⏳ 6. User management — add users, assign store, toggle `canEditOwnNotes`
