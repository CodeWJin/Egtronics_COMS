---
name: Egtronics COMS
description: A factory-floor workbench for EV charger sales/production/QC/AS — flat hairline cards, pill-shaped Action Blue controls, and status badges built to stay legible under direct light, on Pretendard.
colors:
  primary: "#2563EB"
  primary-focus: "#1d4ed8"
  primary-on-dark: "#93c5fd"
  primary-tint-50: "#eff6ff"
  primary-tint-100: "rgba(37, 99, 235, 0.18)"
  ink-1: "#1d1d1f"
  ink-2: "#333333"
  ink-3: "#6b6b6b"
  ink-4: "#636363"
  ink-5: "#cccccc"
  ink-inverse: "#ffffff"
  placeholder: "#737373"
  bg-canvas: "#f5f5f7"
  surface: "#ffffff"
  surface-2: "#f5f5f7"
  surface-3: "#fafafc"
  border-hairline: "#e0e0e0"
  border-strong-2: "#cccccc"
  border-strong-3: "#7a7a7a"
  success: "#10B981"
  success-tint: "#ECFDF5"
  success-deep: "#047857"
  warning: "#F59E0B"
  warning-tint: "#FFFBEB"
  warning-deep: "#B45309"
  danger: "#EF4444"
  danger-tint: "#FEF2F2"
  danger-deep: "#B91C1C"
  progress-indigo: "#4338CA"
  progress-indigo-tint: "#EEF2FF"
  role-admin: "#5B21B6"
  role-admin-tint: "rgba(124, 58, 237, 0.10)"
  login-void: "#07111f"
  nav-void: "#0a0d13"
typography:
  screen-title:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.5px"
  drawer-title:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.19
    letterSpacing: "-0.5px"
  card-title:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.24
    letterSpacing: "-0.374px"
  body:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.47
    letterSpacing: "-0.374px"
  label:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.224px"
  caption:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.12px"
  caption-lg:
    fontFamily: "Pretendard Variable, system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.12px"
  mono:
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  nav-readout:
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, ui-monospace, monospace"
    fontSize: "10-10.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "11px"
  lg: "18px"
  xl: "20px"
  xxl: "22px"
  pill: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-focus}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.pill}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 18px"
    height: "36px"
  button-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    typography: "{typography.screen-title}"
    rounded: "{rounded.lg}"
    padding: "20px 22px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 14px"
  badge:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  kanban-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    typography: "{typography.card-title}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  drawer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    width: "560px"
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.xxl}"
    width: "480px"
  toast:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  report:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.xxl}"
    width: "720px"
---

# Design System: Egtronics COMS

## 1. Overview

**Creative North Star: "The Reliable Workbench" (믿음직한 작업대)**

Egtronics COMS is a shift-floor tool for EV charger sales, production, QC, and AS staff who move between an office desktop and a tablet on the production line. Nothing here is trying to be a product — the order is the product, the serial number is the product, the checklist item is the product. The chrome recedes: flat white cards with a 1px hairline border, a true-black top nav, and exactly one accent color (Action Blue) doing all of the "click me" signaling. This is deliberately **not** a global SaaS dashboard clone (no Notion/Linear/Vercel mimicry) and **not** AI-양산 디자인 — no gradient text, no glassmorphism, no identical hero-metric cards. It borrows Apple's structural restraint (flat surfaces, pill buttons, negative letter-spacing at display sizes) but replaces SF Pro with Pretendard and drops the photography-first posture entirely: there is no product imagery here, only data that needs to be scanned fast, under warehouse lighting, sometimes with gloves on.

Status is the one place the system allows itself color: PENDING/IN_PROGRESS/AWAIT_PICKUP/COMPLETED badges and the KPI stat-tile top accent bar are the only saturated surfaces in an otherwise near-monochrome UI, and they always pair color with text — never color alone.

**Key Characteristics:**
- Flat, hairline-bordered cards on a near-white canvas (`{colors.bg-canvas}` #f5f5f7); shadows are reserved for things that float above content (drawer, modal, popover, toast), never for resting cards.
- Single accent (`{colors.primary}` Action Blue #2563EB) carries every button, focus ring, and selected-row state; the top nav's active-tab indicator uses the related `{colors.primary-on-dark}` instead (see Navigation).
- Pretendard Variable throughout, tuned to a 17px/1.47 body reading pace — the same "read, don't scan" pace Apple uses, applied to Korean text.
- The top nav runs on `{colors.nav-void}` (#0a0d13) — a near-black with the same cool undertone as `{colors.login-void}`, not pure `#000000`. It's one of two dark "console" surfaces in the system (with the login panel); everything else lives in the `ink` ramp (near-black, never pure black on body content).
- A distinct dark, grid-patterned split-panel login screen (`{colors.login-void}` #07111f) is the one deliberately atmospheric surface in the system — an "industrial console" moment before the flat workbench begins.
- Every interactive control has a visible `:focus-visible` ring and a `:active { transform: scale(0.96) }` press response — the system-wide micro-interaction that makes touch input on tablets feel acknowledged.
- Motion is staggered per-item (kanban cards, table rows, timeline entries use a `--i` custom property for a 20–35ms cascade) but every animation collapses under `prefers-reduced-motion: reduce`.

## 2. Colors

The palette is almost entirely neutral; color is spent on exactly two things — the single interactive accent and the four order-status semantics.

### Primary
- **Action Blue** (`{colors.primary}` — #2563EB): Every button, link, focus ring, selected table row, and chip-active state on light surfaces. Nothing else in the interface uses blue.
- **Action Blue Deep** (`{colors.primary-focus}` — #1d4ed8): Hover/press state for primary buttons only.
- **Sky Link Blue** (`{colors.primary-on-dark}` — #93c5fd): The accent reserved for dark "console" surfaces, where full-strength Action Blue would sit too dark to read cleanly — the login panel's feature-icon glyphs and watermark, and the top nav's contact-pin active indicator, focus ring, and active-count readout (see Navigation).

### Surface
- **Canvas** (`{colors.bg-canvas}` — #f5f5f7): App shell background and secondary surfaces (toolbar tops, table headers, kanban columns).
- **Pure White** (`{colors.surface}` — #ffffff): Cards, drawers, modals, inputs — the working surface everything sits on.
- **Pearl** (`{colors.surface-3}` — #fafafc): Readonly inputs, badge backgrounds, icon chips — a whisper darker than white so passive elements don't read as editable.
- **Nav Void** (`{colors.nav-void}` — #0a0d13): The top nav's surface — near-black with a cool undertone shared with `{colors.login-void}`, the app's other dark surface. Not used anywhere else.

### Text
- **Near-Black Ink** (`{colors.ink-1}` — #1d1d1f): Headlines, card titles, primary data values. Never pure black on body content — only the top nav goes true black.
- **Ink 2** (`{colors.ink-2}` — #333333): Field labels, secondary emphasis.
- **Ink 3 / Ink 4** (`{colors.ink-3}` #6b6b6b / `{colors.ink-4}` #636363): Captions, table header labels, metadata — both verified at ≥5.3:1 against white per the codebase's own WCAG AA comments.
- **Placeholder** (`{colors.placeholder}` — #737373): Input placeholder text, deliberately darker than a typical gray-400 default to clear the 4.5:1 bar.

### Borders
- **Hairline** (`{colors.border-hairline}` — #e0e0e0): The one structural border in the system — cards, tables, toolbars, dividers.
- **Border Strong** (`{colors.border-strong-2}` — #cccccc): Input borders, stronger dividers.

### Semantic (order status + role badges)
- **Success** (`{colors.success}` — #10B981): COMPLETED status, pass marks on inspection reports, success icon chips.
- **Warning** (`{colors.warning}` — #F59E0B): PENDING status, beta/experimental tag borders.
- **Danger** (`{colors.danger}` — #EF4444): Errors, delete confirmations, required-field markers, AS fault stamps.
- **Progress Indigo** (`{colors.progress-indigo}` — #4338CA): IN_PROGRESS status and the quality role badge — kept visually distinct from Action Blue so "this order is moving" never gets confused with "this is clickable."
- **Role Violet** (`{colors.role-admin}` — #5B21B6, tint `{colors.role-admin-tint}`): The admin role badge only (login demo-account list, user-menu header) — sales/production/quality role badges reuse Action Blue/Success/Progress Indigo respectively, so violet exists solely to give admin its own identity in that one 4-way set.

### Named Rules
**The One Accent Rule.** Action Blue is the only color a user is ever invited to click on a **badge** — `.badge--*` colors report state, never invite interaction; if it's green/amber/red/indigo on a badge, it's a fact, not a control. This rule scopes to badges specifically. **Buttons are a separate affordance category**: `.btn--success` / `.btn--warning` / `.btn--danger` are semantic action-button variants (documented under Buttons above) — every button is clickable by definition, so recoloring a button to reflect the state of the action it performs (e.g. `.btn--warning` on an in-progress 출하검사 button, `quality-AwaitPickup.jsx`) is not a violation of this rule. Don't extend a badge's state color onto a *new* clickable element without going through the button component first.

## 3. Typography

**Body Font:** Pretendard Variable (with `system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif` fallback)
**Mono Font:** JetBrains Mono (with `Cascadia Code, Consolas, ui-monospace` fallback) — serials, lot numbers, AS ticket IDs

**Character:** One variable sans family carries the entire interface at weight 400/500/600 — no display face, no serif contrast pairing. Negative letter-spacing (`-0.12px` to `-0.5px`) at every size above 12px keeps the Korean/Latin mixed strings (model codes, serial numbers) from feeling loose.

### Hierarchy
- **Screen Title** (`{typography.screen-title}` — 600, 28px, 1.14, -0.5px): Top of every screen (`.screen__title`). The largest text in the app — there is no larger "hero" size, this is a tool, not a landing page.
- **Drawer/Modal Title** (`{typography.drawer-title}` — 600, 21px, 1.19, -0.5px): Drawer and modal headers.
- **Card Title** (`{typography.card-title}` — 600, 17px, 1.24, -0.374px): Card headers, kanban card titles, order-card model name.
- **Body** (`{typography.body}` — 400, 17px, 1.47, -0.374px): Default paragraph and login form inputs — the same 17px "reading pace" size used everywhere text needs to be read rather than scanned.
- **Label** (`{typography.label}` — 600, 14px, 1.3, -0.224px): Field labels, button text, card subtitles.
- **Caption** (`{typography.caption}` — 500, 12px, 1.3, -0.12px): Table headers, badges, metadata, timestamps — the densest text in the system.
- **Caption Large** (`{typography.caption-lg}` — 500, 13px, 1.3, -0.12px): One step up from Caption for secondary table cells and card metadata that need slightly more presence than the 12px floor (e.g. `.cell-mono`, `.as-card__no`, kanban card IDs) without escalating to Label's 14px/600 weight.
- **Mono** (`{typography.mono}` — 400, 12px monospace): Serial numbers, lot codes, AS ticket numbers (`AS-250101-0001`), order IDs — anywhere a value must be copy-pasted or scanned character-by-character.
- **Nav Readout** (`{typography.nav-readout}` — 500, 10–10.5px monospace, tabular-nums): The top nav's own micro-scale, one step below Mono — tab item counts and the version tag. Extends the Mono-For-Machine-Values Rule to the nav: a tab's count is a live measurement (how many orders are queued), not prose.

### Named Rules
**The Reading-Pace Rule.** Body copy runs at 17px, not 16px, everywhere a user reads rather than scans — the same deliberate 1px-over-convention choice Apple made, applied here to reduce misreads of Korean customer/model names during fast tablet input.
**The Mono-For-Machine-Values Rule.** Any value a human didn't compose in prose — serial numbers, lot codes, ticket IDs — renders in `{typography.mono}`, never body font. It signals "this is exact, copy it precisely."

## 4. Elevation

The system is **flat by default with hairline borders**, not shadow-driven. Resting surfaces — cards, kanban columns, table wrappers, order cards, the stat tiles — carry a 1px `{colors.border-hairline}` border and zero shadow. Shadow is reserved exclusively for surfaces that visually float above the content plane: drawers, modals, dropdown/combo menus, the user-menu popover, and toasts. This mirrors the "the wall disappears, elevation only appears with intent" logic the codebase inherited from its Apple-inspired foundation, but here the intent is functional, not photographic — a shadow means "this is temporarily on top of everything else," not "this deserves visual weight."

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)` — `{shadow.3}` in CSS): Dropdowns, combo menus, popovers, toasts.
- **Drawer** (`box-shadow: -12px 0 40px rgba(0,0,0,0.12)`): The right-side slide-in drawer — directional, implying it entered from off-screen right.
- **Modal / Report** (`box-shadow: 0 24px 64px rgba(0,0,0,0.16–0.18)`): Center-screen modals and printable inspection reports — the deepest shadow in the system, reserved for the one thing that's fully blocking interaction underneath.
- **Hover-lift** (`box-shadow: 0 4px 14px rgba(0,0,0,0.09)` + `translateY(-1px)`): Kanban cards and order cards on hover only — the single case where a resting card gains elevation, signaling "this is about to open."

### Named Rules
**The Flat-By-Default Rule.** If a surface is part of the page layout, it gets a border, not a shadow. Shadow always means "layered above the page," never "this card is important."

## 5. Components

### Buttons
- **Shape:** Full pill (`{rounded.pill}`) for all primary/secondary/success/danger/warning actions; compact rect (`{rounded.sm}`) reserved for icon-only and ghost utility buttons.
- **Primary** (`{component.button-primary}`): Action Blue fill, white text, 36px height, `0 18px` padding. Hover deepens to `{colors.primary-focus}`; `:active` scales to 0.96 — the one micro-interaction every button shares.
- **Secondary** (`{component.button-secondary}`): White fill, Action Blue text and border — the "second-choice" action next to a primary pill.
- **Ghost** (`{component.button-ghost}`): Transparent, `{colors.ink-2}` text, compact rounding — utility actions (filters, table actions) that shouldn't visually compete with the primary CTA.
- **Semantic variants:** `.btn--success` / `.btn--danger` / `.btn--warning` swap the fill only; shape and interaction states stay identical to primary. Never introduce a fourth semantic color outside success/warning/danger/primary.
- **Sizes:** `{component.button-lg}` (44px, the touch-safe size) for primary flows on tablet; default 36px for desktop-dense toolbars; `--sm`/`--tag` variants expand to a 44px hit-box under `pointer: coarse` even though they render visually smaller — touch safety without changing desktop density.

### Chips & Badges
- **Chip** (`{component.chip}`): Pill, white background, hairline border — filter toggles, model/version tag pickers. `{component.chip-active}` swaps to solid Action Blue fill.
- **Badge** (`{component.badge}`): Status pills — `--pending` (warning tint), `--progress` (indigo tint), `--complete` (success tint), `--danger`, `--neutral`. Always paired with text, never a bare color dot.

### Cards & Containers
- **Card** (`{component.card}`): 18px radius, white fill, 1px hairline border, no shadow. The default container for every grouped section.
- **Stat Tile** (`{component.stat-tile}`): Same card shell plus a 3px colored top accent bar (`--stat-accent`) — the one place a card carries a color cue, used for KPI dashboards where the accent maps to the metric's semantic color.
- **Kanban / Order Card** (`{component.kanban-card}`): 11–18px radius, hairline border at rest, promotes to Action-Blue border + hover-lift shadow + 1px translateY on hover — signals "clickable, opens a drawer."

### Inputs & Forms
- **Input** (`{component.input}`): 8px radius, 40px height, hairline border, Action Blue border + 3px tinted ring on focus. Error state swaps border to `{colors.danger}` with a `{colors.danger-tint}` fill and a 320ms horizontal shake on first appearance.
- **Select:** Same shell as input with a custom chevron SVG (no native OS arrow) so desktop and tablet render identically.
- **Readonly:** Fills with `{colors.surface-3}` and `{colors.ink-2}` text — same shape, visually "settled" rather than editable.

### Navigation (signature component)
- **Top nav — "Contact Rail":** `{colors.nav-void}` (#0a0d13), 64px tall (56px on tablet, 54px on phone), white text at low opacity for inactive tabs, full white + weight 600 for the active tab. The active-tab indicator is not a flat underline — it's a small cluster of 3 lit connector pins (rounded 3×3px squares, `{colors.primary-on-dark}`, soft glow), a direct reference to an EV charging connector's contacts, and it ignites with a 180ms fade+scale on tab switch. Tab item counts and the version tag render as `{typography.nav-readout}` chips (mono, 4px-radius rect, translucent white border) rather than pills — a "metered readout" texture that's deliberately distinct from the pill-shaped status badges used everywhere else in the app, so a nav count is never mistaken for an order-status badge. Focus-visible on tabs uses `{colors.primary-on-dark}` (not `{colors.primary}`) with a −2px inset outline, matching the login panel's rule for dark surfaces. This is the one place the pill-radius rule (`{rounded.pill}` for every button/chip/badge) is deliberately broken, and it's broken consistently across everything inside the nav.
- **Drawer** (`{component.drawer}`): 560px right-side slide-in, white, sectioned body that staggers each `<section>` in on open (50ms cascade). Full-width bottom sheet on mobile (≤600px) instead of a side panel.
- **Modal** (`{component.modal}`): 480px centered, white, 22px radius, deepest shadow in the system.

### Login (signature component)
A deliberately atmospheric split panel — the one screen in the app allowed a dark, textured surface. Left panel: `{colors.login-void}` (#07111f) with a faint 38px blueprint grid pattern, white brand mark, feature bullets in low-opacity white, a subtle blue watermark icon. Right panel: plain white form on `{component.input}` shells, full-pill submit button. Collapses to a stacked single column (dark header strip + form below) under 768px.

### Inspection Report Document (signature component)
The printable 성적서 (`{component.report}`) is the one place the flat workbench allows a document metaphor: a 720px white sheet, 22px-radius, the system's deepest shadow (`0 24px 64px rgba(0,0,0,0.16)`), with a double-ruled `{colors.ink-1}` header rule instead of a hairline. Pass marks render as a pill-outlined `{colors.success-deep}` badge (`.report__pass`), never a bare checkmark. A rotated circular `{colors.danger}` stamp (`.report__stamp`, -9° tilt, 82% opacity) marks the document as an official inspection artifact — the one decorative flourish permitted in the entire system, and it's load-bearing (denotes formal sign-off), not ornamental. Serial numbers and lot codes inside the table render in `{typography.mono}`. On `@media print`, all chrome (`.report__bar`) is hidden and only the document prints full-bleed.

## 6. Do's and Don'ts

### Do:
- **Do** use `{colors.primary}` Action Blue for every clickable element and nothing else — badges and status colors report state, they never imply "click me."
- **Do** give every status badge a text label alongside its color — PENDING/IN_PROGRESS/AWAIT_PICKUP/COMPLETED must never be color-only, per PRODUCT.md's accessibility principle.
- **Do** keep resting surfaces flat with a 1px hairline border; reserve shadow for drawers, modals, dropdowns, and toasts only.
- **Do** run body copy at 17px/1.47/-0.374px — the deliberate "reading pace" pixel over the 16px SaaS default.
- **Do** honor 44×44px minimum touch targets on any `pointer: coarse` device, and provide a `prefers-reduced-motion: reduce` fallback for every animation — both are already wired at the CSS layer; extend the pattern, don't bypass it.
- **Do** render machine values (serial numbers, lot codes, AS ticket IDs) in `{typography.mono}`, never body font.

### Don't:
- **Don't** introduce a second accent color — Action Blue is the only "this is interactive" signal in the system.
- **Don't** add drop shadows to resting cards, kanban tiles, or table rows — shadow is reserved for temporarily-floating layers.
- **Don't** replicate global SaaS dashboard chrome (Notion/Linear/Vercel-style sidebars, gradient cards, glassmorphism) — PRODUCT.md names this explicitly as an anti-reference.
- **Don't** ship AI-양산 디자인 patterns: gradient text, hero-metric templates, identical icon-grid cards. PRODUCT.md's anti-reference list applies to every new screen.
- **Don't** use pure black (`#000000`) anywhere — `{colors.nav-void}` and `{colors.login-void}` are the system's only two dark surfaces, and body content stays in the `ink` ramp.
- **Don't** let a status color stand alone without text — this is a hard accessibility requirement, not a style preference.
- **Don't** mix radii grammars outside the nav — `{rounded.sm}` for compact utility controls, `{rounded.lg}` for cards, `{rounded.pill}` for every button/chip/badge elsewhere in the app. The nav's readout chips and contact pins are the one documented exception (see Navigation); don't extend rectangular chip shapes to badges or buttons outside the nav.
