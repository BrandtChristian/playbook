# Marketing Automation Platform

## Vision

A marketing automation platform that uses Resend as sending infrastructure (under the hood) and guides small businesses through proven email marketing playbooks with AI-assisted content generation. Modern Liquid templating, beautiful UI, zero infrastructure decisions for the end user.

**Product direction:** Model B — we ARE the platform. Resend powers the infrastructure. Users never think about ESPs. The playbook system + AI content assistant is the hero feature.

**Demo narrative:**
> "Small business signs up. Platform shows them a playbook: 'Welcome Series', 'Monthly Newsletter', 'Win-back Campaign'. AI helps write the content. They're sending emails in minutes, not days."

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database & Auth:** Supabase (Postgres + Auth + RLS)
- **UI:** shadcn/ui (maia style, stone base, indigo theme, Phosphor icons, DM Sans, no radius, dark mode)
- **Email sending:** Resend (under the hood)
- **Templating:** LiquidJS (user-facing) + React Email (rendering)
- **AI:** Claude Sonnet 4.5 via Anthropic SDK
- **Hosting:** Vercel

---

## Day 1: Foundation — DONE

- [x] Next.js 16 scaffold with shadcn theme preset
- [x] Dependencies installed
- [x] Supabase client setup (browser, server, proxy middleware)
- [x] Auth proxy (`proxy.ts`) — redirects unauthed users, refreshes sessions
- [x] Data access layer (`lib/auth/dal.ts`) — `getCurrentUser()`, `requireAdmin()`
- [x] SQL migrations: schema (8 tables), RLS policies, auth trigger — applied via Supabase MCP
- [x] Auth pages: login, signup (with org name + full name), PKCE callback
- [x] Dashboard layout: sidebar nav, topbar, content area
- [x] Dashboard home: quick action cards, setup prompt for missing Resend key

## Day 2: Contacts + Templates + Settings — DONE

- [x] Settings page: Resend API key **connect flow** with domain picker (fetches domains from Resend API)
- [x] Domain status badges (verified/pending/not started), sender address derived from selected domain
- [x] Contact list page with table, status badges, delete
- [x] CSV import: file picker, auto-detect columns, upsert
- [x] Manual contact add via dialog form
- [x] Segment CRUD: create/delete segments, toggle contact membership
- [x] Template gallery: grid of template cards, create dialog
- [x] Template editor: split-pane — HTML+Liquid editor left, **React Email preview** right (via iframe)
- [x] Liquid helper (`lib/liquid.ts`) with sample data + Resend variable converter
- [x] React Email base layout (`lib/email/base-layout.tsx`) — branded header, footer, unsubscribe
- [x] Preview API (`/api/preview`) — renders Liquid + wraps in React Email layout

## Day 3: Playbooks + AI — DONE

- [x] 5 system playbooks seeded: Welcome Series (3 emails), Monthly Newsletter (1), Win-back (2), Promotional Blast (1), Onboarding Drip (5)
- [x] 12 system email templates seeded with Liquid variables and proper HTML
- [x] Playbooks browse page: card grid with category badges, email count, duration
- [x] Playbook wizard: 3-step flow (Configure → Review Emails → Launch)
  - Step 1: Name campaign + select target segment
  - Step 2: Review email sequence with timing badges, edit individual templates
  - Step 3: Summary + create campaign drafts
- [x] AI content generation API (`/api/ai/generate`) using Claude Sonnet 4.5
  - Modes: generate body, generate subject lines, improve existing content
  - System prompt enforces Liquid variables, HTML format, concise style
- [x] AI content panel component: mode selector, quick prompts, generate + insert
- [x] AI wired into template editor (below code editor, beside preview)

## Day 4: Campaign Sending — DONE

- [x] Campaign list page: cards with status badges (draft/sending/sent/failed), stats
- [x] Campaign detail view: info card + actions card
- [x] Campaign creation: select template + segment, copies subject/body to campaign
- [x] Edit campaign content: opens template editor with campaign body
- [x] Test email flow: send to any email with sample data, rendered through React Email base layout
- [x] Campaign send flow: iterates contacts in segment, renders Liquid per-contact, sends via `resend.emails.send()`
- [x] Send stats tracked: sent/failed/total counts stored in campaign
- [x] Resend client helper (`lib/resend.tsx`) — `getResendClient()`, `renderEmail()`, `renderTestEmail()`
- [x] API routes: `/api/send` (campaign to segment), `/api/send-test` (single test email), `/api/resend/domains` (domain fetch)

## Day 5: Demo Prep + Deploy — IN PROGRESS

### Done
- [x] **Rebrand**: "Hackathon ESP" → **Forge** (by Dwarf). "F" lettermark in sidebar, updated metadata.
- [x] **Theme**: Switched from orange → indigo accent color (OKLCH hue 264-266). Updated all CSS variables, hardcoded Tailwind classes (`indigo-*`), and hex fallbacks (`#6366f1`).
- [x] **Dark mode**: Wired up `next-themes` with ThemeProvider. Sun/Moon toggle in dashboard header. Full dark mode support across email builder (canvas, palette, properties, modals, preview).
- [x] **Base color**: Slightly darkened from pure white to warm off-white (`oklch(0.97 0.003 80)`).

### TODO
1. Demo data seeding script (org, contacts, segments, campaigns with stats)
2. UI polish: loading skeletons, error toasts, empty states, responsive
3. Deploy to Vercel (env vars, Supabase connection)
4. End-to-end walkthrough: signup → settings → contacts → playbook → AI content → send
5. Fix critical bugs

---

## Directory Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── auth/callback/route.ts
│   └── layout.tsx
├── (dashboard)/
│   ├── layout.tsx
│   ├── page.tsx                      -- dashboard home
│   ├── playbooks/page.tsx            -- playbook browse + wizard
│   ├── campaigns/page.tsx            -- campaign list + detail + send
│   ├── templates/page.tsx            -- template gallery
│   ├── contacts/page.tsx             -- contact list + import
│   ├── segments/page.tsx             -- segment CRUD
│   └── settings/page.tsx             -- org settings + Resend connection
├── api/
│   ├── ai/generate/route.ts          -- Claude AI content generation
│   ├── preview/route.tsx              -- React Email preview rendering
│   ├── resend/domains/route.ts        -- fetch Resend domains
│   ├── send/route.tsx                 -- send campaign to segment
│   └── send-test/route.tsx            -- send test email
├── layout.tsx
└── globals.css
components/
├── ui/                               -- shadcn components
├── app-sidebar.tsx                    -- main sidebar navigation
├── user-menu.tsx                      -- sign out dropdown
├── settings-form.tsx                  -- API key connect + domain picker + sender config
├── contacts-client.tsx                -- contact list + add + CSV import
├── segments-client.tsx                -- segment CRUD + contact toggle
├── templates-client.tsx               -- template gallery + create
├── template-editor.tsx                -- split-pane editor + React Email preview + AI panel
├── playbooks-client.tsx               -- playbook browse + 3-step wizard
├── campaigns-client.tsx               -- campaign list + detail + send + test
└── ai-content-panel.tsx               -- AI writing assistant (body/subject/improve)
lib/
├── supabase/
│   ├── client.ts                     -- browser client
│   ├── server.ts                     -- server client
│   └── middleware.ts                  -- session refresh (used by proxy.ts)
├── email/
│   └── base-layout.tsx               -- React Email base layout (header, content, footer)
├── auth/dal.ts                       -- getCurrentUser, requireAdmin
├── ai.ts                             -- Anthropic client + system prompt
├── liquid.ts                          -- LiquidJS engine + sample data + Resend converter
├── resend.tsx                         -- Resend client + email rendering helpers
└── utils.ts
hooks/
└── use-mobile.ts                     -- shadcn sidebar hook
proxy.ts                              -- Next.js 16 proxy (was middleware.ts)
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    ├── 003_auth_trigger.sql
    └── (004_seed_playbooks applied via MCP)
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ai/generate` | POST | AI content generation (body/subject/improve) via Claude Sonnet 4.5 |
| `/api/preview` | POST | Render HTML+Liquid in React Email base layout |
| `/api/resend/domains` | GET | Fetch domains from Resend using org's API key |
| `/api/send` | POST | Send campaign to segment (per-contact Liquid rendering) |
| `/api/send-test` | POST | Send test email with sample data |

---

## Key Architecture Notes

**Auth flow:** Signup → Supabase auth trigger creates org + profile → proxy.ts refreshes session + redirects → server components use `getCurrentUser()` (React `cache()` deduped) → RLS handles authorization.

**Resend integration:** API key per-org (stored in organizations table, not env). Settings page fetches domains from Resend API, user picks a verified domain. Sending uses `resend.emails.send()` per-contact with Liquid-rendered content wrapped in React Email base layout.

**Liquid templating:** LiquidJS for user-facing variable syntax. Variables: `{{ first_name }}`, `{{ last_name }}`, `{{ email }}`, `{{ company }}` + custom contact properties.

**React Email:** Base layout wraps all emails (branded header, content area, footer with unsubscribe). Preview API renders templates server-side. DM Sans font loaded via web font.

**AI content:** Claude Sonnet 4.5 generates email subject lines, body copy, and improvement suggestions. System prompt enforces Liquid variables, HTML format, and concise marketing style.

**Playbooks:** 5 system-seeded guided strategies with 12 templates. Wizard flow: Configure → Review Emails → Launch (creates draft campaigns).

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

Resend API key is per-org, stored in the `organizations` table.

---

## Verification Checklist

1. **Auth**: Sign up → auto-creates org + profile → redirected to dashboard
2. **Settings**: Enter Resend API key → domains fetched → select domain → configure sender
3. **Contacts**: Import CSV → contacts appear in list → add to segment
4. **Templates**: Edit template with Liquid → preview renders in React Email layout
5. **AI**: Enter prompt → Claude generates email content → insert into template
6. **Playbooks**: Browse → select → wizard → creates campaign drafts
7. **Send**: Campaign → test email → receive in inbox → send to segment → stats recorded
8. **RLS**: Second user in different org → data isolation confirmed
