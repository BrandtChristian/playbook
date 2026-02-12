# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## First Steps — Read This Every Conversation

This is a **5-day hackathon project** (Anthropic hackathon). Speed and demo-readiness matter more than perfection. At the start of every new conversation:

1. **Read `PROJECT_PLAN.md`** — it contains the full sprint plan with day-by-day status (all 5 days DONE). Check the directory structure and database sections to understand the full scope.
2. **Check `git log --oneline -5`** — see what was just shipped so you don't duplicate or regress recent work.
3. **Read `LEARNINGS.md`** — accumulated debugging knowledge and gotchas.
4. **Understand the demo narrative**: "Small business signs up -> creates a flow from a template -> AI helps write content -> sending emails in minutes, not days." Every change should serve this story.

### Priorities

- **Don't break what works**: All 6 days of features are built and working (auth -> onboarding -> contacts -> templates -> email builder -> flows -> AI -> campaigns -> send -> team -> segments -> data management -> preferences).
- **Vercel deployment**: The app deploys to Vercel. Run `npm run build` to catch errors before suggesting changes are done — there are no tests, so the build is the safety net.
- **Supabase MCP**: Database schema changes and seed data are applied via the Supabase MCP tools (not local CLI). 5 migration files in `supabase/migrations/` + 12 more applied directly through MCP.

## Learning from mistakes

Whenever we encounter something that didn't work as expected, note it in `LEARNINGS.md` in root, and ensure you read it every time we start a fresh conversation.

## Commands

```bash
npm run dev      # Start dev server (Next.js 16)
npm run build    # Production build
npm run lint     # ESLint (flat config, no args needed)
npm start        # Start production server
```

No test framework is configured. No `src/` directory — all code lives at the repo root (`app/`, `lib/`, `components/`, `hooks/`).

## Architecture

Marketing automation platform built on **Next.js 16 (App Router) + React 19 + Supabase + Resend + Claude AI**. This is a full platform (Model B) — Resend is the sending infrastructure under the hood; users never interact with Resend directly.

### Route Groups

- `(auth)/` — Login, signup, OAuth callback, magic link accept. Centered layout, no sidebar.
- `(dashboard)/` — All protected pages. Sidebar + header layout. Server components fetch user via `getCurrentUser()` from `lib/auth/dal.ts`, then render a `*-client.tsx` component with data props.
- `preferences/` and `unsubscribe/` — Public pages (no auth required) for contact email preference management.

### Auth & Data Access

- **`proxy.ts`** — Next.js 16 proxy (replaces middleware.ts). Refreshes Supabase session on every request, redirects unauthenticated users. Public paths: `/login`, `/signup`, `/auth/*`, `/preferences`, `/unsubscribe`, `/api/preferences`.
- **`lib/auth/dal.ts`** — `getCurrentUser()` (React `cache()`-wrapped) returns profile + org data (including `brand_config`, `seen_flows`, `job_title`, `preferred_test_email`). `requireAdmin()` guards admin-only actions. All server components use this.
- **Auth trigger** (`003_auth_trigger.sql` / `008_invitations_and_trigger_update.sql`) — On signup, auto-creates org + profile (role: owner). If user was invited (`invited_org_id` in metadata), joins existing org with assigned role instead.
- **RLS** — All 22 tables have row-level security scoped to `org_id`. Helper functions: `get_user_org_id()`, `is_admin()`, `can_access_segment()`. Data isolation is handled by Postgres, not application code.
- **Signup lockdown** — `NEXT_PUBLIC_SIGNUP_CODE` env var required. No code = signup blocked. Validated in `lib/invite-code.ts`.
- **Email domain restriction** — Optional `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` env var restricts signup to specific domains.

### Email Pipeline

1. **Visual email builder** (`components/email-builder/`) — Block-based drag-and-drop editor. 11 block types: heading, text, button, image, divider, spacer, social, columns, quote, video, HTML. Serialization via `lib/email/blocks.ts`.
2. **Liquid templating** (`lib/liquid.ts`) — User-facing `{{ variable }}` syntax. Variables: `first_name`, `last_name`, `email`, `company`, `phone`, `job_title`, `city`, `country` + custom contact `data` fields.
3. **React Email layout** (`lib/email/base-layout.tsx`) — Wraps all emails with branded header, content, footer, unsubscribe + preferences links. `BrandConfig` controls colors/logo/footer text.
4. **Social icons** — Hosted in Supabase Storage CDN (`email-images` bucket) for reliable email delivery. Four styles: color, grey, black, white.
5. **Image uploads** (`/api/upload`) — Upload to Supabase Storage, URL returned for use in email blocks.
6. **Resend sending** (`lib/resend.tsx`) — `getResendClient(apiKey)`, `renderEmail()`, `renderTestEmail()`. API key is per-org (stored in `organizations` table, NOT env vars).
7. **Send flow** (`/api/send`) — Fetches segment contacts, renders Liquid per-contact, creates preference token for unsubscribe, wraps in React Email layout, sends via Resend.

### AI Features

- **`lib/ai.ts`** — Anthropic client using `claude-sonnet-4-5-20250929`. System prompt enforces Liquid variables, HTML output, concise marketing tone.
- **`/api/ai/generate`** — Four modes: `subject` (3 subject lines), `body` (full HTML email), `improve` (revise content), `improve-block` (revise single block).
- **`/api/ai/alt-text`** — Generate accessible alt text for images using Claude vision.
- **`/api/ai/brand`** — Extract brand colors from logo URL.
- **`components/ai-content-panel.tsx`** — UI panel wired into the template editor.
- **`components/email-builder/ai-prompt-bar.tsx`** — AI generation bar in visual builder.
- **Rate limiting** (`lib/rate-limit.ts`) — In-memory sliding-window, 20 requests per 60 seconds per user.

### Template / Email Separation

- **Templates** (`templates` table) — Reusable design starting points. System-seeded + user-created. No subject required (subject belongs to emails). Sidebar icon: `Layout`.
- **Emails** (`emails` table) — Individual messages built FROM a template, with own subject + body_html. Referenced by campaigns and flow nodes. Created via "New Email" -> pick template -> name + subject -> editor. Sidebar icon: `Envelope`.
- **TemplateEditor** (`components/template-editor.tsx`) — Shared editor for both. `saveTable` prop controls whether it saves to `templates` or `emails` table.
- **Campaigns** now reference `email_id` (not `template_id`). Content is still snapshot-copied at campaign creation time.

### Flow Designer

- **`flows` + `flow_nodes` tables** — Flow definitions with trigger_config JSONB + ordered nodes with type + config JSONB.
- **Trigger types**: `segment_entry` (contacts entering a segment start the flow) or `schedule` (once/hourly/daily/weekly/monthly runs against a segment). Re-entry with optional cooldown delay in days.
- **Node types**: trigger, send_email (email_id reference), delay (duration + unit), exit (reason). Future: condition, A/B split.
- **UI** (`components/flows/`) — Vertical timeline editor with node cards, connector lines, "+" insert buttons, properties panel. Auto-save with debounce. Status toggle (draft/active/paused).
- **Inline email workflow** — From Send Email node properties: select existing email, create new email from template, or edit selected email (opens full TemplateEditor overlay).
- **Types** — `lib/flows/types.ts` (FlowNode, Flow, TriggerConfig, SendEmailConfig, NODE_PALETTE, summarizeNode).

### Flow Templates (formerly Playbooks)

Playbooks have been merged into the Flow Designer as "Flow Templates." The dedicated `/playbooks` page is gone (redirects to `/flows`). When creating a new flow, users see a name input first, then an optional "Or start from a template" section with 5 system-seeded templates (Welcome Series, Monthly Newsletter, Win-back, Promotional Blast, Onboarding Drip). Selecting a template pre-populates the flow with the right node structure (trigger + send_email + delay nodes) and stores contextual hints in each node's JSONB config (`segment_hint` on trigger, `hint` on send_email/delay nodes). The flow editor surfaces these hints on unconfigured node cards, in the properties panel, and via a "Suggested setup" checklist banner at the top of the timeline. Hints disappear once nodes are configured. Playbook data still lives in the `playbooks` table (read-only, seeded via Supabase MCP).

### Team & Permissions

- **Invitations** (`/api/invites`) — POST (create), PATCH (resend), DELETE (remove). Magic link auth with hashed tokens (prevents email scanner issues).
- **Roles**: owner > admin > member. Owner can remove members. Admin+ can invite and manage segment access.
- **Segment access control** (`/api/segment-access`) — Restrict which segments specific members can see. `user_segment_access` table + `can_access_segment()` RLS function.

### Dynamic Segments

- **Filter rules** — AND/OR logic trees with nested groups. Three condition sources: contact fields, custom fields, relational data (with aggregations: exists, count, sum, min, max).
- **Segment builder** (`components/segment-builder/`) — Visual UI with field picker, operator selector, value inputs.
- **Resolution** — Server-side via Postgres RPC functions (`resolve_segment_contacts`, `preview_segment_filter`).
- **Types** — `lib/segments/types.ts` (FilterCondition, FilterGroup, ConditionSource, CustomFieldDefinition, DataTableDefinition), `lib/segments/operators.ts` (OPERATORS_BY_TYPE).

### Data Management

- **Custom fields** (`custom_field_definitions`) — Org-specific contact attributes. Types: text, number, boolean, date, select.
- **Data tables** (`data_table_definitions` + `data_table_columns` + `data_table_rows`) — One-to-many or global tables with custom columns. Used in segment conditions for relational filtering.
- **UI** — `app/(dashboard)/data/` page with `components/data-management/` (custom-fields-manager, data-tables-manager).

### Consent & Preferences

- **Consent system** — `consent_types`, `contact_consents`, `consent_audit_log`, `consent_type_versions` tables. Full audit trail.
- **Preference center** — Public page at `/preferences/[token]` for contacts to manage email preferences.
- **Unsubscribe** — Public page at `/unsubscribe/[token]` for one-click unsubscribe.
- **Tokens** — `preference_tokens` table with secure hashed tokens for URL access.

### Onboarding

- **Flow system** (`lib/onboarding/`) — Extensible flow definitions. Steps resolved dynamically based on profile completeness (missing name, job title, test email).
- **UI** (`components/onboarding/`) — `FlowProvider` (context + state) -> `FlowModal` (animated modal) -> step components (welcome, name, job-title, test-email, ready).
- **Tracking** — `seen_flows` JSONB column on `profiles` table. `/api/onboarding/complete` marks flows as seen.

### Database

Supabase Postgres with 22 tables. 5 migration files in `supabase/migrations/`, 14+ more applied via Supabase MCP. Key tables: `organizations`, `profiles`, `contacts`, `segments`, `segment_contacts`, `templates`, `emails`, `playbooks`, `campaigns`, `flows`, `flow_nodes`, `invitations`, `user_segment_access`, `custom_field_definitions`, `data_table_definitions`, `data_table_columns`, `data_table_rows`, `consent_types`, `contact_consents`, `consent_audit_log`, `consent_type_versions`, `preference_tokens`.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_SIGNUP_CODE                # required: invite code for signup (no code = signup blocked)
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS     # optional: comma-separated domain allowlist
NEXT_PUBLIC_APP_URL                    # optional: app URL for email links
```

Resend API key is per-org in the database.

## Local Documentation

`docs/` contains offline guides and OpenAPI specs for the full tech stack. Prefer reading these over web searches:

- `docs/nextjs-docs/` — Next.js 16 App Router guides
- `docs/supabase-docs/` — Supabase Auth, RLS, client libraries
- `docs/resend-docs/` — Resend API (emails, domains, contacts, broadcasts, webhooks) + OpenAPI spec
- `docs/react-email-docs/` — React Email components and render utilities
- `docs/shadcn-docs/` — shadcn/ui component usage and theming

## Conventions

- **Product name**: **Forge** (by Dwarf). Sidebar shows "F" lettermark + "Forge" text.
- **shadcn/ui theme**: Maia style, Radix base, stone base color, **indigo accent** (`oklch(0.511 0.262 266)`, hex `#6366f1`), Phosphor icons, DM Sans font, zero border radius.
- **Dark mode**: Enabled via `next-themes` (`ThemeProvider` in `app/layout.tsx`). Toggle button in dashboard header (Sun/Moon icons). Theme colors defined for both `:root` and `.dark` in `globals.css`. Custom components use `dark:` Tailwind variants for hardcoded colors.
- **Component pattern**: Server page fetches data via `getCurrentUser()` + Supabase queries, passes to a `"use client"` component (e.g., `contacts-client.tsx`, `campaigns-client.tsx`).
- **Path alias**: `@/*` maps to repo root.
- **Next.js 16**: Proxy file is `proxy.ts` (not `middleware.ts`), exported function is `proxy` (not `middleware`).
- **Tailwind v4**: Config is in `app/globals.css` via `@theme` block, not `tailwind.config.ts`.
- **Dependencies**: React 19, Next.js 16.1.6, dnd-kit (drag-and-drop), Motion (animation), Phosphor Icons, Sonner (toasts), sharp (image processing).
- **Supabase server client**: `createClient()` from `lib/supabase/server.ts` is async — must be `await`ed. Also aliased as `createServerClient` in some files.
- **Service role client**: Used in `/api/invites` for admin operations (create users, generate magic links). Import `getServiceClient` from `lib/supabase/server.ts` or construct with `SUPABASE_SERVICE_ROLE_KEY`.
