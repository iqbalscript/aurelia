# AURELIA

Read `AGENTS.md` before making changes. It contains the project architecture, security boundaries, Prisma workflow, and required validation commands.

Quick context: AURELIA is a private multi-provider AI chat app built with Next.js 16, React 19, NextAuth, Prisma, and SQLite. It offers authenticated streaming chat, optional web search, uploads, user memories, and role-based administration.

Important:

- Use `src/proxy.ts` for request authorization; `middleware.ts` is deprecated in Next.js 16.
- Keep API keys and database operations server-side.
- Authenticate and ownership-scope every data access.
- After Prisma schema changes, run `npx prisma generate` and migrate as appropriate.
- Validate changes with `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
