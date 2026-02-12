# Learnings

## Tailwind v4 + Turbopack

- **Stale CSS cache**: When Turbopack shows CSS parse errors that don't match the source files, run `rm -rf .next && npm run dev` to clear the cache. The `.next` directory can hold stale compiled CSS even after source edits.
- **Arbitrary selectors with sed**: Never use sed on Tailwind arbitrary selectors with bracket-ampersand syntax — the brackets confuse sed's regex and produce mangled/doubled class names. Use the Edit tool or manual find-replace for these.
- **OKLCH color format**: shadcn/ui with Tailwind v4 uses OKLCH for theme colors. Format: `oklch(lightness chroma hue)`. To swap accent color, change the hue on all primary/accent/sidebar/chart variables. Indigo is ~264-266 hue.
- **Tailwind v4 scans ALL files**: Tailwind v4 scans every file in the project root (including .md files) for class names. Never put literal Tailwind class names in markdown/docs/learnings files — Tailwind will try to compile them, causing CSS parse errors (especially with arbitrary selectors).

## Dark Mode

- **`next-themes` setup**: Install, wrap app in ThemeProvider with `attribute="class"`, `defaultTheme="light"`, `enableSystem`, `disableTransitionOnChange`. Add `suppressHydrationWarning` to the html tag. The `attribute="class"` is critical — it adds/removes the `dark` class on html.
- **Hardcoded Tailwind colors need dark variants**: shadcn components handle dark mode automatically via CSS variables, but any hardcoded bg-white, text-stone-*, border-stone-* classes in custom components need explicit dark: counterparts.
- **Common dark mode pattern**: bg-white needs dark:bg-stone-900, text-stone-300/400 needs dark:text-stone-600/500 (invert the shade), border-stone-200 needs dark:border-stone-700.
- **Inline styles don't respond to dark mode**: The canvas dot pattern was an inline style with hardcoded light color. Replaced with Tailwind arbitrary values using dark: variant.
- **iframe content is isolated**: Email preview in an iframe won't inherit the app's dark mode. The surrounding container can go dark, but the iframe HTML stays as-is.

## Theme/Branding

- **Color changes touch many files**: Changing an accent color requires updating: (1) CSS variables in globals.css, (2) hardcoded Tailwind color classes in components, (3) hex fallback values in component code and API routes. Always grep for the old color hex to find all references.
- **Default button colors**: When changing the accent, remember to update default button bgColor and textColor in both the renderer component and the blocks serializer. White text works on dark accents (indigo), dark text needed for light accents (lime/green).

## Email Building & Sending

- **Social icons in emails**: Icons hosted as static files won't render in many email clients. Solution: upload icons to Supabase Storage CDN and reference the public URLs. CDN URLs are reliable across email clients.
- **Magic link scanners**: Email security scanners (Outlook SafeLinks, etc.) can consume one-time magic link tokens before the user clicks. Solution: use `hashed_token` from Supabase's `generateLink()` instead of `action_link`, and construct the verify URL manually with `token_hash` param.
- **React Email rendering**: `render()` from `@react-email/render` is async. Always await it. The rendered HTML is a full document (html/head/body) suitable for email sending.
- **Liquid + React Email pipeline**: Template content goes through Liquid (variable substitution) first, then gets wrapped in BaseEmailLayout (React Email), then rendered to HTML string. Order matters.

## Supabase

- **MCP migrations vs local files**: During the hackathon, most schema changes were applied via Supabase MCP tools directly. Only 5 of 17 migrations exist as local files. The MCP-applied migrations are the source of truth for the production database state.
- **RLS helper functions**: `get_user_org_id()` and `is_admin()` are used across all RLS policies. If you need to add a new table, create policies using these helpers for consistency.
- **Postgres RPC for complex queries**: Dynamic segment resolution uses `supabase.rpc()` to call server-side functions. This keeps complex filtering logic in Postgres rather than in application code.
- **Storage bucket access**: The `email-images` bucket is public. Upload via service role client, access via public URL pattern: `{SUPABASE_URL}/storage/v1/object/public/email-images/{path}`.

## Next.js 16

- **Proxy not middleware**: The file is `proxy.ts` with export `proxy`, NOT `middleware.ts` with export `middleware`. Easy to forget.
- **Server client is async**: `createClient()` from `lib/supabase/server.ts` must be awaited. Forgetting `await` causes cryptic errors.
- **React cache()**: `getCurrentUser()` is wrapped in `cache()` — it deduplicates within a single request. Safe to call multiple times in server components without extra DB hits.
