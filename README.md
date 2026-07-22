# AURELIA

**A**daptive **U**nified **R**easoning **E**ngine for **L**earning, **I**ntelligence, and **A**ssistance

A ChatGPT-style chat app with mandatory account login, per-user model access control (RBAC), and live web search grounding — backed by 3 AI providers:

1. Google Gemini 2.5 Flash Lite
2. OpenRouter (any free model)
3. NVIDIA Nemotron 3 Ultra (550B-A55B) via NVIDIA NIM

Design: strict monochrome (grayscale only), dark-first.

---

## 1. Setup

```bash
npm install
```

> Note: `npm install` fetches the Prisma query engine binary from
> `binaries.prisma.sh`. If you're behind a restrictive proxy/firewall,
> make sure that domain is reachable.

## 2. Environment variables

Fill in `.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

GEMINI_API_KEY=""       # https://aistudio.google.com/apikey
OPENROUTER_API_KEY=""   # https://openrouter.ai/keys
NVIDIA_API_KEY=""       # https://build.nvidia.com
TAVILY_API_KEY=""       # https://tavily.com — powers "Search the web" toggle
```

## 3. Database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Creates `dev.db` (SQLite) with `User`, `ModelAccess`, `Conversation`, `Message`.
For production, switch `provider = "sqlite"` → `"postgresql"` in
`prisma/schema.prisma` and point `DATABASE_URL` at Postgres (Supabase/Neon/etc).

## 4. Run

```bash
npm run dev
```

Visit `http://localhost:3000` — redirects to `/login`. **There is no self-registration.**
Accounts are created only by an admin (see below).

## 5. Creating accounts & managing model access

Two ways to manage users — pick whichever's convenient:

### A) Admin panel (web UI)

Log in as a user with `ADMIN` role, then visit `/admin` (also linked in the sidebar).
From there you can:
- Create new users (name, email, password, role, and which models they can use)
- Toggle model access per user with one click
- Change a user's role
- Delete a user

You need at least one ADMIN account to get started — create the first one via CLI:

```bash
npx tsx prisma/create-user.ts "Your Name" you@example.com yourpassword ADMIN
```

### B) CLI scripts

```bash
# Create a brand new user
npx tsx prisma/create-user.ts "Budi" budi@example.com secret123
npx tsx prisma/create-user.ts "Budi" budi@example.com secret123 BASIC gemini-2.5-flash-lite
npx tsx prisma/create-user.ts "Admin" admin@example.com secret123 ADMIN

# Grant/replace model access for an EXISTING user
npx tsx prisma/grant-access.ts user@example.com openrouter-free nvidia-nemotron
npx tsx prisma/grant-access.ts user@example.com all     # every model
npx tsx prisma/grant-access.ts user@example.com admin   # promote to ADMIN
```

New accounts created without specifying models default to **no model access** —
grant at least one before the user can chat. `ADMIN` role always has access to
every model regardless of `ModelAccess` rows.

The model dropdown (`/api/models`) only shows models the logged-in user has access to.

## 6. Architecture notes

- **Auth**: NextAuth v5 (Credentials), JWT sessions. `src/middleware.ts` redirects
  unauthenticated requests to `/login`. No self-registration — accounts are
  created by an admin only (web panel or CLI).
- **Admin**: `/admin` (page) and `/api/admin/*` (routes) are gated to `role === "ADMIN"`
  both in `src/middleware.ts` and again inside each API route via
  `src/lib/require-admin.ts` (defense in depth).
- **RBAC**: `ModelAccess` maps `userId -> modelId`, enforced server-side in
  `src/app/api/chat/route.ts` before any provider call — the dropdown is UX only,
  not the security boundary.
- **Providers**: `src/lib/providers/{gemini,openrouter,nvidia}.ts` normalize each
  provider's stream into a plain `ReadableStream` of text.
- **Web search**: Tavily results are injected as a `system` message ahead of the
  user's question when "Search the web" is toggled on (`src/lib/search.ts`).
- **Design system**: all colors in `src/app/globals.css` are grayscale CSS
  variables — no hue anywhere. `data-theme="light"` on `<html>` gives the light variant.

## 7. Known follow-ups

- Admin UI for granting `ModelAccess` (currently CLI-only via `grant-access.ts`)
- Password reset flow
- Per-user/model rate limiting
- Message editing/regeneration
- Nemotron's `reasoning_content` is currently stripped, only final answer streams —
  see comment in `src/lib/providers/openai-compatible.ts` to surface it in UI.
