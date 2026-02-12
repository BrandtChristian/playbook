# Learnings

## Tailwind v4 + Turbopack

- **Stale CSS cache**: When Turbopack shows CSS parse errors that don't match the source files, run `rm -rf .next && npm run dev` to clear the cache. The `.next` directory can hold stale compiled CSS even after source edits.
- **Arbitrary selectors with sed**: Never use sed on Tailwind arbitrary selectors with bracket-ampersand syntax — the brackets confuse sed's regex and produce mangled/doubled class names. Use the Edit tool or manual find-replace for these.
- **OKLCH color format**: shadcn/ui with Tailwind v4 uses OKLCH for theme colors. Format: `oklch(lightness chroma hue)`. To swap accent color, change the hue on all primary/accent/sidebar/chart variables. Indigo is ~264-266 hue.

## Dark Mode

- **`next-themes` setup**: Install → wrap app in `<ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>` → add `suppressHydrationWarning` to `<html>` tag. The `attribute="class"` is critical — it adds/removes the `dark` class on `<html>`.
- **Hardcoded Tailwind colors need `dark:` variants**: shadcn components handle dark mode automatically via CSS variables, but any hardcoded `bg-white`, `text-stone-*`, `border-stone-*` classes in custom components need explicit `dark:` counterparts.
- **Common dark mode pattern**: `bg-white` → `dark:bg-stone-900`, `text-stone-300/400` → `dark:text-stone-600/500` (invert the shade), `border-stone-200` → `dark:border-stone-700`.
- **Inline styles don't respond to dark mode**: The canvas dot pattern was an inline `style={{ backgroundImage: ... }}` with hardcoded light color. Replaced with Tailwind arbitrary values: `bg-[radial-gradient(circle,#d6d3d1_0.5px,transparent_0.5px)] dark:bg-[radial-gradient(...)]`.
- **iframe content is isolated**: Email preview in an iframe won't inherit the app's dark mode. The surrounding container can go dark, but the iframe HTML (rendered server-side by React Email) stays as-is.

## Theme/Branding

- **Color changes touch many files**: Changing an accent color requires updating: (1) CSS variables in globals.css, (2) hardcoded Tailwind color classes in components, (3) hex fallback values in component code and API routes. Always grep for the old color hex to find all references.
- **Default button colors**: When changing the accent, remember to update default button `bgColor` and `textColor` in both the renderer component and the blocks serializer (`lib/email/blocks.ts`). White text works on dark accents (indigo), dark text needed for light accents (lime/green).
