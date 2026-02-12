# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## First Steps — Read This Every Conversation

This is a **5-day hackathon project** (Anthropic hackathon). Speed and demo-readiness matter more than perfection. At the start of every new conversation:

1. **Read `PROJECT_PLAN.md`** — it contains the full sprint plan with day-by-day status (Days 1-4 DONE, Day 5 is demo prep + deploy). Check what's marked TODO vs DONE to understand current priorities.
2. **Check `git log --oneline -5`** — see what was just shipped so you don't duplicate or regress recent work.
3. **Understand the demo narrative**: "Small business signs up → platform shows playbooks → AI helps write content → sending emails in minutes, not days." Every change should serve this story.

### Hackathon Priorities

- **Demo polish over engineering**: Loading states, empty states, error toasts, and responsive layout matter more than abstracting code.
- **Don't break what works**: Days 1-4 built a full working pipeline (auth → contacts → templates → playbooks → AI → campaigns → send). Protect this flow.
- **Vercel deployment**: The app deploys to Vercel. Run `npm run build` to catch errors before suggesting changes are done — there are no tests, so the build is the safety net.
- **Supabase MCP**: Database schema changes and seed data are applied via the Supabase MCP tools (not local CLI). Migrations live in `supabase/migrations/` for reference but were applied through MCP.

## Learning from mistakes
Whenever we encounter something, that didn't work as expected - difficulty querying SQL, a test not launching, whatever, note it in a LEARNINGS.md file in root, and ensure you read it every time we start a fresh conversation, to ensure we learn from mistakes and keep becoming more intelligent.

## Commands

```bash
npm run dev      # Start dev server (Next.js 16)
npm run build    # Production build
npm run lint     # ESLint (flat config, no args needed)
npm start        # Start production server
```

No test framework is configured. No `src/` directory — all code lives at the repo root (`app/`, `lib/`, `components/`, `hooks/`).

## Architecture

Marketing automation platform built on **Next.js 16 App Router + Supabase + Resend + Claude AI**. This is a full platform (Model B) — Resend is the sending infrastructure under the hood; users never interact with Resend directly.

### Route Groups

- `(auth)/` — Login, signup, OAuth callback. Centered layout, no sidebar.
- `(dashboard)/` — All protected pages. Sidebar + header layout. Server components fetch user via `getCurrentUser()` from `lib/auth/dal.ts`, then render a `*-client.tsx` component with data props.

### Auth & Data Access

- **`proxy.ts`** — Next.js 16 proxy (replaces middleware.ts). Refreshes Supabase session on every request, redirects unauthenticated users.
- **`lib/auth/dal.ts`** — `getCurrentUser()` (React `cache()`-wrapped) returns profile + org data. `requireAdmin()` guards admin-only actions. All server components use this.
- **Auth trigger** (`003_auth_trigger.sql`) — On signup, auto-creates an `organizations` row and a `profiles` row (role: owner).
- **RLS** — All tables have row-level security scoped to `org_id`. Data isolation is handled by Postgres, not application code.

### Email Pipeline

1. **Liquid templating** (`lib/liquid.ts`) — User-facing `{{ variable }}` syntax. Variables: `first_name`, `last_name`, `email`, `company`, `phone`, `job_title`, `city`, `country` + custom contact `data` fields.
2. **React Email layout** (`lib/email/base-layout.tsx`) — Wraps all emails with branded header, content, footer, and unsubscribe link. `BrandConfig` controls colors/logo.
3. **Resend sending** (`lib/resend.tsx`) — `getResendClient(apiKey)`, `renderEmail()`, `renderTestEmail()`. API key is per-org (stored in `organizations` table, NOT env vars).
4. **Send flow** (`/api/send`) — Fetches segment contacts, renders Liquid per-contact, creates preference token for unsubscribe, wraps in React Email layout, sends via Resend.

### AI Content Generation

- **`lib/ai.ts`** — Anthropic client using `claude-sonnet-4-5-20250929`. System prompt enforces Liquid variables, HTML output, concise marketing tone.
- **`/api/ai/generate`** — Three modes: `subject` (3 subject lines), `body` (full HTML email), `improve` (revise existing content).
- **`components/ai-content-panel.tsx`** — UI panel wired into the template editor.

### Playbook System

Five system-seeded playbooks with 12 templates. Wizard flow: Configure (name + segment) → Review Emails (preview sequence) → Launch (create draft campaigns). Playbooks and templates are seeded via Supabase MCP, not migration files.

### Database

Supabase Postgres with migrations in `supabase/migrations/`. Key tables: `organizations`, `profiles`, `contacts`, `segments`, `segment_contacts`, `templates`, `playbooks`, `campaigns`, `preference_tokens`. Schema changes go through `supabase/migrations/` or Supabase MCP `apply_migration`.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

Resend API key is per-org in the database.

## Local Documentation

`docs/` contains offline guides and OpenAPI specs for the full tech stack. Prefer reading these over web searches:

- `docs/nextjs-docs/` — Next.js 16 App Router guides
- `docs/supabase-docs/` — Supabase Auth, RLS, client libraries
- `docs/resend-docs/` — Resend API (emails, domains, contacts, broadcasts, webhooks) + OpenAPI spec
- `docs/react-email-docs/` — React Email components and render utilities
- `docs/shadcn-docs/` — shadcn/ui component usage and theming
- `docs/agillic-docs/` — Agillic API reference (competitor research)
- `docs/mailchimp-docs/` — Mailchimp OpenAPI specs (competitor research)

## Conventions

- **shadcn/ui theme**: Maia style, Radix base, stone base color, orange accent, Phosphor icons, DM Sans font, zero border radius.
- **Component pattern**: Server page fetches data via `getCurrentUser()` + Supabase queries, passes to a `"use client"` component (e.g., `contacts-client.tsx`, `campaigns-client.tsx`).
- **Path alias**: `@/*` maps to repo root.
- **Next.js 16**: Proxy file is `proxy.ts` (not `middleware.ts`), exported function is `proxy` (not `middleware`).
- **Tailwind v4**: Config is in `app/globals.css` via `@theme` block, not `tailwind.config.ts`.
