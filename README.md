# AURELIA

**A**daptive **U**nified **R**easoning **E**ngine for **L**earning, **I**ntelligence, and **A**ssistance.

AURELIA is a private, multi-provider AI chat application built with Next.js 16. It provides authenticated streaming chat, per-user model access, profile-aware replies, persistent long-term memory, optional live-web grounding, file attachments, and a built-in admin console.

The interface is intentionally grayscale and dark-first, with a light-theme token set available in the global stylesheet.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology](#technology)
- [Providers and models](#providers-and-models)
- [Authentication and authorization](#authentication-and-authorization)
- [Data model](#data-model)
- [Request flows](#request-flows)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Administration](#administration)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Development](#development)
- [Production notes](#production-notes)
- [Current limitations](#current-limitations)

## Features

- Credentials-based sign-in; public self-registration is deliberately disabled.
- Role-based access control with `BASIC`, `PREMIUM`, and `ADMIN` roles.
- Server-enforced allowlist for the AI models each non-admin user may use.
- Three streaming model integrations: Google Gemini, DeepSeek, and NVIDIA NIM.
- Persistent user-owned conversations and messages stored with Prisma.
- Per-user profile settings for a preferred name and how AURELIA should address that user—no shared hard-coded user identity.
- Long-term per-user memory: AURELIA extracts durable facts from conversations, retrieves relevant memories for each message, and lets users edit or remove them.
- Optional Tavily web search that grounds the latest question with fresh results.
- Attach images, PDFs, DOCX files, and plain-text documents directly to a message (up to 15 MB per file).
- Vision support for image attachments with Swift (Gemini); non-vision models clearly disclose that they cannot inspect images.
- Long pasted text is converted into a named Markdown attachment instead of overwhelming the composer.
- Large code blocks can open in a side canvas for easier reading.
- Admin UI to create users, change roles, grant/revoke model access, and delete accounts.
- CLI helpers for bootstrapping the first administrator and assigning access.
- Centralized AURELIA persona and safety prompt applied to every chat request.

## Architecture

```text
Browser (React client components)
  │
  ├── NextAuth session ───────────────────────────────┐
  ├── /api/conversations ────────────────┐            │
  ├── /api/models ───────────────────────┤            │
  ├── /api/chat (streaming text) ────────┤            │
  ├── /api/profile + /api/memories ──────┤            │
  └── /api/admin/* (administrators) ─────┤            │
                                           ▼            ▼
                              Next.js App Router route handlers
                                           │
                 ┌─────────────────────────┼─────────────────────────┐
                 ▼                         ▼                         ▼
          NextAuth + JWT              Prisma client             Provider adapters
                 │                         │                         │
                 ▼                         ▼          ┌──────────────┼──────────────┐
              User role         SQLite / PostgreSQL   ▼              ▼              ▼
                                                   Gemini        DeepSeek      NVIDIA NIM

                                        Optional: Tavily search → system grounding
```

The application uses the Next.js App Router. Pages and interactive UI live under `src/app` and `src/components`; route handlers in `src/app/api` are the server boundary. The browser never receives AI-provider API keys or accesses the database directly.

### Layers

| Layer | Responsibility |
| --- | --- |
| UI | Chat composer, streamed-message display, model selector, profile and memory settings, sign-in page, and admin console. |
| Proxy/auth | `src/proxy.ts` redirects unauthenticated requests to sign-in and protects `/admin` and `/api/admin/*`. |
| API routes | Verify the session, enforce ownership/roles, persist profile and memory data, coordinate search, and return JSON or a text stream. |
| Domain libraries | Prisma singleton, authorization helpers, profile-aware system prompt, memory extraction/retrieval, Tavily integration, and provider registry. |
| Provider adapters | Convert Gemini and OpenAI-compatible SSE responses into a plain UTF-8 text stream for the UI. |
| Persistence | Prisma models for users, model permissions, conversations, and messages. |

## Technology

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4 and CSS design tokens in `src/app/globals.css`
- **Authentication:** NextAuth v5 beta with the Credentials provider and JWT sessions
- **Database ORM:** Prisma 6
- **Development database:** SQLite (`prisma/dev.db`)
- **Passwords:** bcryptjs hashes; plaintext passwords are never stored
- **Validation:** Zod for admin user create/update payloads
- **AI integrations:** Gemini REST API plus OpenAI Chat Completions-compatible DeepSeek and NVIDIA NIM endpoints
- **Search grounding:** Tavily Search API

## Providers and models

The model registry is the single source of truth for model identifiers, labels, providers, and upstream model names: [`src/lib/providers/registry.ts`](src/lib/providers/registry.ts).

| UI label | Permission ID | Provider | Upstream model |
| --- | --- | --- | --- |
| Swift | `gemini-3.1-flash-lite` | Google Gemini | `gemini-3.1-flash-lite` |
| Apex | `deepseek-v4-flash` | DeepSeek | `deepseek-chat` |
| Insight | `nvidia-nemotron` | NVIDIA NIM | `nvidia/nemotron-3-ultra-550b-a55b` |
| Auto | `auto` | Router | Chooses a registered model for the prompt |

To add a model, add it to the registry and implement/select a provider adapter as needed. Permission rows use the registry `id`, while `apiModel` is sent to the upstream provider.

## Authentication and authorization

### Sign-in

Authentication uses email and password credentials. During sign-in, the password is checked against its bcrypt hash, and the user ID and role are added to the JWT/session. The sign-in page is `/login`; all other application routes require a session.

There is no registration endpoint. Create users through the admin panel or the CLI bootstrap script.

### Roles and model access

| Role | Application access | Model access |
| --- | --- | --- |
| `BASIC` | Chat | Only models explicitly assigned in `ModelAccess` |
| `PREMIUM` | Chat | Only models explicitly assigned in `ModelAccess` |
| `ADMIN` | Chat and `/admin` | Every model in the registry, regardless of `ModelAccess` rows |

Model visibility in the selector is a convenience, not the security boundary. `POST /api/chat` independently checks the registry and the authenticated user's access before calling a provider. Admin routes are protected by both the authorization callback and `requireAdmin()` in each handler.

## Data model

```text
User (1) ──< ModelAccess >── (permission to registry model ID)
  ├──< Conversation (1) ──< Message
  └──< Memory
```

| Model | Purpose |
| --- | --- |
| `User` | Identity, email, bcrypt password hash, role, preferred name, addressing preferences, and creation timestamp. |
| `ModelAccess` | User-to-model allowlist; unique by `(userId, modelId)`. |
| `Conversation` | A user-owned chat title plus created/updated timestamps. Deleting a user cascades to its conversations. |
| `Message` | Stored user, assistant, or system message content, selected model, search flag, and timestamp. Deleting a conversation cascades to its messages. |
| `Memory` | A user-owned durable fact, its embedding, optional source conversation, and timestamps. Deleting a user cascades to their memories. |

The schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma). A conversation title is generated from its first persisted user message (first 48 characters).

## Request flows

### Chat and streaming

1. The UI extracts text from document attachments and prepares image attachments for the API. Long pasted text is attached as Markdown.
2. The UI creates a conversation if necessary and saves the user's message.
3. It calls `POST /api/chat` with the selected model, conversation ID, messages, optional images, and optional search flag.
4. The server authenticates the caller and verifies model access.
5. A centralized AURELIA system prompt is assembled with the signed-in user's profile preferences, so every account is addressed independently.
6. Relevant long-term memories are retrieved by embedding similarity and added as private context. Memory extraction runs in the background after the response starts streaming.
7. When web search is enabled, the latest user message is sent to Tavily and its compact results are added as another system message. If Tavily fails, chat continues without grounding.
8. Gemini receives image data directly. For non-vision models, images are removed and a system note instructs the model to explain the limitation and suggest Swift for image analysis.
9. The selected adapter calls the provider with streaming enabled and normalizes Server-Sent Events to a plain text `ReadableStream`.
10. The response stream is split: one branch reaches the browser immediately and the other is buffered and saved as the assistant message.

### Conversation ownership

Every conversation fetch, message create, and delete operation scopes the database query to the current `userId`. A signed-in user cannot retrieve or modify another user's conversation through these routes.

## Project structure

```text
src/
├── app/
│   ├── page.tsx                         # Main chat page
│   ├── login/page.tsx                   # Credentials sign-in page
│   ├── admin/page.tsx                   # User/model access management UI
│   ├── profile/page.tsx                 # Per-user naming and address preferences
│   ├── memory/page.tsx                  # Per-user long-term memory management
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # NextAuth handlers
│       ├── chat/route.ts                # Authorization, grounding, streaming, persistence
│       ├── extract-file/route.ts        # Attachment validation and text extraction
│       ├── profile/route.ts             # Current user's profile read/update
│       ├── memories/                    # Current user's memory CRUD
│       ├── models/route.ts              # Visible models for current user
│       ├── conversations/               # Conversation CRUD and user messages
│       └── admin/users/                 # Admin user management
├── components/                          # Chat UI, attachments, markdown, and canvas components
├── lib/
│   ├── auth.ts / auth.config.ts         # Credentials auth and route authorization
│   ├── db.ts                            # Reused Prisma client
│   ├── require-admin.ts                 # Admin-route helper
│   ├── search.ts                        # Tavily integration
│   ├── attachments.ts                   # Supported file types and attachment metadata
│   ├── system-prompt.ts                 # Persona, guardrails, and profile context
│   ├── embeddings.ts                    # Gemini embeddings and cosine similarity
│   ├── memory-extraction.ts             # Memory extraction and retrieval
│   └── providers/                       # Registry and streaming adapters
├── proxy.ts                              # Applies request authorization in Next.js 16
└── types/next-auth.d.ts                 # Session/JWT type extensions

prisma/
├── schema.prisma                         # Prisma schema and datasource
├── migrations/                           # Versioned database migrations
├── create-user.ts                        # First-user / CLI bootstrap helper
└── grant-access.ts                       # CLI model-access helper
```

## Getting started

### Prerequisites

- Node.js 20 or later is recommended.
- npm.
- API keys for every provider or feature you intend to enable.

### 1. Install dependencies

```bash
npm install
```

Prisma downloads its query engine during installation/generation. On a restricted network, allow access to `binaries.prisma.sh`.

### 2. Create the environment file

Create `.env` in the project root:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"

GEMINI_API_KEY=""
DEEPSEEK_API_KEY=""
NVIDIA_API_KEY=""
TAVILY_API_KEY=""
```

Generate a session secret, for example:

```bash
openssl rand -base64 32
```

See [Configuration](#configuration) for what each variable controls.

### 3. Generate Prisma Client and apply migrations

```bash
npx prisma generate
npx prisma migrate dev
```

This initializes the SQLite database configured by `DATABASE_URL` and applies the migrations in `prisma/migrations`.

### 4. Create the first administrator

Because registration is disabled, bootstrap an administrator from the command line:

```bash
npx tsx prisma/create-user.ts "Your Name" you@example.com a-strong-password ADMIN
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with the administrator account, and use `/admin` to create users and grant access.

Each user can then use **Profile** in the sidebar to set the name AURELIA should use and optional addressing preferences. Use **Memory** to inspect, edit, add, or delete that user's saved context.

## Administration

### Admin console

An `ADMIN` user can open `/admin` to:

- Create users with a name, email, password, role, and initial model access.
- Change a user's role.
- Add or remove model access for non-admin users.
- Delete any other user (self-deletion is rejected by the API).

Administrators automatically see and can use all registered models. Their stored `ModelAccess` rows are not needed for access.

### CLI helpers

Use these when bootstrapping or scripting administration:

```bash
# Create a basic user without model access
npx tsx prisma/create-user.ts "Budi" budi@example.com secret123

# Create a basic user with Swift access
npx tsx prisma/create-user.ts "Budi" budi@example.com secret123 BASIC gemini-3.1-flash-lite

# Create an administrator
npx tsx prisma/create-user.ts "Admin" admin@example.com secret123 ADMIN

# Add one or more model permissions to an existing user
npx tsx prisma/grant-access.ts budi@example.com deepseek-v4-flash nvidia-nemotron

# Grant all registered models
npx tsx prisma/grant-access.ts budi@example.com all

# Promote an existing user to administrator
npx tsx prisma/grant-access.ts budi@example.com admin
```

Users created without model IDs cannot chat until an administrator assigns at least one model (unless they are an `ADMIN`).

## API reference

All endpoints below require an authenticated session unless noted otherwise.

| Method | Route | Description |
| --- | --- | --- |
| `GET`, `POST` | `/api/auth/[...nextauth]` | NextAuth authentication handlers. |
| `GET` | `/api/models` | Returns models visible to the current user. |
| `POST` | `/api/chat` | Authorizes model use, optionally grounds with search, and streams plain text response chunks. |
| `POST` | `/api/extract-file` | Validates one attachment and returns extracted text or image base64 data. |
| `GET`, `PATCH` | `/api/profile` | Reads or updates the signed-in user's preferred name and addressing preferences. |
| `GET`, `POST` | `/api/memories` | Lists the signed-in user's memories or adds a memory. |
| `PATCH`, `DELETE` | `/api/memories/:id` | Updates or deletes a caller-owned memory. |
| `GET`, `POST` | `/api/conversations` | List the caller's conversations or create one. |
| `GET`, `DELETE` | `/api/conversations/:id` | Read a caller-owned conversation/messages or delete it. |
| `POST` | `/api/conversations/:id/messages` | Save a caller-owned user message and title a new conversation. |
| `GET`, `POST` | `/api/admin/users` | List users/model options or create a user; admin only. |
| `PATCH`, `DELETE` | `/api/admin/users/:id` | Update role/model access or delete a user; admin only. |

`POST /api/chat` accepts:

```json
{
  "conversationId": "optional-conversation-id",
  "modelId": "gemini-3.1-flash-lite",
  "useWebSearch": false,
  "messages": [
    {
      "role": "user",
      "content": "What is in this image?",
      "images": [{ "base64": "...", "mimeType": "image/png" }]
    }
  ]
}
```

Its successful response is `text/plain; charset=utf-8` streamed as response text, rather than JSON or an AI-SDK-specific protocol.

### Attachments

`POST /api/extract-file` accepts `multipart/form-data` with one `file` field. Supported formats are PNG, JPEG, WebP, GIF, PDF, DOCX, TXT, Markdown, CSV, and JSON. Images are returned as base64 for Gemini; documents are converted to plain text and included in the chat context. Files larger than 15 MB are rejected.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma datasource URL. The default points to SQLite. |
| `NEXTAUTH_SECRET` | Yes | Secret used to sign/verify JWT session data. Use a long, random production value. |
| `NEXTAUTH_URL` | Yes | Canonical public application URL, e.g. `https://chat.example.com`. |
| `GEMINI_API_KEY` | For Swift | Key for the Gemini adapter. |
| `DEEPSEEK_API_KEY` | For Apex | Key for the DeepSeek adapter. |
| `NVIDIA_API_KEY` | For Insight | Key for the NVIDIA NIM adapter. |
| `TAVILY_API_KEY` | For web search | Key used only when the user enables **Search the web**. |

Keep `.env` out of version control. It is ignored by the repository's `.gitignore`.

## Development

```bash
npm run dev      # Start Next.js development server
npm run lint     # Run ESLint
npm run build    # Create a production build
npm run start    # Serve a production build
```

When changing the Prisma schema, create and apply a migration, then regenerate the client:

```bash
npx prisma migrate dev --name describe-your-change
npx prisma generate
```

When introducing a model, update the registry first, then ensure the required environment key and adapter are present. Grant the new registry ID to appropriate users through `/admin` or `grant-access.ts`.

## Production notes

- **Database:** SQLite suits local development and small single-instance deployments. For a multi-instance or managed deployment, change Prisma's datasource provider to `postgresql`, set a PostgreSQL `DATABASE_URL`, generate a migration appropriate for the target database, and deploy it with Prisma's production migration workflow.
- **Secrets:** Set a unique, stable `NEXTAUTH_SECRET`, provider keys, and the production `NEXTAUTH_URL` in the deployment environment. Never expose provider keys to the client.
- **HTTPS:** Serve production traffic over HTTPS and use the public HTTPS URL for `NEXTAUTH_URL`.
- **Access control:** Keep at least one trusted administrator account. Admins have access to all models and can manage users.
- **Provider cost and limits:** Provider calls and Tavily searches can incur usage costs and have rate limits. Configure provider-side quotas, monitor usage, and add application-level rate limiting before broad public use.
- **Data retention:** Conversations and messages are retained until their conversation or owner is deleted. Define backups and retention policies for your deployment.

## Current limitations

- There is no password reset, email verification, MFA, or self-service registration flow.
- There is no application-level rate limiting, usage metering, token budget, or provider failover.
- The chat UI saves messages separately from the streamed response; a provider/network interruption can leave a conversation with a user message but no assistant reply.
- Automatic memory extraction requires `GEMINI_API_KEY`; it fails open, so chat continues if extraction or embeddings are unavailable.
- Tavily grounding is injected into context, but source URLs are not rendered as dedicated citations in the UI.
- NVIDIA reasoning-only deltas are intentionally omitted; the UI streams final answer content.
- Conversation titles are derived once from the first user message and are not editable in the UI.
- The repository currently contains no automated test suite.

## License

This repository does not currently declare a license. Add one before distributing or accepting external contributions.
