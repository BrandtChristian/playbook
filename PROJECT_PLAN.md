# Forge — Marketing Automation Platform

## Vision

A marketing automation platform that uses Resend as sending infrastructure (under the hood) and guides small businesses through proven email marketing playbooks with AI-assisted content generation. Modern Liquid templating, beautiful UI, zero infrastructure decisions for the end user.

**Product direction:** Model B — we ARE the platform. Resend powers the infrastructure. Users never think about ESPs. The playbook system + AI content assistant is the hero feature.

**Demo narrative:**
> "Small business signs up. Platform shows them a playbook: 'Welcome Series', 'Monthly Newsletter', 'Win-back Campaign'. AI helps write the content. They're sending emails in minutes, not days."

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Database & Auth:** Supabase (Postgres + Auth + RLS + Storage)
- **UI:** shadcn/ui (maia style, stone base, indigo theme, Phosphor icons, DM Sans, no radius, dark mode)
- **Email sending:** Resend (under the hood)
- **Email building:** Visual block editor (drag-and-drop) + React Email (rendering)
- **Templating:** LiquidJS (user-facing) + React Email (rendering)
- **AI:** Claude Sonnet 4.5 via Anthropic SDK (content generation + alt text)
- **Animation:** Motion (Framer Motion)
- **Drag & Drop:** dnd-kit
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
- [x] Playbook wizard: 3-step flow (Configure -> Review Emails -> Launch)
  - Step 1: Name campaign + select target segment
  - Step 2: Review email sequence with timing badges, edit individual templates
  - Step 3: Summary + create campaign drafts
- [x] AI content generation API (`/api/ai/generate`) using Claude Sonnet 4.5
  - Modes: generate body, generate subject lines, improve existing content, improve block
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

## Day 5: Polish, Features & Deploy — DONE

- [x] **Rebrand**: "Hackathon ESP" -> **Forge**. "F" lettermark in sidebar, updated metadata.
- [x] **Theme**: Switched from orange -> indigo accent color (OKLCH hue 264-266). Updated all CSS variables, hardcoded Tailwind classes, and hex fallbacks (#6366f1).
- [x] **Dark mode**: Wired up `next-themes` with ThemeProvider. Sun/Moon toggle in dashboard header. Full dark mode support across all pages.
- [x] **Visual email builder**: Block-based drag-and-drop editor with canvas, palette, properties panel, and AI prompt bar. Blocks: heading, text, button, image, divider, spacer, social, columns, quote, video, HTML.
- [x] **Image uploads**: Upload images to Supabase Storage via `/api/upload`, integrated into email builder image blocks.
- [x] **AI alt text generation**: `/api/ai/alt-text` generates accessible alt text for images using Claude vision.
- [x] **AI brand extraction**: `/api/ai/brand` extracts brand colors from uploaded logos.
- [x] **Brand builder**: Visual brand configuration (colors, logo, footer text) stored in org's `brand_config`.
- [x] **Social icons**: Hosted in Supabase Storage CDN for reliable email delivery. Four styles: color, grey, black, white.
- [x] **Onboarding flow**: Multi-step modal (welcome -> name -> job title -> test email -> ready). Tracks seen flows in profile `seen_flows` JSONB. Extensible flow system.
- [x] **Team invitations**: Invite team members by email. Magic link auth with hashed tokens (prevents email scanner issues). Role assignment (admin/member). Resend invite emails.
- [x] **Team management**: View members, resend invites, remove members. Owner-only permissions for removal.
- [x] **Segment access control**: Restrict which segments specific members can access. `user_segment_access` table + `can_access_segment()` function.
- [x] **Dynamic segments**: Filter-based segments with AND/OR logic, contact fields, custom fields, and relational data conditions. Resolved server-side via Postgres RPC.
- [x] **Segment builder UI**: Visual condition builder with field picker, operator selector, value inputs. Supports nested groups.
- [x] **Custom fields**: Define custom contact attributes (text, number, boolean, date, select types). Managed via data management page.
- [x] **Data tables**: Define one-to-many and global data tables with custom columns. Full CRUD for table definitions, columns, and rows.
- [x] **Data management page**: Unified page for custom fields and data tables configuration.
- [x] **Account page**: User profile management (name, job title, test email).
- [x] **Preference center**: Public page at `/preferences/[token]` for contacts to manage email preferences.
- [x] **Unsubscribe page**: Public page at `/unsubscribe/[token]` for one-click unsubscribe.
- [x] **Consent system**: consent_types, contact_consents, consent_audit_log, consent_type_versions tables. Full audit trail.
- [x] **Email domain restriction**: `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` env var to restrict signup to specific domains.
- [x] **Rate limiting**: In-memory sliding-window rate limiter for AI endpoints (20 req/60s per user).
- [x] **Deployed to Vercel**

## Day 6: Flow Designer + Template/Email Separation — DONE

**Agillic Integration Fixes** (Post-Day 6):
- Fixed test send functionality by resolving message template and target group issues
- Implemented dynamic message template name derivation from HTML template filename
- Added block group filtering to exclude groups with empty fields (Agillic API requirement)
- Added target group selector UI in email editor with database persistence
- Fixed empty field validation to prevent staging campaigns with no content

- [x] **Signup lockdown**: Invite code required to sign up (`NEXT_PUBLIC_SIGNUP_CODE` env var). No code = signup blocked.
- [x] **Flow Designer**: Visual journey builder at `/flows`. Vertical timeline with node cards, connector lines, "+" insert buttons. 4 node types: Trigger (segment entry or schedule), Send Email, Wait/Delay, Exit.
- [x] **Flow trigger types**: Segment entry (contacts entering a segment start the flow) or Schedule (once/hourly/daily/weekly/monthly runs against a segment). Re-entry with optional cooldown delay.
- [x] **Flow persistence**: `flows` + `flow_nodes` tables with full RLS. Auto-save with 600ms debounce. Status toggle (draft/active/paused).
- [x] **Template / Email decoupling**: Templates are reusable designs. Emails are individual messages built FROM a template. New `emails` table. Campaigns and flows reference emails, not templates.
- [x] **Emails page**: New `/emails` page. Create email from template (pick template -> name + subject -> editor). Full email editor with visual builder.
- [x] **Inline email creation in flows**: Send Email node properties panel has "New from template" to create an email inline + "Edit email" to open the full editor without leaving the flow.
- [x] **System template toggle**: Show/hide system templates on templates page and email creation picker.
- [x] **Template creation simplified**: No subject field when creating templates (subject belongs to emails).

---

## Directory Structure

```
app/
  (auth)/
    login/page.tsx                        -- email+password login
    signup/page.tsx                        -- signup with org name + full name
    auth/callback/route.ts                -- PKCE OAuth callback
    auth/accept/page.tsx                  -- magic link accept (for invites)
    layout.tsx                            -- centered layout, no sidebar
  (dashboard)/
    layout.tsx                            -- sidebar + header layout
    page.tsx                              -- dashboard home
    playbooks/page.tsx                    -- redirects to /flows
    flows/page.tsx                        -- flow list + editor
    campaigns/page.tsx                    -- campaign list + detail + send
    emails/page.tsx                       -- email list + create from template
    templates/page.tsx                    -- template gallery (design starting points)
    contacts/page.tsx                     -- contact list + import
    segments/page.tsx                     -- segment CRUD + builder
    settings/page.tsx                     -- org settings + Resend connection
    account/page.tsx                      -- user profile settings
    data/
      page.tsx                            -- data management (server)
      data-client.tsx                     -- data management (client)
  api/
    ai/generate/route.ts                  -- Claude AI content generation
    ai/alt-text/route.ts                  -- AI image alt text generation
    ai/brand/route.ts                     -- AI brand color extraction
    images/route.ts                       -- image library listing
    invites/route.ts                      -- team invitation CRUD
    onboarding/complete/route.ts          -- mark onboarding flow seen
    preferences/route.ts                  -- public preference management
    preview/route.tsx                     -- React Email preview rendering
    resend/domains/route.ts               -- fetch Resend domains
    segment-access/route.ts               -- user segment access control
    segments/preview/route.ts             -- dynamic segment preview
    send/route.tsx                        -- send campaign to segment
    send-test/route.tsx                   -- send test email
    upload/route.ts                       -- image upload to Supabase Storage
  preferences/
    [token]/page.tsx                      -- public preference center
    preview/page.tsx                      -- preference center preview
  unsubscribe/
    [token]/page.tsx                      -- public unsubscribe
    preview/page.tsx                      -- unsubscribe preview
  layout.tsx                              -- root layout (ThemeProvider, fonts)
  globals.css                             -- Tailwind v4 theme config
components/
  ui/                                     -- shadcn components (30+ files)
  app-sidebar.tsx                         -- main sidebar navigation
  user-menu.tsx                           -- sign out dropdown
  theme-toggle.tsx                        -- dark mode Sun/Moon toggle
  settings-form.tsx                       -- API key connect + domain picker + sender config + brand builder
  contacts-client.tsx                     -- contact list + add + CSV import
  csv-import-dialog.tsx                   -- CSV import modal with column mapping
  segments-client.tsx                     -- segment CRUD + contact toggle
  segment-builder/
    segment-builder.tsx                   -- visual filter condition builder
  templates-client.tsx                    -- template gallery (design starting points)
  emails-client.tsx                       -- email list + create from template + edit
  template-editor.tsx                     -- split-pane editor + React Email preview + AI panel (saves to templates or emails via saveTable prop)
  flows/
    flows-client.tsx                      -- flow list + create dialog + editor routing
    flow-editor.tsx                       -- two-column layout (timeline + properties) + inline email editor
    flow-timeline.tsx                     -- vertical node list + connectors + insert buttons
    flow-node-card.tsx                    -- individual node rendering
    flow-node-properties.tsx              -- config forms per node type + inline email creation
    flow-settings-panel.tsx               -- trigger config + flow metadata + status toggle
  email-builder/
    email-builder.tsx                     -- main visual email builder orchestrator
    block-canvas.tsx                      -- drag-and-drop block canvas
    block-palette.tsx                     -- block type picker sidebar
    block-properties.tsx                  -- selected block property editor
    block-renderer.tsx                    -- block-to-React rendering
    block-edit-modal.tsx                  -- inline block text editing modal
    ai-prompt-bar.tsx                     -- AI generation bar in builder
  playbooks-client.tsx                    -- (legacy, unused — playbooks merged into flows)
  campaigns-client.tsx                    -- campaign list + detail + send + test
  ai-content-panel.tsx                    -- AI writing assistant (body/subject/improve)
  brand-builder.tsx                       -- visual brand config editor
  account-client.tsx                      -- account settings form
  team-members.tsx                        -- team member list + invite + manage
  onboarding-checklist.tsx                -- setup progress checklist
  onboarding-wizard.tsx                   -- legacy onboarding wizard
  onboarding/
    flow-modal.tsx                        -- animated multi-step onboarding modal
    flow-provider.tsx                     -- onboarding flow context + state
    steps/
      welcome-step.tsx                    -- splash screen step
      name-step.tsx                       -- full name input step
      job-title-step.tsx                  -- job title input step
      test-email-step.tsx                 -- test email input step
      ready-step.tsx                      -- completion confetti step
  preference-center.tsx                   -- public email preference UI
  unsubscribe-page.tsx                    -- public unsubscribe UI
  data-management/
    custom-fields-manager.tsx             -- custom field CRUD
    data-tables-manager.tsx               -- data table + column + row CRUD
lib/
  supabase/
    client.ts                             -- browser client factory
    server.ts                             -- server client factory (async)
    middleware.ts                          -- session refresh + auth redirects
  email/
    base-layout.tsx                       -- React Email layout (header, content, footer, unsubscribe)
    blocks.ts                             -- block types, serialization, palette, social icons
  auth/dal.ts                             -- getCurrentUser, requireAdmin (cache-wrapped)
  ai.ts                                   -- Anthropic client + system prompt + GenerateRequest type
  allowed-domains.ts                      -- email domain allowlist validation
  invite-code.ts                          -- signup invite code validation
  liquid.ts                               -- LiquidJS engine + sample data + Resend converter
  flows/
    types.ts                              -- FlowNode, Flow, TriggerConfig, SendEmailConfig, NODE_PALETTE, summarizeNode
  onboarding/
    flows.ts                              -- onboarding flow definitions + resolution
    types.ts                              -- flow/step type definitions
  rate-limit.ts                           -- in-memory sliding-window rate limiter
  resend.tsx                              -- Resend client + email rendering helpers
  segments/
    evaluate.ts                           -- segment resolution via Postgres RPC
    operators.ts                          -- operator definitions for segment UI
    types.ts                              -- filter condition types, custom fields, data tables
  utils.ts                                -- cn() class merge utility
hooks/
  use-mobile.ts                           -- shadcn sidebar responsive hook
proxy.ts                                  -- Next.js 16 proxy (session refresh + redirects)
supabase/
  migrations/
    001_initial_schema.sql                -- 8 core tables + enums + indexes
    002_rls_policies.sql                  -- RLS policies + helper functions
    003_auth_trigger.sql                  -- auto-create org+profile on signup
    008_invitations_and_trigger_update.sql -- team invitations + updated auth trigger
    009_segment_access_control.sql        -- user segment access restrictions
    (12 more migrations applied via Supabase MCP - see Database section)
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ai/generate` | POST | AI content generation (body/subject/improve/improve-block) via Claude |
| `/api/ai/alt-text` | POST | AI image alt text generation via Claude vision |
| `/api/ai/brand` | POST | AI brand color extraction from logo URL |
| `/api/images` | GET | List images from Supabase Storage |
| `/api/invites` | POST/PATCH/DELETE | Team invitation management (create/resend/remove) |
| `/api/onboarding/complete` | POST | Mark onboarding flow as seen |
| `/api/preferences` | GET/POST | Public contact preference management |
| `/api/preview` | POST | Render HTML+Liquid in React Email base layout |
| `/api/resend/domains` | GET | Fetch domains from Resend using org's API key |
| `/api/segment-access` | GET/PUT | User segment access control (admin only) |
| `/api/segments/preview` | POST | Preview dynamic segment filter results |
| `/api/send` | POST | Send campaign to segment (per-contact Liquid rendering) |
| `/api/send-test` | POST | Send test email with sample data |
| `/api/upload` | POST | Upload image to Supabase Storage |

---

## Database

### Tables (22 in production)

**Core:**
- `organizations` — org settings, Resend API key, brand_config, onboarding state
- `profiles` — user profile linked to org, role, seen_flows, job_title, preferred_test_email
- `contacts` — email contacts with standard + custom fields, consent status
- `segments` — static or dynamic (filter-based) segments
- `segment_contacts` — junction table for static segment membership
- `templates` — reusable email designs (system-seeded + user-created)
- `emails` — individual messages built from templates, with own subject + body
- `playbooks` — system-seeded guided email strategies
- `campaigns` — email campaigns with email_id, status, stats, snapshot content

**Flows:**
- `flows` — flow definitions (name, status, trigger_config with segment/schedule)
- `flow_nodes` — ordered nodes (trigger, send_email, delay, exit) with config JSONB

**Team:**
- `invitations` — team invite records (status: pending/accepted/expired)
- `user_segment_access` — per-user segment restrictions

**Data Management:**
- `custom_field_definitions` — custom contact attribute schemas
- `data_table_definitions` — dynamic data table definitions
- `data_table_columns` — columns for data tables
- `data_table_rows` — rows for data tables (contact-linked or global)

**Consent & Preferences:**
- `consent_types` — email consent categories
- `contact_consents` — per-contact consent records
- `consent_audit_log` — consent change audit trail
- `consent_type_versions` — consent type version history
- `preference_tokens` — secure tokens for public preference/unsubscribe pages

### Enums
- `user_role` (owner, admin, member)
- `campaign_status` (draft, scheduled, sending, sent, failed)
- `playbook_category` (welcome, newsletter, winback, promotional, transactional, onboarding)
- `invitation_status` (pending, accepted, expired)

### RLS Helper Functions
- `get_user_org_id()` — returns current user's org_id
- `is_admin()` — checks admin/owner role
- `can_access_segment(seg_id)` — checks segment access permissions
- `handle_new_user()` — auth trigger: creates org+profile or joins invited org
- `resolve_segment_contacts()` — resolves dynamic segment membership
- `preview_segment_filter()` — previews segment filter results

### Migration Notes
5 migration files checked into `/supabase/migrations/`. 12 additional migrations applied directly via Supabase MCP (seed data, custom fields, data tables, dynamic segments, consent system, profile enhancements, storage bucket, etc.). This is intentional for hackathon velocity.

---

## Key Architecture Notes

**Auth flow:** Signup -> Supabase auth trigger creates org + profile -> proxy.ts refreshes session + redirects -> server components use `getCurrentUser()` (React `cache()` deduped) -> RLS handles authorization. Invited users join existing org via magic link with hashed token.

**Resend integration:** API key per-org (stored in organizations table, not env). Settings page fetches domains from Resend API, user picks a verified domain. Sending uses `resend.emails.send()` per-contact with Liquid-rendered content wrapped in React Email base layout.

**Email building:** Two modes: (1) code editor with raw HTML+Liquid, (2) visual block editor with drag-and-drop. Both render through same React Email base layout. Block types: heading, text, button, image, divider, spacer, social, columns, quote, video, HTML.

**Liquid templating:** LiquidJS for user-facing variable syntax. Variables: `{{ first_name }}`, `{{ last_name }}`, `{{ email }}`, `{{ company }}`, `{{ phone }}`, `{{ job_title }}`, `{{ city }}`, `{{ country }}` + custom contact data fields.

**React Email:** Base layout wraps all emails (branded header, content area, footer with unsubscribe + preferences links). Preview API renders templates server-side. DM Sans font loaded via web font. BrandConfig controls colors/logo.

**AI content:** Claude Sonnet 4.5 generates email subject lines, body copy, improvement suggestions, image alt text, and brand colors. System prompt enforces Liquid variables, HTML format, and concise marketing style. Rate limited (20 req/60s per user).

**Flow Templates:** 5 system-seeded templates (from `playbooks` table) available in the flow creation dialog. Pre-populate flows with node structure + contextual hints. Suggestive guidance, not prescriptive.

**Onboarding:** Extensible flow system. Flows define steps dynamically based on profile completeness. Modal UI with animated step transitions. Tracks completion in `profile.seen_flows`.

**Team management:** Owner invites members via email. Magic link auth (hashed tokens prevent email scanner issues). Roles: owner > admin > member. Segment access restrictions for members.

**Dynamic segments:** Filter rules with AND/OR logic trees. Condition sources: contact fields, custom fields, relational data (aggregations: exists, count, sum, min, max). Resolved server-side via Postgres RPC functions.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_SIGNUP_CODE=                # required: invite code for signup (no code = signup blocked)
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=     # optional: comma-separated domain allowlist
NEXT_PUBLIC_APP_URL=                    # optional: app URL for email links
```

Resend API key is per-org, stored in the `organizations` table.

---

## Verification Checklist

1. **Auth**: Sign up -> auto-creates org + profile -> redirected to dashboard -> onboarding flow
2. **Settings**: Enter Resend API key -> domains fetched -> select domain -> configure sender -> brand builder
3. **Contacts**: Import CSV -> contacts appear in list -> add to segment -> custom fields
4. **Templates**: Edit template with Liquid or visual builder -> preview renders in React Email layout
5. **AI**: Enter prompt -> Claude generates email content -> insert into template / generate alt text
6. **Flows**: Create flow -> pick template -> editor opens with guided hints -> configure segments + emails
7. **Send**: Campaign -> test email -> receive in inbox -> send to segment -> stats recorded
8. **Team**: Invite member -> magic link email -> accept -> see restricted segments
9. **Segments**: Create dynamic segment -> add filter conditions -> preview matching contacts
10. **Data**: Define custom fields -> define data tables -> add rows -> use in segment conditions
11. **Preferences**: Contact clicks unsubscribe -> preference center -> manage consents
12. **RLS**: Second user in different org -> data isolation confirmed

---

## Roadmap

### 1. Flow Designer — DONE
Visual journey builder at `/flows`. Vertical timeline with node cards, connector lines, "+" insert buttons. 4 node types: Trigger (segment entry or scheduled), Send Email, Wait/Delay, Exit. Trigger supports segment entry or schedule (once/hourly/daily/weekly/monthly) with re-entry cooldown. Auto-save, status toggle (draft/active/paused). Inline email creation + editing from flow editor. Next: condition nodes, A/B splits, execution engine.

### 2. Playbook Rethink — DONE
Playbooks merged into Flow Designer as "Flow Templates." Dedicated `/playbooks` page removed (redirects to `/flows`). Sidebar nav updated. Flow creation dialog shows name input first, then "Or start from a template" divider with 5 seeded templates. Selecting a template pre-populates nodes with contextual hints (`segment_hint` on trigger, `hint` on send_email/delay). Flow editor surfaces hints on node cards, in properties panel, and via a "Suggested setup" checklist banner. Hints auto-hide once configured. Guidance is suggestive, not prescriptive — users can add/remove/rearrange freely.

### 3. Template / Email Decoupling — DONE
Templates are reusable designs (layout starting points). Emails are individual messages built FROM a template with their own subject + body. New `emails` table. Campaigns and flow nodes reference emails, not templates. Emails page at `/emails` with create-from-template flow. System template toggle. Template creation no longer asks for subject (that's an email concept).

### 4. Flow Execution Engine — TODO
The flow designer UI is complete but **nothing actually executes**. Setting a flow to "active" only updates a database column. No contacts enroll, no emails send, no delays resolve. Full implementation spec in **[`FLOW_ENGINE_SPEC.md`](FLOW_ENGINE_SPEC.md)**. Summary: Vercel Cron (1-min) hits `/api/cron/process-flows` which uses the service role client to enroll contacts from segments, advance them through nodes, send emails via Resend, and handle delays. Two new tables: `flow_enrollments` (contact journey state) + `flow_execution_log` (audit trail). Manual "Process Now" button as fallback for free-tier Vercel.
