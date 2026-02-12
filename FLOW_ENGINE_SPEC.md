# Flow Execution Engine — Implementation Spec

## Context

The flow designer UI is 100% complete — users can create flows with trigger/send_email/delay/exit nodes, configure segment triggers and schedules, toggle flows active/paused/draft, and everything persists to the database. **But nothing actually executes.** Setting a flow to "active" updates a column and changes a badge. No emails send, no contacts advance, no delays resolve. This spec covers building the execution backend so flows actually work.

**Hosting constraint:** Vercel (serverless). No long-running workers. We need Vercel Cron + Supabase to drive execution.

---

## Architecture: Vercel Cron + Supabase Service Role

The simplest approach that works on Vercel:

1. **Vercel Cron** hits an API route on a schedule (every 1 minute on Pro, daily on free)
2. That route uses the **Supabase service role client** (bypasses RLS) to:
   - Find active flows due for processing
   - Enroll new contacts (segment entry or schedule triggers)
   - Advance contacts past expired delays
   - Execute send_email nodes (send via Resend)
   - Mark contacts as exited when they hit exit nodes

No Edge Functions needed. No pg_cron. Just a single cron-triggered API route that does a processing sweep.

A **manual "Process Now" button** in the flow editor hits the same endpoint, so it works on free tier for demos.

---

## New Database Tables

### `flow_enrollments`

Tracks each contact's journey through a flow.

```sql
create table flow_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  flow_id uuid not null references flows(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  current_node_position int not null default 0,
  status text not null default 'active'
    check (status in ('active', 'completed', 'exited', 'failed')),
  enrolled_at timestamptz not null default now(),
  advanced_at timestamptz not null default now(),  -- last time contact moved to current node
  completed_at timestamptz,
  exit_reason text,
  created_at timestamptz not null default now(),

  -- Prevent duplicate active enrollments
  unique (flow_id, contact_id, status) where (status = 'active')
);

-- Indexes for the cron sweep
create index idx_flow_enrollments_active on flow_enrollments (flow_id, status) where status = 'active';
create index idx_flow_enrollments_contact on flow_enrollments (contact_id, flow_id);

-- RLS
alter table flow_enrollments enable row level security;
create policy "org isolation" on flow_enrollments
  for all using (org_id = get_user_org_id());
```

### `flow_execution_log`

Audit trail — what happened and when.

```sql
create table flow_execution_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  flow_id uuid not null references flows(id) on delete cascade,
  enrollment_id uuid not null references flow_enrollments(id) on delete cascade,
  node_position int not null,
  node_type text not null,
  action text not null,  -- 'enrolled', 'email_sent', 'email_failed', 'delay_started', 'delay_completed', 'exited'
  metadata jsonb default '{}',  -- email_id, error message, etc.
  created_at timestamptz not null default now()
);

create index idx_flow_log_enrollment on flow_execution_log (enrollment_id);
create index idx_flow_log_flow on flow_execution_log (flow_id);

alter table flow_execution_log enable row level security;
create policy "org isolation" on flow_execution_log
  for all using (org_id = get_user_org_id());
```

### Additions to `flows` table

```sql
alter table flows add column if not exists last_processed_at timestamptz;
alter table flows add column if not exists last_scheduled_run_at timestamptz;
```

---

## API Route: `/api/cron/process-flows`

**Single route, called by Vercel Cron every minute.** Secured by `CRON_SECRET` env var.

### Processing Steps (in order)

#### Step 1: Get all active flows

```sql
select f.*, array_agg(fn.* order by fn.position) as nodes
from flows f
join flow_nodes fn on fn.flow_id = f.id
where f.status = 'active'
group by f.id
```

#### Step 2: Enrollment — For each active flow, enroll new contacts

**Segment entry triggers:**

- Resolve segment contacts via `resolve_segment_contacts(segment_id)`
- Compare against existing enrollments for this flow
- Enroll contacts not already enrolled (respecting `allow_reentry` + `reentry_delay`)
- New enrollments start at position 1 (the first node AFTER trigger)

**Schedule triggers:**

- Check if enough time has passed since `last_scheduled_run_at` based on `schedule_frequency`
- If due: resolve segment, enroll all non-enrolled contacts, update `last_scheduled_run_at`

#### Step 3: Advance — Process all active enrollments

For each active enrollment, check what node they're at:

- **`send_email` node**: Send the email (reuse `renderEmail()` + Resend). On success, advance `current_node_position` + 1, update `advanced_at`. On failure, log error, optionally retry next cycle.
- **`delay` node**: Check if `now() >= advanced_at + delay_duration`. If yes, advance to next position. If no, skip (will check again next cycle).
- **`exit` node**: Set enrollment status to `completed`, record `exit_reason`, set `completed_at`.
- **Past last node**: Set enrollment status to `completed` (implicit exit).

#### Step 4: Update flow metadata

- Set `last_processed_at = now()` on each processed flow

### Auth and Security

- Env var `CRON_SECRET` — Vercel Cron sends this in `Authorization: Bearer <secret>` header
- Route validates the header, rejects unauthorized calls
- Uses **service role client** (not user-scoped) since there's no authenticated user in a cron context

### Rate Limiting and Safety

- Process max 10 flows per tick (avoid Vercel timeout — 60s for hobby, 300s for pro)
- Send max 50 emails per tick per flow (batch across multiple ticks if segment is large)
- Log errors, don't crash the whole sweep on one failure

---

## Vercel Cron Configuration

**File: `vercel.json`** (new file)

```json
{
  "crons": [
    {
      "path": "/api/cron/process-flows",
      "schedule": "* * * * *"
    }
  ]
}
```

Vercel free/hobby plan limits cron to once daily. Pro plan supports every minute. We build for Pro but also add a manual "Process Now" button in the flow editor that hits the same endpoint with the CRON_SECRET.

**Future option:** Supabase Database Webhooks can fire HTTP requests when rows change (e.g., `segment_contacts` INSERT). This could trigger the Vercel endpoint in real-time on segment entry — no cron needed. Worth exploring after the core engine works.

---

## Reusable Existing Code

These files already have the exact logic we need — no need to rebuild:

| Need | Existing Code | File |
| ---- | ------------- | ---- |
| Resolve segment contacts | `getContactsForSegment()` | `lib/segments/evaluate.ts` |
| Render email with Liquid + layout | `renderEmail()` | `lib/resend.tsx` |
| Get Resend client | `getResendClient(apiKey)` | `lib/resend.tsx` |
| Render Liquid templates | `renderTemplate()` | `lib/liquid.ts` |
| Preference tokens | Token lookup/create pattern | `app/api/send/route.tsx` (lines 122-146) |
| Flow types | All node/config types | `lib/flows/types.ts` |
| Service role client | `getServiceClient()` | `lib/supabase/server.ts` |

The send logic in `/api/send/route.tsx` is essentially what each `send_email` node needs to do per-contact. Extract the per-contact send into a shared helper.

---

## Files to Create / Modify

| File | Action | Purpose |
| ---- | ------ | ------- |
| `vercel.json` | Create | Cron schedule definition |
| `app/api/cron/process-flows/route.ts` | Create | Main cron handler |
| `lib/flows/engine.ts` | Create | Core execution logic (enroll, advance, send) |
| `lib/flows/types.ts` | Modify | Add enrollment types |
| `lib/resend.tsx` | Modify | Extract per-contact send into reusable helper |
| Supabase migration | Apply via MCP | `flow_enrollments` + `flow_execution_log` tables |
| `components/flows/flow-editor.tsx` | Modify | Show enrollment count / "Process Now" button |
| `.env.local` | Modify | Add `CRON_SECRET` |

---

## UI Enhancements (Optional, After Engine Works)

- **Flow editor**: Show "X contacts active" badge when flow is active
- **Flow detail**: Simple activity log showing recent enrollments + sends
- **Node cards**: Show send count on send_email nodes ("42 sent")
- **Dashboard**: "Active flows" widget

---

## Verification Plan

1. **Migration**: Apply tables via Supabase MCP, verify with `list_tables`
2. **Unit test the engine** (manual):
   - Create a flow with trigger -> send_email -> delay (1 min) -> send_email -> exit
   - Set it active
   - Hit `/api/cron/process-flows` manually with curl (pass CRON_SECRET)
   - Check `flow_enrollments` — contacts should be enrolled + first email sent
   - Wait 1 minute, hit endpoint again — contacts should advance past delay, second email sent
   - Hit again — contacts should be at exit, status = completed
3. **Check Resend dashboard** — emails actually delivered
4. **Check `flow_execution_log`** — full audit trail
5. **Deploy to Vercel** — verify cron fires automatically (check Vercel dashboard > Cron Jobs)
6. **Build check**: `npm run build` passes
