# Design system

How `apps/web` looks and behaves: color, type, spacing, responsive layout, components and motion. The visual language
follows [claude.dev](https://claude.dev) (measured on 2026-10-19 at 1440px, 1024px, 768px and 375px). Every value below
was snapped to Tailwind's default scale. Tokens live in `packages/ui/src/styles/globals.css`, components in
`packages/ui/src/components` (shadcn, style `base-lyra`). An illustrated, interactive version of this guide (live
components, logo, motion demos, dashboard demo with the icon rail) lives in [design-system/spark-design-system.html](design-system/spark-design-system.html)
and is published as the "Spark Design System" artifact (https://claude.ai/artifact/3HTHeDuJCvVQbNCRHM37mC).
When the two disagree, this file wins.

---

## 1. Rules that never bend

1. **Only colors are custom.** Font size, weight, leading, tracking, spacing, border width, radius, duration, easing and
   breakpoints come from Tailwind's default scale. No arbitrary values (`mt-[54px]`, `text-[13px]`, `grid-cols-[auto_1fr]`).
   If no step fits, use the nearest one. **One exception: the logo.** Its frame-by-frame keyframes live as
   `--animate-spark-*` tokens in `globals.css` and are used only by `AppLogo` (see [Logo](#logo)).
2. **Smallest text is `text-xs`.** Weights are `font-normal` and `font-medium` only.
3. **Components keep their own sizes.** Pick a `size` / `variant` prop (`<Button size="sm">`). Never override height,
   padding or font size through `className`. Layout classes such as `w-full` or `mt-*` are fine. If no size fits, add a
   variant to the component instead of patching the call site.
4. **Dark first, light complete.** `defaultTheme="dark"`, but `:root` (light) and `.dark` both define every token. Never
   style for one theme only.
5. **Root stays 16px.** The rem scale must match Tailwind's.

---

## 2. Color

Defined in `globals.css` and exposed as utilities (`bg-background`, `text-ink-3`, `bg-brand`, ...).

| Token | Light | Dark | Use |
| :--- | :--- | :--- | :--- |
| `background` / `foreground` | `#faf9f5` / `#141413` | `#141413` / `#faf9f5` | Page and primary text |
| `card` | `#f1efe8` | `#1a1a18` | Raised surfaces: terminal, code block |
| `popover` | `#edeae2` | `#121110` | Menus, dropdowns |
| `primary` | `#141413` | `#faf9f5` | "Paper": CTA fill and the inverted hover of list rows |
| `muted-foreground` = `ink-3` | `#7b7a72` | `#87867f` | Meta, labels, dates |
| `ink-2` | `#4c4b45` | `#b0aea5` | Long-form text, descriptions |
| `ink-4` | `#a8a69d` | `#5e5d59` | Decoration only (`└`, dots). Never readable text |
| `accent` | `#1414130d` | `#faf9f50b` | shadcn hover surface. **Not** the brand color |
| `brand` | `#c15f3c` | `#d97757` | Orange: pixel tiles, focal chart mark, selection |
| `brand-ink` | `#a94e2f` | `#e08a6c` | Orange used as small text (contrast-tuned per theme) |
| `border` / `input` | ink 11% / 22% | ink 9% / 16% | Hairlines and field outlines |
| `chip-fill` | `#1414130a` | `#faf9f50d` | Inline `code` and chip fill |
| `diff-add` / `diff-add-bg` | `#3e7a3e` / `#50965017` | `#9ac29a` / `#78be7812` | Success, "ready", added lines (`<Alert variant="success">`) |
| `diff-del` / `diff-del-bg` | `#a04545` / `#b45a5a17` | `#c29a9a` / `#be787812` | Blocked, removed lines; `destructive` uses the same red |
| `syn-purple` / `syn-blue` | `#914dbe` / `#3065d7` | `#c792ea` / `#82aaff` | Code only: keywords, args / functions, programs |
| `syn-green` / `syn-cyan` | `#567527` / `#16749a` | `#c3e88d` / `#89ddff` | Code only: strings / operators, punctuation |

Values match claude.dev (re-checked 2026-10-19). Status and syntax colors are muted on purpose: they live in small
mono text, never as fills behind body copy (the `-bg` tints are the only fills). Orange stays the single focal color.

Light is not an inverted dark: `ink-2` gets much darker on paper, hairlines get slightly more alpha, panels go darker
than the page instead of lighter.

---

## 3. Typography

| Family | Class | Use |
| :--- | :--- | :--- |
| Geist | `font-sans` | UI, headings, body, prose |
| Geist Mono | `font-mono` | Nav, tabs, labels, dates, durations, code, in-article section headings |
| STIX Two Text | `font-serif` | Registered only. No component uses it by default |

| Role | Classes |
| :--- | :--- |
| Article / featured title | `text-3xl md:text-4xl font-medium leading-tight` |
| Page name in the rail | `font-mono text-3xl leading-none` |
| Section title in the rail | `font-mono text-2xl leading-tight` |
| Standfirst, prose | `text-lg leading-relaxed text-ink-2` (`max-sm:text-base`) |
| Row title, UI body | `text-base` |
| In-article H2/H3 | `font-mono text-sm font-medium uppercase tracking-wide` |
| Nav, tabs, dates, durations | `font-mono text-sm text-ink-3` |
| Labels, table headers, chips | `font-mono text-xs uppercase tracking-wider` |

---

## 4. Spacing

Related things sit close, unrelated things sit far apart, and each tier is roughly 1.5 to 2.5 times the one below it.
That ratio is what makes the pages feel open yet clearly sectioned. Use the tier's class; do not invent new tokens.

| Tier | Tailwind | Measured | Use |
| :--- | :--- | :--- | :--- |
| T1 Glyph | `gap-1.5`, `gap-2` | 6-7px | List items, `dt` to `dd`, icon to text |
| T2 Group | `gap-3`, `gap-3.5` | 12-14px | Consecutive paragraphs; chip, title and author in one block; footer links |
| T3 Heading | `gap-5` | 18-20px | A heading to its first content |
| T4 Block | `gap-8` / `my-8`; `mt-9` before an H3 | 30-36px | Figures, tables, article meta, blocks inside one section |
| T5 Section | `gap-14` | 54px | Between sections of an article or doc page |
| T6 Page region | `pt-20` / `mt-20` | 72-80px | Nav to content, header to body, content to footer |
| T7 Major break | `mt-28` | 110px | End of main content to a different block (related posts, CTA) |

Rules:

- **A heading belongs to what follows.** Space above a heading is always larger than below (H3: `mt-9` above, `gap-5`
  below). Wrap heading and content in `flex flex-col gap-5` rather than giving each a margin.
- **Space first, hairline second, box last.** Sections are separated by space only. Lists use `border-b`. A full border
  box is reserved for media objects: figure, terminal, card.
- **Containers own spacing.** Use `gap` / `space-y` on the parent; avoid one-off margins on children.
- **One left axis.** Header, prose, lists and related posts all start at the content column; the rail never crosses it.
- **List rows carry their own padding.** `py-4 border-b` with `gap-0` between rows, so the hover fill covers the row.

Horizontal: page gutter `px-9` (`max-sm:px-6`), 12-column grid with no column gap, rail `col-span-4 pr-10`, content
`col-span-8 pl-8`, prose `max-w-2xl`.

Component padding: list row `py-4`; featured row `py-4` with `gap-3` inside; media item (mod) `py-9`; figure `my-8 p-4`,
caption `py-2.5 px-4`; terminal bar `h-7`, screen `px-4 pb-2.5`; footer `pt-11 pb-14`, links `gap-3`.

- `ItemGroup` whose children are not real list items must pass `role="none"` (upstream `ItemGroup` ships `role="list"`).

---

## 5. Responsive

claude.dev has about ten media queries, but only one of them changes the layout (900-1000px). Spark maps them onto
Tailwind's four default breakpoints and writes classes mobile-first.

| Breakpoint | claude.dev | Kind | What changes |
| :--- | :--- | :--- | :--- |
| `xl` 1280 | 1200, 1280 | Tuning | Widest: rail at full 4 columns, rows on one line (date, title, duration) |
| `lg` 1024 | 900, 1000, 1100 | **Layout** | Below lg: nav becomes a burger, rail stacks above content and stops being sticky, TOC hides, rows split into two lines, featured post stacks, media items put media on top |
| `md` 768 | 800, 860 | Hide extras | Below md: keyboard hint and category column hide, tabs wrap, newsletter goes one column |
| `sm` 640 | 440, 600, 640 | Margins and rhythm | Below sm: gutter `px-6`, nav `h-18`, prose `text-base`, footer two columns, terminal square, outer spacing tiers shrink |

| Component | < sm | sm to lg | >= lg |
| :--- | :--- | :--- | :--- |
| Nav | `h-18`, burger | `h-24`, burger | `h-24`, full links with `[X]` keys |
| Rail / content | Stacked: rail becomes a static header block | Stacked | 4 / 8 columns, rail sticky |
| Article TOC | Hidden (share links only) | Hidden | Sticky in the rail |
| Post row | Two lines, date hidden | Two lines: title / date + duration | One line |
| Article meta | `grid-cols-2` | `grid-cols-3` | `grid-cols-3`, aligned to grid columns |
| Footer | `grid-cols-2`, brand and newsletter full width | `grid-cols-3` | Brand, two link columns, newsletter |
| Spacing T5 / T6 / T7 | `gap-10` / `pt-12` / `mt-16` | `gap-14` / `pt-20` / `mt-28` | same |

Principles:

- **One layout breakpoint.** Only `lg` may restructure a page; `sm`, `md` and `xl` adjust margins, hide extras or tune
  column ratios.
- **Reflow, don't shrink.** Type sizes barely change; rows split into two lines instead of truncating. The title always
  gets the first line.
- **Hide from least to most important:** keyboard hint, category, tile and TOC, then date. Titles, durations and CTAs
  never hide.
- **Hover effects need a mouse.** Tailwind v4's `hover:` already applies only under `(hover: hover)`; on touch, the
  tapped row takes the hover's role.
- **Shrink the outer tiers, keep the inner ones.** Only the gutter and T5-T7 change below `sm`.

```tsx
{/* Shell: rail stacked on mobile, 4/8 from lg */}
<div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-0">
  <aside className="lg:sticky lg:top-24 lg:col-span-4 lg:self-start lg:pr-10" />
  <main className="min-w-0 lg:col-span-8" />
</div>

{/* Post row: title on line 1, date + duration on line 2; one line from lg */}
<a className="flex items-start gap-4 border-b py-4 lg:items-center">
  <PixelIcon className="size-8 shrink-0" />
  <div className="flex min-w-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-8 lg:items-center lg:gap-0">
    <span className="text-base lg:order-2 lg:col-span-5">{title}</span>
    <span className="flex gap-4 font-mono text-sm text-ink-3 lg:contents">
      <time className="max-sm:hidden lg:order-1 lg:col-span-2" />
      <span className="lg:order-3 lg:col-span-1 lg:text-right">{minutes}</span>
    </span>
  </div>
</a>
```

---

## 6. Components

shadcn `base-lyra`: square corners (`--radius: 0`), compact sizes, `text-xs` buttons.

| Need | Use |
| :--- | :--- |
| Primary CTA | `<Button size="lg">` (h-9) |
| Button in a form or toolbar | `<Button>` (h-8) or `size="sm"` (h-7) |
| Secondary action | `variant="outline"` |
| "Featured" chip | `<Badge variant="default">` |
| Category chip | `<Badge variant="outline">` |
| Filter tabs | `<Tabs>`, `<TabsList variant="line">` |
| Form error / success notice | `<Alert variant="destructive">` / `<Alert variant="success">` |

Installed today: alert, button, input, input-group, label, skeleton, spinner, textarea. Badge and Tabs are not installed
yet; add them before use. Install new components from `apps/web` (`pnpm dlx shadcn@latest add <name>`); the CLI writes into `packages/ui` through
the `ui` alias. Both `components.json` files must keep the same `style`.

Patterns specific to this language:

- **Inverted hover** on list rows: `hover:bg-primary hover:text-primary-foreground`, other rows dim to `opacity-35`.
- **`└` marks hierarchy** in the TOC, article meta and spec lists, in `text-ink-4`.
- **Bracketed keys** `[H]` before primary nav items, with matching keyboard shortcuts.
- **Mono uppercase labels** for metadata, never for body text.

---

## Logo

`AppLogo` (`apps/web/components/shared/app-logo.tsx`): an 8x8 pixel mark, a `>` prompt in ink (`currentColor`, follows
the theme), a little spark in `brand` and one `ink-4` ember, drawn as `<rect>`s with `shape-rendering="crispEdges"`.
The project line behind it: *everything starts with a little spark* (context only, never shown).

| Prop | Values | Use |
| :--- | :--- | :--- |
| `variant` | `full` (default) · `mark` · `wordmark` | `mark` where space is tight or for icons; `wordmark` when the mark already shows nearby |
| `size` | `sm` 16px · `md` 24px (default) · `lg` 32px | Mark and wordmark scale together; the wordmark is mono `font-medium tracking-tight` (`text-sm/none` / `text-lg/none` / `text-2xl/none`) |
| `motion` | `idle` (default) · `static` | The logo is always alive: `idle` everywhere in the app (sidebar, headers, auth). `static` only where the mark must stay still (print, dense lists) |

Rules:

- Sizes are whole multiples of the 8x8 grid (16, 24, 32px) so every pixel stays crisp. Never scale the mark freely.
- Do not redraw or recolor the mark at the call site; wrap it in a `Link` when it navigates. The logo is a block-level
  `flex w-fit` box (an inline box would sit on the text baseline and add a gap below it).
- `idle` animates only under `motion-safe`; with reduced motion it renders exactly like `static`.
- The favicon is `apps/web/app/icon.svg`, the same mark with fixed light/dark colors (`prefers-color-scheme`).

## Pet

Mochi, the orange loaf cat (`features/pet/components/mochi.tsx`), is the **second orange element** the system allows on
a screen, next to the logo. It lives only on Today.

- **Palette:** `--cat-o/d/m/l/c/e/n/y`, `--mikan`, `--mikan-l`, `--mikan-d`, `--leaf` in `globals.css` (both themes), exposed
  as `fill-cat-*` utilities. They paint the sprite only; never use them for UI.
- **Drawing:** one hand-drawn pixel template plus overlays (tail, eyes, tangerines), `shape-rendering="crispEdges"`, one
  `<path>` per colour.
- **Motion:** like the logo, a documented exception to "only colors are custom": `--animate-cat-*` keyframes use
  `steps()` so pixels jump. Always `motion-safe:`; with reduced motion the cat is static (tail down, eyes open).
- **Heatmap:** `--heat-1..4` stay neutral, so the map never competes with the cat.

---

## 7. Navigation

- Site nav: sticky, `h-24` (`max-sm:h-18`), brand left, links with `[X]` keys in the middle, commands and CTA right.
- Below `xl` (or whenever the links stop fitting) the links move into a **burger panel**: a `size-9` button with three
  2px bars that turn into an X (`aria-expanded`, `aria-controls`). The panel drops under the nav, full width, `bg-background
  border-b`, groups labelled with mono `text-xs` headings, links `font-mono text-sm py-2.5`. It closes on link click, Esc,
  outside click, and when the viewport grows past the breakpoint.
- Between `xl` and `2xl` hide the `[X]` brackets first (keys still work), then fall back to the burger.
- In-page links scroll with an offset equal to the nav height (`scroll-mt-24`); the logo always scrolls to `0` and clears
  the hash, so clicking it twice still works.

---

## 8. Dashboard shell

The app layout extends the same language: the article TOC "tree" becomes the sidebar, the Mods spec list becomes the
inspector. Reference demo: the "Spark Design System" artifact, section 06.

### Anatomy

Three full-height columns. Each column is a **header cell** plus a scrolling body. All header cells use one shared
component so they always line up and the hairline runs straight across.

```tsx
function ColumnHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex h-14 shrink-0 items-center gap-4 border-b px-4">{children}</div>
}
```

| Column | Header cell | Body |
| :--- | :--- | :--- |
| Sidebar (shadcn `<Sidebar collapsible="offcanvas">`, `w-64`, `xl:w-72`) | Logo + workspace switcher | `px-4 py-6 gap-8`: one labelled **section** per nav group (`WORKSPACE`, `SETTINGS`, ...), then account pinned to the bottom |
| Main (`flex-1 min-w-0`) | Burger + logo (below `md` only), path breadcrumb (`dashboard / settings / account`, no project name), `[B]` `[D]` commands (`[/]` `[I]` when search and inspector exist), `<Button size="sm">` | `px-4 sm:px-8 pt-10 pb-14 gap-8`: page head, metrics, tabs + list |
| Inspector (`w-80`, `border-l`) | Record id + `[ESC]` | `p-6 gap-8`: title, `└` spec list, `└` activity, actions |

Adding another side panel later means adding another column with a `ColumnHeader`; nothing else moves.

Scroll areas hide their scrollbar but stay scrollable (mouse, keys, touch):

```css
@utility no-scrollbar { scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
```

### Sections

The sidebar holds any number of **sections**, each a mono `text-xs` uppercase label over a tree
(`config/navigation.ts`, `NavSection`). Name a section after what its pages are about (`Workspace`, `Settings`,
`Projects`), never after the widget ("Tree", "Menu"). A section whose links the role cannot open is hidden. Inside a
section an entry is a link or a collapsible group of links (two levels max).

Header commands are `[X] LABEL` buttons: mono `text-xs` uppercase, key in `ink-3`, label in `ink-2`, `aria-pressed` for
toggles. Every command has its bare-key shortcut (ignored while typing): `[B]` sidebar (shadcn's Cmd/Ctrl+B also works),
`[D]` theme. The account row shows `└`, a user icon, name and role. Icons are functional only: one per navigable page (and the
account row), never on group headers or menu items; the `└` glyph stays next to them as the hierarchy mark.

Main header below `md` (or while the sidebar is collapsed): burger, wordmark, `/`, current page in ink, truncated
with `…` rather than wrapping.

### Icon rail

The sidebar uses `collapsible="icon"`: `[B]` (or a click on the rail edge) shrinks it from `w-64` to a 48px rail instead of
hiding it, so every page stays one click away.

- Every nav link carries `└`, its icon and its label. In the rail only the icon shows (the glyph and label hide; the
  current page's icon turns brand orange there) and a right-side tooltip names it (`SidebarMenuButton`'s rule: only
  while collapsed on desktop).
- The rail lists individual pages only, never groups: a section label becomes a hairline between sections, a collapsible
  group loses its header and its links show flat (open or closed). The logo shrinks to its mark and the account row to
  a user icon whose menu opens to the right.
- Icons are named in `config/navigation.ts` (`NavLink.icon: NavIconName`) and resolved to components in
  `components/layout/nav-icons.tsx` (a `Record`, so a new name without an icon fails typecheck). Names, not components,
  because `entries` cross from a Server Component to the client `NavTree`.
- Rows use `group-data-[collapsible=icon]:*` variants of the sidebar's own `group` wrapper; no JS state except the tooltip.

### Tree items (the large TOC)

| State | Look | Classes |
| :--- | :--- | :--- |
| Default | `└` in ink-4, Tabler icon `size-4` in ink-3, label ink-2 | `font-mono text-sm py-1.5 text-ink-2` |
| Hover | Label ink and nudged 4px right, icon ink-2, hover surface | `hover:bg-accent hover:text-foreground` |
| Current | `└` turns brand orange, icon and label ink, medium | `aria-current="page"`, glyph `text-brand` |
| Group | `└`, label and a caret that rotates when collapsed (no icon); children indent | `aria-expanded`, children `pl-4` |
| Count | Mono, right aligned | `ml-auto text-xs text-ink-3 tabular-nums` |

Keep the tree at most two levels deep; deeper structure belongs on its own page. Keyboard: arrows move, left/right
collapse and expand groups, Enter opens.

### Content conventions

- **Orange appears once per screen**: the current tree glyph (plus at most one focal chart mark). The logo's spark is
  identity and does not count. Status uses small
  square dots: ink for "needs review", `diff-del` for blocked, ink-4 for done.
- **No big-number tiles.** Metrics are one `dl` row: mono `text-xs` label, `text-2xl font-medium` value, separated by space.
- **Selected list row is inverted** (`bg-primary text-primary-foreground`); hover is only `bg-accent`.
- **The inspector is context, not a route.** Selecting a row updates it in place.
- **Usage meters are dithered**: solid ink fill over a 2px checker of ink-4.
- One tier denser than marketing pages on the outside only: page top `pt-10` instead of `pt-20`, sections `gap-10`
  instead of `gap-14`; T1 to T4 unchanged.

### Responsive

| Region | < lg | lg to xl | >= xl |
| :--- | :--- | :--- | :--- |
| Sidebar | Hidden below `md` (shadcn's `useIsMobile`, 768px); burger opens it as a left Sheet | `w-64` from `md`; `[B]` collapses it to a 48px icon rail | same |
| Inspector | Right Sheet, full width below `sm` | Right Sheet `w-80` over a scrim | Fixed column, toggled with `[I]` |
| Logo | Main header, next to the burger | Sidebar header | Sidebar header |
| List row | Two lines: title / id, status, time | One line | One line |
| Metrics | `grid-cols-2` | `grid-cols-4` | `grid-cols-4` |
| Header commands | Keys only (`[D]`; `[B]` hidden below `md`, the burger takes over) | Keys and labels from `lg` | Keys and labels |

Needed components: `pnpm dlx shadcn@latest add sidebar sheet badge tabs` (from `apps/web`). shadcn's sidebar width
comes from the `--sidebar-width` variable; change it in the theme rather than with a class.

### Implementation (apps/web)

shadcn files in `packages/ui` are **never edited**, so `shadcn add --overwrite` and future migrations stay clean. The
Spark look is composed on top in `apps/web/components/layout/`:

**Inspector (implemented):** `components/layout/inspector.tsx` holds `InspectorProvider` (state, `useMediaQuery` for `xl`),
`InspectorCommand` (`[I]`, header) and `InspectorPanel` (a fixed `w-80 border-l` column from `xl`, a right `Sheet` below it,
`[ESC]` closes). The layout fills it with a server component (`app/(dashboard)/_components/inspector-content.tsx`): the pet
and "This week" (`WeekStrip` + `DitherMeter`, both in `components/shared/`). Dithered meters use the `bg-dither` utility.

| Part | File | Built from |
| :--- | :--- | :--- |
| `ColumnHeader` | `column-header.tsx` | Plain `div` (`h-14 border-b px-4`) |
| `AppSidebar`, `AppSidebarBody`, `AppSidebarSection` | `app-sidebar.tsx` | `Sidebar collapsible="offcanvas"`, `SidebarContent` |
| `NavTree` | `nav-tree.tsx`, `nav-icons.tsx` | `SidebarMenu` / `SidebarMenuItem` for structure; its own `Link` row for the tree look; `Tooltip` names the icon in the rail. One per section |
| `SidebarCommand`, `ThemeCommand` | `header-commands.tsx` | `HeaderCommand` button + `hooks/use-hotkey.ts` |
| `UserMenu` | `user-menu.tsx` | `DropdownMenu`; items are passed as children (sign out comes from `features/auth`) |
| `DashboardBreadcrumb` | `dashboard-breadcrumb.tsx` | `Breadcrumb`; segments from the URL, index pages append their nav title |
| `PageHead`, `Metrics`, `SpecList` | `page-head.tsx`, `components/shared/` | Plain markup |
| `InfoHint` | `components/shared/info-hint.tsx` | `Popover` + ghost `icon-xs` `Button`; copy comes from `config/help.ts` (also read by the Guide page). `PageHead`, `Metric` and section titles take a `hint` key |
| `ResponsiveDialog` | `components/shared/responsive-dialog.tsx` | `Dialog` from `md` up, bottom `Drawer` below (shadcn "Responsive Dialog"); `size` `md` or `lg`; `DialogActions` for the button row. Use it for every form that opens over a page; `AlertDialog` stays for confirmations |

Two consequences of not editing shadcn: the sidebar switches to a Sheet below `md` (768px, hard-coded in shadcn's hook)
instead of `lg`, and keeps one width (`16rem`); `xl:w-72` would need an arbitrary value. The inspector column is not built
yet: add it with a `ColumnHeader` when the first list feature needs it.

---

## 9. Motion

Tailwind durations and easings only: `ease-out` to enter, `ease-in-out` to leave.

| Interaction | Classes |
| :--- | :--- |
| Color change (links, tabs, rows) | `transition-colors duration-150` |
| Small movement (arrow, TOC item) | `transition-transform duration-200 ease-out`, `translate-x-1` |
| Dropdown caret | `rotate-180 duration-300` |
| Reveal on enter | `tw-animate-css` fade/slide, `duration-500`/`700`, stagger `delay-75` steps |
| Theme switch | Instant (`disableTransitionOnChange`) |

Everything must respect `prefers-reduced-motion` (`motion-safe:` / `motion-reduce:`).

Applied in `apps/web`:

| Pattern | Where | Implementation |
| :--- | :--- | :--- |
| Stagger on enter (slide up 8px, `duration-500`, `delay-75` steps) | Dashboard body, auth form column | `components/shared/stagger.tsx` (direct children, `*:nth-N:delay-*`). Plays once per element: Cache Components hides visited routes with `display: none` and a CSS animation restarts when its element is shown again, so each child switches its animation off when it ends (`onAnimationEnd`) and going back is instant |
| Terminal lines reveal in order | Auth rail | `app/(auth)/_components/terminal.tsx` (`step` prop) |
| Burger bars turn into an X (`duration-300 ease-out`) | Dashboard header below `md` | `components/layout/burger.tsx` |
| TOC nudge (`translate-x-1`, `duration-200`) | Sidebar nav rows | `NavTree` `RowLabel` |
| Arrow slides on hover (`translate-x-1`) | Auth switch link, 403 CTA | `group-hover` on the icon |
| Caret rotates (`duration-300`) | Collapsible nav group | `NavTree` `TreeGroup` |

| Spark twinkles (`+` → `×`), embers rise, `steps()` frames | Every logo (sidebar, headers, auth) | `AppLogo` (`motion="idle"` by default), `--animate-spark-*` |

Not used: the typing intro and ambient float (custom keyframes are allowed for the logo only), and the theme switch
stays instant.

---

## 10. Accessibility

- Focus: visible `outline` with `outline-offset-2`; never remove it without a replacement.
- `ink-4` is decorative; readable text uses `ink-3` or stronger. Orange text uses `brand-ink`.
- Anchor targets sit below the sticky nav: give them `scroll-mt-24` (`max-sm:scroll-mt-18`).
- `::selection` uses `bg-brand text-background`.
