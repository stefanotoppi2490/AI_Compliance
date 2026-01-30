# PROJECT_CONTEXT — Client Scope Guard

## What we’re building

**Client Scope Guard** is a small B2B SaaS that helps prevent unpaid “scope creep”.
User uploads a contract / quote (DOCX/PDF), the system extracts the scope (deliverables, exclusions, constraints), and then checks client requests as **in-scope / out-of-scope / unclear**, with reasons and citations.

## Current status (DONE)

### Stack

- Next.js **16.1.6** App Router (Vercel deployment)
- React **19**
- Tailwind **v4**
- Prisma **7.x**
- Neon Postgres (DATABASE_URL points to Neon)
- **Prisma Neon adapter** (NO Prisma Accelerate)
- Password hashing: **argon2**

### Auth (session cookie)

We use **session-based auth**:

- HttpOnly cookie: `csg_session`
- Session stored in DB table `Session`
- User stored in DB table `User`

Cookie rules:

- `httpOnly: true`
- `sameSite: "lax"`
- `secure: true` in production
- `path: "/"`
- expires = session.expiresAt

**Important**: in this Next version `cookies()` is async.
So cookie access must always be awaited.

### Implemented pages (UI)

- `/login` — Tailwind UI, calls `POST /api/auth/login`, redirects to `/dashboard`
- `/register` — Tailwind UI, calls `POST /api/auth/register`, redirects to `/dashboard`
- `/dashboard` — Tailwind UI shell, currently **no business logic** (protected server page)

### Implemented API endpoints

- `GET /api/auth/me`
  - Returns `{ ok: true, user }` where user can be null
- `POST /api/auth/register`
  - Creates user + session + sets cookie
- `POST /api/auth/login`
  - Verifies password + creates session + sets cookie
- `POST /api/auth/logout`
  - Deletes session best-effort + clears cookie (implementation may redirect or return JSON)

Key source files
• Prisma client singleton (Neon adapter):
• src/lib/db/prisma.ts
• Cookies:
• src/lib/auth/authCookies.ts
• Current user from session:
• src/lib/auth/session.ts
• exports getCurrentUser()
• exports makeSessionExpiry(days=30)
• if session expired: delete session and clear cookie best-effort

Constraints / non-goals right now
• No Prisma Accelerate.
• No external auth providers yet (Google/OAuth).
• No heavy schema validation libs unless requested.
• Keep MVP small and shippable.

How we’ll use TanStack Query

Not used yet for auth forms (they are simple POSTs).
We will introduce TanStack Query when we start:
• Project list / create / delete
• Document list / upload / status
• Request checks history

Query key convention (planned):
• ['csg', 'projects', params]
• ['csg', 'documents', { projectId, ... }]
• ['csg', 'checks', { projectId, ... }]

Next milestone (DO NEXT)

Step 1 — Projects (minimum)
• Prisma model: Project
• id, userId, name, createdAt
• API:
• GET /api/projects (list user projects)
• POST /api/projects (create)
• UI:
• /projects/new form
• Dashboard shows project list
• Protection:
• API endpoints require user session

Step 2 — Documents
• Upload DOCX/PDF
• Extract text
• Chunk text
• Store chunks for later “citations”

Step 3 — AI (later)
• Generate scope bullets from document
• Check request vs scope and store results

Environment variables
• DATABASE_URL = Neon postgres connection string (sslmode=require)
