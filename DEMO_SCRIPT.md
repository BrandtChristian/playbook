# Forge — 3-Minute Demo Video Script

**Target:** Cerebral Valley x Anthropic Hackathon submission
**Format:** Screen recording with voiceover narration
**Tone:** Confident, authentic, domain-expert — not salesy

---

## Recording Notes

- Record at 1920x1080, clean browser (no bookmarks bar, no other tabs)
- Use dark mode — it looks better on video and shows polish
- Pre-load all pages before recording to avoid loading spinners
- Have a test email ready in your inbox to show delivery
- Pre-populate demo data: contacts, a segment, a couple of emails, a flow

---

## Script

### [0:00–0:20] HOOK — The Problem

> "Marketing automation is a $6.4 billion industry — and almost all of it is built for enterprises.
>
> If you're a small business, you're stuck. Enterprise platforms like HubSpot charge thousands a month. Simpler tools lock you into their ecosystem — their templates, their editor, their sending infrastructure. And when you outgrow them? You start over. Every template, every workflow, every contact list — gone.
>
> I spent three years building marketing automation for enterprises. I know exactly what small businesses are missing."

**[On screen: Quick montage of complex ESP dashboards — or just a title card with the problem statement. Then transition to Forge.]**

---

### [0:20–0:45] INTRO — What is Forge

> "This is **Forge**. It's an ESP-agnostic marketing automation platform — meaning the email provider is abstracted away. Today it runs on Resend. Tomorrow it could be Agillic, SendGrid, or anything else. Your templates, your flows, your contacts — they all come with you.
>
> But Forge isn't just an abstraction layer. It's a complete platform with AI-powered content generation, a visual email builder, automated flow designer, contact management, dynamic segments, consent tracking, team permissions — the full stack.
>
> And I built every line of it in five days, with Opus 4.6 as my pair programmer."

**[On screen: Forge dashboard. Click through sidebar briefly to show the scope — Flows, Emails, Templates, Contacts, Segments, Data, Settings.]**

---

### [0:45–0:55] ONBOARDING

> "Let me walk you through the experience. A new user signs up — Forge immediately runs them through onboarding. Name, role, test email address. Then it guides them to connect their email provider and set up their brand."

**[On screen: Show the onboarding modal steps quickly (2-3 seconds each). Then jump to Settings.]**

---

### [0:55–1:15] BRAND SETUP + AI

> "In Settings, you connect your email provider — here, Resend. Pick your verified domain, set your sender name. Now here's where it gets interesting.
>
> The brand builder uses Claude to generate your entire brand identity. Upload your logo, describe your business, and AI extracts colors, suggests a footer tagline, builds a complete email theme. You can iterate — give feedback, regenerate, refine — until it feels right."

**[On screen: Settings page. Show domain picker. Open Brand Builder. Show AI generating brand config. Show the preview updating with brand colors.]**

---

### [1:15–1:35] FLOW TEMPLATES — THE GUIDED PATH

> "Now the core of the product: **Flows**. Instead of staring at a blank canvas, Forge offers flow templates — proven marketing strategies pre-built as starting points.
>
> Welcome Series. Monthly Newsletter. Win-back Campaign. Onboarding Drip. Each one comes with the right node structure and contextual hints. The trigger tells you which segment to target. Each email node explains what content to write. Delay nodes suggest optimal timing. It's opinionated guidance, but you can change everything."

**[On screen: Click "New Flow." Show the template picker. Select "Welcome Series." Show the flow editor with nodes, hints visible on cards, the setup checklist banner at the top.]**

---

### [1:35–2:05] EMAIL BUILDER + AI CONTENT

> "From inside a flow, I can create a new email. Pick a template as the design base, give it a name and subject, and I'm in the visual builder.
>
> Drag-and-drop blocks — heading, text, image, button, social links, columns. Eleven block types. Full design control.
>
> But the real magic is the AI prompt bar at the top. I type a simple prompt — 'Write a welcome email for new customers of a Copenhagen coffee roaster' — and Claude generates the full email, filling each block with on-brand content. It uses Liquid template variables for personalization: first name, company, custom fields.
>
> I can select any block and ask AI to improve just that section. Or generate three subject line options. The AI knows my brand colors, my org name, my custom contact fields — every prompt is context-aware."

**[On screen: Flow editor -> click "New from template" on a Send Email node -> pick template -> name it -> open visual builder. Show drag-and-drop. Type in AI prompt bar. Show content generating and filling blocks. Click a text block, show "Improve" mode. Show subject line generation.]**

---

### [2:05–2:20] CONTACTS + SEGMENTS + SEND

> "Contacts are imported via CSV or added manually. Dynamic segments let you filter with AND/OR logic across contact fields, custom fields, and relational data tables — similar to what enterprise ESPs offer, but without the complexity tax.
>
> Hit send on a campaign and every contact gets a personalized email — Liquid variables resolved per-recipient, wrapped in a branded React Email layout with unsubscribe and preference links baked in. GDPR-compliant out of the box."

**[On screen: Quick flash of Contacts page with data. Segments page showing a filter builder. Campaign send with stats. Maybe show a received email in an inbox.]**

---

### [2:20–2:45] THE OPUS 4.6 STORY

> "Let me talk about how this was built — because that's as much the story as the product itself.
>
> This entire platform — twenty-two database tables with row-level security. Fourteen API routes. Fifty-plus components. Auth with magic links. A visual drag-and-drop editor. A flow designer. Full consent management. Team permissions. Dynamic segments resolved in Postgres. Dual ESP abstraction with Agillic enterprise integration.
>
> All of it was built with Opus 4.6 as my co-developer in Claude Code. Not just generating boilerplate — making real architectural decisions. Designing the database schema. Writing RLS policies. Building a Liquid templating pipeline that flows through React Email rendering. Debugging edge cases in Agillic's undocumented API.
>
> I'm a solo developer. Opus 4.6 gave me the output of a full engineering team."

**[On screen: Quick scroll through the codebase — file tree, a migration file, the flow designer code, the AI system prompt builder. Show the git log scrolling. Maybe a split screen: Claude Code terminal on one side, the running app on the other.]**

---

### [2:45–3:00] CLOSE — Why This Matters

> "Every small business deserves marketing automation that grows with them — that doesn't punish them for choosing the wrong vendor on day one. Forge makes that possible.
>
> And the fact that one developer could build this in five days? That's the real demo. Not just of the product — of what Opus 4.6 makes possible.
>
> This is Forge. This is what should exist."

**[On screen: Forge dashboard, dark mode, clean. Fade to title card: "Forge — by Dwarf" with GitHub link.]**

---

## Timing Budget

| Section | Duration | Cumulative |
|---------|----------|------------|
| Hook — The Problem | 20s | 0:20 |
| Intro — What is Forge | 25s | 0:45 |
| Onboarding | 10s | 0:55 |
| Brand Setup + AI | 20s | 1:15 |
| Flow Templates | 20s | 1:35 |
| Email Builder + AI | 30s | 2:05 |
| Contacts + Segments + Send | 15s | 2:20 |
| The Opus 4.6 Story | 25s | 2:45 |
| Close | 15s | 3:00 |

---

## Key Phrases to Hit

These map directly to judging criteria:

**Impact (25%):**
- "$6.4 billion industry... built for enterprises"
- "ESP-agnostic — the email provider is abstracted away"
- "GDPR-compliant out of the box"
- "Every small business deserves marketing automation that grows with them"

**Opus 4.6 Use (25%):**
- "Built every line of it in five days, with Opus 4.6 as my pair programmer"
- "Not just generating boilerplate — making real architectural decisions"
- "Opus 4.6 gave me the output of a full engineering team"
- "That's the real demo — of what Opus 4.6 makes possible"

**Depth & Execution (20%):**
- "Twenty-two database tables with row-level security"
- "Visual drag-and-drop editor... flow designer... consent management"
- "Dual ESP abstraction with Agillic enterprise integration"
- "Liquid templating pipeline that flows through React Email rendering"

**Demo (30%):**
- Show real working features, not mockups
- Show AI generating content live
- Show an email arriving in an inbox
- Dark mode throughout for visual polish

---

## Pre-Recording Checklist

- [ ] Clean browser, no extensions visible, dark mode ON
- [ ] Demo org with brand configured (logo, colors, footer)
- [ ] 10+ contacts imported with realistic names
- [ ] At least 2 segments with contacts
- [ ] 1 active flow with configured nodes
- [ ] Resend API key connected, domain verified
- [ ] Test email address ready to receive
- [ ] AI generation working (check OPENROUTER_API_KEY)
- [ ] Git log has 20+ commits to scroll through
- [ ] Record in quiet environment, use good microphone
- [ ] Practice the script 2-3 times for pacing (aim for conversational, not rushed)
