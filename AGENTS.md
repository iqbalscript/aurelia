# AURELIA agent guide

## Product

AURELIA (Adaptive Unified Reasoning Engine for Learning, Intelligence, and Assistance) is a private, authenticated AI chat application. It supports per-user model access, streamed provider responses, optional web grounding, document/image attachments, persistent conversation history, user memories, and an admin console.

## Stack and layout

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- NextAuth v5 credentials authentication with JWT sessions.
- Prisma 6 with SQLite locally (`prisma/dev.db`).
- Provider adapters for Gemini, DeepSeek, and NVIDIA NIM; Tavily for optional search.
- `src/app`: pages and API route handlers.
- `src/components`: client-side UI.
- `src/lib`: auth, Prisma singleton, providers, search, attachments, memory extraction, and shared domain logic.
- `prisma/schema.prisma`: source of truth for database models and relations.
- `src/proxy.ts`: request authorization/proxy convention for Next.js 16. Do not reintroduce `middleware.ts`.

## Core rules

- Keep provider credentials and database access server-only. Never expose `.env` values to client components.
- Every API handler must authenticate first. Scope conversation and memory queries to `session.user.id`; use `requireAdmin()` for admin operations.
- The model registry (`src/lib/providers/registry.ts`) is the source of truth for model IDs. Enforce model access on the server, not only in the UI.
- Preserve the streaming contract of `POST /api/chat`: it returns a plain UTF-8 text stream and persists the final assistant response.
- Preserve the dark-first grayscale design tokens in `src/app/globals.css` unless the task specifically changes the visual system.
- Use `proxy.ts`, not the deprecated Next.js `middleware.ts` convention.

## Prisma workflow

When changing `prisma/schema.prisma`, create a migration and regenerate the client:

```powershell
npx prisma migrate dev --name describe-change
npx prisma generate
```

`npm install` also runs `prisma generate`. If Prisma generation reports a locked Windows query-engine file, stop the local Next dev process, run generation, then restart it.

## Validation

Run the smallest relevant check, then before handoff run:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

## Next.js 16 requirement

This is not the Next.js you may remember. Before modifying Next.js-specific code, read the relevant guide under `node_modules/next/dist/docs/` and follow its deprecation guidance.
