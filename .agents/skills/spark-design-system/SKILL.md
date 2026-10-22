---
name: spark-design-system
description: >
  Visual rules for apps/web and packages/ui (claude.dev-style design system): colors, typography, the 7-tier spacing
  scale, responsive breakpoints, shadcn base-lyra component sizes and motion. Use whenever writing or changing JSX
  classNames, layouts, pages, sections, lists, cards, navigation, footers, theme tokens in globals.css, or adding a
  shadcn component, and whenever the user mentions spacing, padding, margin, responsive, mobile, breakpoint, dark or
  light theme, font, color, or "looks off", even if they do not name the design system.
---

# Spark design system

Source of truth: [docs/design-system.md](../../../docs/design-system.md). This file is the quick router; read the doc
section when a case is not covered here.

## Hard rules (check every className you write)

1. Only colors are custom. Everything numeric uses Tailwind's default scale. **No arbitrary values**
   (`mt-[54px]`, `text-[13px]`, `grid-cols-[auto_1fr]`, `rounded-[10px]`). Only exception: the logo's
   `--animate-spark-*` keyframes, used by `AppLogo` alone.
2. Smallest text is `text-xs`. Weights: `font-normal`, `font-medium`.
3. shadcn components: choose a `size` / `variant` prop. Never set `h-*`, `px-*`, `py-*`, `text-*` on them via
   `className`; layout classes (`w-full`, `mt-*`, `self-*`) are fine.
4. Style through tokens (`bg-background`, `text-ink-3`, `border-border`, `bg-brand`), never hex or `dark:` color pairs.
   Both themes must work; dark is the default. Status: `text-diff-add` (ok) / `text-diff-del` (blocked); code:
   `text-syn-*`. Orange (`brand`, `brand-ink`) once per screen.
5. `font-serif` exists but is opt-in; do not apply it unless asked.
6. CSS that comes from `vercel-react-view-transitions` (`::view-transition-*`) or `web-design-guidelines`
   (`content-visibility`, `transition`, etc.) must snap to the Tailwind scale and color tokens too; see
   [docs/vercel-skills.md](../../../docs/vercel-skills.md) §1.5.

## Spacing tier lookup

| Relationship between the two things | Class |
| :--- | :--- |
| Glyph-level (icon/text, list items, dt/dd) | `gap-1.5` / `gap-2` |
| Same group (paragraphs, chip/title/author) | `gap-3` / `gap-3.5` |
| Heading to its content | `gap-5` |
| Blocks inside a section (figure, table, meta) | `gap-8` / `my-8`; `mt-9` above an H3 |
| Section to section | `gap-14` (`max-sm:gap-10`) |
| Page region (nav to content, body to footer) | `pt-20` / `mt-20` (`max-sm:pt-12`) |
| Major break (to related posts, CTA) | `mt-28` (`max-sm:mt-16`) |

Space above a heading is always larger than below it. Put spacing on the parent (`flex flex-col gap-*`), not margins on
children. Separate with space first, `border-b` second, a bordered box only for media objects.

## Layout and responsive

- Shell: `px-9 max-sm:px-6`; `grid grid-cols-1 lg:grid-cols-12`; rail `lg:col-span-4 lg:pr-10 lg:sticky lg:top-24`;
  content `min-w-0 lg:col-span-8`; prose `max-w-2xl`.
- Mobile-first. Only `lg` changes structure (rail stacks above, TOC hides, nav becomes a burger, rows split into two
  lines). `sm` / `md` / `xl` only adjust gutters, hide extras or tune columns.
- Reflow, never shrink type or truncate titles. Hide in this order: keyboard hint, category, tile/TOC, date.
- List rows: `flex items-start gap-4 border-b py-4`, no gap between rows; hover `hover:bg-primary
  hover:text-primary-foreground`.
- Anchor targets: `scroll-mt-24 max-sm:scroll-mt-18`.
- `ItemGroup` whose children are not real list items must pass `role="none"` (upstream `ItemGroup` ships `role="list"`).

## Components

| Need | Use |
| :--- | :--- |
| Primary CTA | `<Button size="lg">` |
| Form / toolbar button | `<Button>` or `size="sm"` |
| Secondary | `variant="outline"` |
| Chips | `<Badge variant="default">` / `variant="outline"` (install first) |
| Filter tabs | `<TabsList variant="line">` (install first) |
| Form error / success | `<Alert variant="destructive">` / `variant="success"` |

Add components from `apps/web`: `pnpm dlx shadcn@latest add <name>`. Keep `style: "base-lyra"` identical in
`apps/web/components.json` and `packages/ui/components.json`.

## Navigation

Below `xl` the nav links move into a burger panel under the sticky nav (closes on link, Esc, outside click). In-page
anchors use `scroll-mt-24`; the logo scrolls to `0`.

## Dashboard shell (doc §8)

- Three full-height columns: shadcn `<Sidebar collapsible="offcanvas">` · main `flex-1 min-w-0` · inspector `w-80
  border-l`. Each column = `<ColumnHeader>` (`flex h-14 shrink-0 items-center gap-4 border-b px-4`) + a body with
  `no-scrollbar overflow-y-auto`. Never give one column a different header height; a new panel is a new column.
- Logo lives in the sidebar header; below `md` (or with the sidebar collapsed) it shows in the main header next to the `Burger`.
- Sidebar body = labelled sections (`config/navigation.ts`), named by content (`Workspace`, `Settings`), never "Tree".
  Header = path breadcrumb (no project name) + `[X] LABEL` commands with bare-key shortcuts (`[B]` sidebar, `[D]` theme).
  The sidebar collapses to a 48px icon rail (doc § Icon rail): every `NavLink` needs an `icon` name; icons are functional, never decorative.
- Never edit shadcn files in `packages/ui`; compose in `apps/web/components/layout/`.
- Each section is the big TOC: mono `text-sm`, `└` + an icon per link (current glyph `text-brand`; in the icon rail the current icon is brand), max two levels, counts
  `ml-auto text-xs tabular-nums`.
- Inspector below `xl` becomes `<Sheet side="right">`. Selected row `bg-primary text-primary-foreground`.
- Metrics are a `dl` row, no stat cards. Orange appears once per screen (the logo's spark does not count).
- Logo: always `<AppLogo variant size motion />` (doc § Logo), sizes 16/24/32 only, animated (`idle`) by default everywhere.

## Type and motion

- Titles `text-3xl md:text-4xl font-medium leading-tight`; prose `text-lg leading-relaxed text-ink-2`; labels
  `font-mono text-xs uppercase tracking-wider`; nav/dates `font-mono text-sm text-ink-3`.
- Transitions: colors `duration-150`, movement `duration-200 ease-out`; guard with `motion-safe:`.

## Before you finish

Grep your diff for `-[` inside classNames, `text-[`, hex colors and `h-`/`px-` on shadcn components. Check the page at
375px, 768px, 1024px and 1440px in both themes, with no horizontal scroll.
