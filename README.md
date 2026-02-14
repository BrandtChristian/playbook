# Forge — Email Marketing for the Rest of Us

> **Hackathon Problem Statement #1: Build a Tool That Should Exist**
> Create the AI-native app or workflow you wish someone had already built. Eliminate busywork. Make hard things effortless.

Built in 4 days for the [Built with Opus 4.6: a Claude Code Hackathon](https://cv.inc/e/claude-code-hackathon) (Feb 11–16, 2026).

---

## The Problem

Small businesses know email marketing works. But the tools available to them are either enterprise-grade labyrinths (HubSpot, Mailchimp's 47 menu items) or bare-bones APIs that require a developer. There's a gap: a platform that guides non-technical users through proven email strategies with AI doing the heavy lifting on content — so they go from signup to sending in minutes, not days.

## What Forge Does

**Forge** is a full marketing automation platform that combines guided email flows, a visual drag-and-drop email builder, and AI-powered content generation to make email marketing effortless.

The demo narrative tells the story:

> Small business signs up. Creates a flow from a template — "Welcome Series", "Monthly Newsletter", "Win-back Campaign". AI helps write the subject lines and body copy. They're sending emails in minutes.

---

## Features

### Visual Email Builder
Drag-and-drop block editor with 11 block types: heading, text, button, image, divider, spacer, social links, columns, blockquote, video, and raw HTML. Split-pane view with live preview rendered through React Email. Full brand customization (colors, logo, footer).

### AI Content Assistant
Powered by Claude Sonnet 4.5. Four generation modes:
- **Generate subject lines** — produces 3 options to choose from
- **Generate email body** — full HTML email from a prompt
- **Improve content** — revise and refine existing copy
- **Improve block** — targeted revision of a single block in the visual builder

Also: AI-generated alt text for images (accessibility) and brand color extraction from uploaded logos.

### Flow Designer
Visual journey builder with a vertical timeline UI. Compose marketing automations by chaining nodes:
- **Trigger** — segment entry or scheduled (once/hourly/daily/weekly/monthly)
- **Send Email** — reference an email, create one inline, or edit without leaving the flow
- **Delay** — configurable wait between steps
- **Exit** — end the journey with a reason

5 pre-built flow templates (Welcome Series, Newsletter, Win-back, Promotional Blast, Onboarding Drip) with contextual hints that guide setup without being prescriptive.

### Dynamic Segments
Filter-based segments with AND/OR logic trees and nested groups. Three condition sources:
- Contact fields (name, email, company, etc.)
- Custom fields (org-defined attributes)
- Relational data (with aggregations: exists, count, sum, min, max)

Resolved server-side via Postgres RPC functions.

### Team Management
Invite team members by email with magic link auth. Three roles (owner > admin > member). Per-member segment access restrictions. Full invitation lifecycle (create, resend, expire, accept).

### Consent & Preferences
GDPR-ready consent management with versioned consent types, per-contact consent records, and a full audit trail. Public preference center and one-click unsubscribe pages with secure token-based access.

### Everything Else
- **Contacts** — CSV import with auto-column detection, manual add, custom fields
- **Templates** — reusable design starting points, system-seeded gallery
- **Emails** — individual messages built from templates with their own subject and body
- **Campaigns** — send to segments with per-contact Liquid variable rendering, test sends, delivery stats
- **Brand builder** — visual brand config (colors, logo, footer text) applied to all emails
- **Dark mode** — full dark mode support across the entire UI
- **Onboarding** — multi-step modal flow that adapts to profile completeness
- **Data tables** — custom relational data (one-to-many, global) for advanced segmentation
- **Rate limiting** — sliding-window rate limiter on AI endpoints
- **Image uploads** — to Supabase Storage with CDN delivery

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Database & Auth | Supabase (Postgres + Auth + RLS + Storage) |
| UI | shadcn/ui + Radix + Tailwind v4 + Phosphor Icons |
| Email Sending | Resend (per-org API key) |
| Email Rendering | React Email |
| Templating | LiquidJS |
| AI | Claude Sonnet 4.5 via OpenRouter |
| Drag & Drop | dnd-kit |
| Animation | Motion (Framer Motion) |
| Hosting | Vercel |

---

## Built With Claude Code

This project was built almost entirely through [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's agentic coding tool running in the terminal.

**35 commits over 4 days**, one developer, one AI agent. The workflow:

- **`CLAUDE.md`** as the single source of truth — every conversation starts by reading the project plan, recent git history, and accumulated debugging knowledge
- **`PROJECT_PLAN.md`** with day-by-day sprint tracking — Claude reads this first to understand scope and avoid regressions
- **`LEARNINGS.md`** as institutional memory — gotchas, debugging insights, and patterns discovered during development get logged here and read at the start of every session
- **Supabase MCP** for database schema management — migrations applied directly through Claude Code's MCP integration rather than local CLI
- **No tests, build is the safety net** — `npm run build` catches type errors before any change is considered done

The result: 22 database tables with full RLS, 14 API routes, a visual email builder, an AI content pipeline, a flow designer, team management, consent system, and more — from `create-next-app` to production deployment in under a week.

---

## Architecture

### Auth Flow
Signup → Supabase auth trigger auto-creates org + profile → `proxy.ts` refreshes session and redirects → server components use `getCurrentUser()` (React `cache()` deduped) → RLS handles data isolation. Invited users join existing orgs via magic link with hashed tokens.

### Email Pipeline
1. User builds email in the visual block editor or code editor with Liquid variables
2. On send, LiquidJS renders variables per-contact (`{{ first_name }}`, `{{ company }}`, etc.)
3. Content is wrapped in React Email base layout (branded header, footer, unsubscribe links)
4. Sent via Resend API using the org's stored API key

### AI Pipeline
Claude Sonnet 4.5 (via OpenRouter) with a marketing-tuned system prompt that enforces Liquid variable syntax, HTML output, and concise tone. Rate limited at 20 requests per 60 seconds per user.

### Data Access
All 22 tables have row-level security scoped to `org_id`. Three RLS helper functions (`get_user_org_id()`, `is_admin()`, `can_access_segment()`) enforce isolation at the Postgres level — the application never handles authorization logic directly.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [OpenRouter](https://openrouter.ai) API key (for AI features)

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENROUTER_API_KEY=your_openrouter_key
NEXT_PUBLIC_SIGNUP_CODE=your_signup_code
```

Optional:
```env
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=example.com,company.org
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

Note: Resend API keys are per-org and configured through the Settings UI, not environment variables.

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Setup

The schema requires running the SQL migrations in `supabase/migrations/` against your Supabase project. Additional schema (seed data, custom fields, data tables, dynamic segments, consent system) was applied via Supabase MCP during development — see `PROJECT_PLAN.md` for the full database section.

---

## Project Structure

```
app/
  (auth)/          Auth pages (login, signup, OAuth callback, magic link)
  (dashboard)/     All protected pages (sidebar + header layout)
  api/             14 API routes (AI, send, upload, invites, segments, etc.)
  preferences/     Public preference center
  unsubscribe/     Public one-click unsubscribe
components/
  ui/              30+ shadcn components
  email-builder/   Visual drag-and-drop block editor
  flows/           Flow designer (timeline, nodes, properties)
  segment-builder/ Dynamic filter condition builder
  onboarding/      Multi-step onboarding flow
  data-management/ Custom fields + data tables
lib/
  auth/            Data access layer (getCurrentUser, requireAdmin)
  email/           React Email layout + block serialization
  flows/           Flow types + node definitions
  segments/        Filter types + operators
  supabase/        Client factories (browser, server, service role)
  ai.ts            Claude client + system prompt
  liquid.ts        LiquidJS engine + sample data
  resend.tsx       Resend client + email rendering
```

---

## Hackathon Context

| | |
|---|---|
| **Event** | [Built with Opus 4.6: a Claude Code Hackathon](https://cv.inc/e/claude-code-hackathon) |
| **Dates** | February 11–16, 2026 |
| **Team** | Solo — [Christian Brandt](https://github.com/BrandtChristian) |
| **Problem** | #1 — Build a Tool That Should Exist |
| **Built with** | Claude Code + claude-opus-4.6 |
| **Commits** | 35 |
| **Started from** | `create-next-app` (zero prior work) |

---

## License

[MIT](LICENSE)
