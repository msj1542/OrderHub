---
name: OrderHub
description: B2B ordering, production, and fulfillment console for Glass Tint USA's pre-cut PPF kit wholesale customers
colors:
  brand: "#3575b0"
  brand-hover: "#2a5e8e"
  brand-subtle: "#f0f5fb"
  accent: "#c98b0e"
  accent-subtle: "#fdf4e3"
  canvas: "#f7f8fa"
  panel: "#ffffff"
  sunken: "#eef0f3"
  border-subtle: "#eef0f3"
  border-default: "#dde1e7"
  border-strong: "#c4cad4"
  text-primary: "#16202c"
  text-muted: "#647080"
  status-neutral-text: "#38424f"
  status-info-text: "#20496e"
  status-success-text: "#1e6b40"
  status-warning-text: "#7a5200"
  status-danger-text: "#8b1a14"
  status-urgent-text: "#6b1466"
  status-completed-text: "#3d2e8c"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.571rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  section:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.071rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.929rem"
    fontWeight: 450
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.786rem"
    fontWeight: 700
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  space-1: "2px"
  space-2: "4px"
  space-3: "6px"
  space-4: "8px"
  space-5: "12px"
  space-6: "16px"
  space-7: "20px"
  space-8: "24px"
  space-10: "32px"
  space-12: "40px"
  space-14: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  status-pill:
    backgroundColor: "{colors.status-info-text}"
    textColor: "{colors.status-info-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: OrderHub

> **Provisional system — not a locked identity.** Everything below documents the
> palette and component system *as currently implemented* (`app/tokens.css`,
> `components/ui/*`) so in-progress work has a consistent baseline to build
> against. The steel-blue/cool-grey/amber palette and general styling approach
> were chosen as a working placeholder while the application's functional
> framework was being built out — per the product owner, **they are explicitly
> not committed** and should be expected to change in a dedicated redesign
> pass once the product itself has stabilized. Treat this file as "what's
> there today," not "what OrderHub must look like." Re-run `/impeccable
> document` after that redesign to replace this file, or use `/impeccable
> new-work` to run the redesign itself.

## Overview

**Creative North Star: "The Steel & Amber Ledger"**

OrderHub reads like an accounting-grade ledger for a manufacturing floor:
every order is a line to be tracked, matched, and reconciled as it moves
from submission through cutting, QC, invoicing, and release. Steel-blue and
cool-grey carry the structural weight — panels, borders, body text — while a
single warm amber accent marks what currently needs a human's attention
(an overdue stat, an expedited order, a hover state). The system stays flat
and quiet at rest; elevation only appears as a response to interaction
(hover, an open dropdown, a modal), never as decoration. Status is
color-coded through one small, closed vocabulary of seven pill-shaped
families reused everywhere rather than invented per screen.

This is an **Operate**-mode surface: internal coordinators, production
staff, and accounting live in it for hours, and external customers use it
to place and track orders. Scanability and consistency outrank expression;
personality lives in small, precise details (the pill status vocabulary,
the left-border expedited stripe) rather than in bold color or motion.

**Key Characteristics:**
- Flat by default; shadow is a state response, not a resting decoration.
- One closed status-color vocabulary (7 families) reused for every badge, pill, and row accent — never a one-off color pairing.
- Amber is rare and load-bearing: it always means "this needs attention," never decoration.
- Dense, left-aligned data (tables, stat rows, list rows) over illustrative or marketing-style layout.
- No custom display typeface — the system typeface stack throughout, differentiated by weight and size, not by font family.

## Colors

A cool, structural blue/grey base carrying almost all surface and text weight, warmed by one amber accent used sparingly, plus a closed seven-family status vocabulary that every badge/pill/row-accent in the app draws from.

### Primary
- **Steel Blue** (`#3575b0` / `--color-brand`): the only brand hue. Primary buttons, active nav items and their subtle background fill, links, focus rings, checked-checkbox fill, avatar-initials background. Darkens to `#2a5e8e` (`--color-brand-hover`) on hover/press. In dark mode the role lightens to `#5490c3` (`--blue-400`) rather than reusing the light-mode value, since a mid-tone blue is illegible on the dark canvas.

### Secondary (warm accent)
- **Amber** (`#c98b0e` / `--color-accent`): reserved for "needs attention now" — accent stat cards (e.g. "Awaiting Acceptance" > 0), the CTA hover tint, and small emphasis. Never used for structural chrome (borders, panels, nav). This is deliberate scarcity, not an oversight.

### Neutral
- **Cool Grey scale** (`--grey-50` `#f7f8fa` through `--grey-900` `#16202c`): canvas (`grey-50`), panel/card surfaces (white), sunken surfaces like table headers and pressed states (`grey-100`), three border weights (`grey-100`/`200`/`300` for subtle/default/strong), primary text (`grey-900`), muted text (`grey-500`, deliberately darkened from a lighter draft value to clear WCAG AA contrast on white — see the token comment in `tokens.css`).

### Named Rules
**The One Warm Voice Rule.** Amber is the system's only warm color and its only "look here" signal. It never shares a screen role with a structural color — if something needs attention, it gets amber; if it's just structure, it stays blue/grey.

**The Closed Status Palette Rule.** Every status indicator (order status, work-order status, badges) maps through exactly seven named families — `neutral · info · success · warning · danger · urgent · completed` — each with a fixed bg/border/text triplet, light and dark. `urgent` (expedited) is never conflated with `danger`; an expedited order is not a problem, it's a priority. A new status must be assigned to one of these seven, never given a bespoke pair.

## Typography

**Body/UI Font:** the system sans stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`) — no custom or brand webfont is loaded.
**Mono Font:** system mono stack (`--font-mono`), declared but not yet visibly used in scanned components.

**Character:** Purely a system-native UI voice — hierarchy comes entirely from size and weight (450/550/700/800), not from a distinctive typeface. This reinforces the "operations console" read: nothing about the type calls attention to itself.

### Hierarchy
- **Title** (weight 700, 1.571rem/22px, tight -0.02em tracking): page-level `<h1>` (e.g. "Welcome back, {name}", "Orders").
- **Section** (weight 700, 1.071rem/15px): dialog titles, panel/card headers.
- **Body** (weight 450, 0.929rem/13px, 1.5 line-height): default running text and most UI copy — the base font size for the whole app is 14px (`html { font-size: 14px }`), with this token layered on top.
- **Label** (weight 700, 0.786rem/11px, 0.04em tracking, uppercase): table column headers, small metadata captions ("Requested", "Due").
- **Small/meta** (weight 450–550, 0.857rem/12px): secondary line under a title (role, company name), badge/pill text, timestamps.

### Named Rules
**The Weight-Not-Family Rule.** Every level of hierarchy is expressed by resizing/reweighting one typeface, never by switching families. A second typeface should not be introduced without a deliberate design decision.

## Layout

Fixed **sidebar** (220px expanded / 56px collapsed) + sticky **topbar** (52px, driven by a single `--topbar-h` variable so nothing hardcodes that offset) + a scrollable content column. Content padding is `--space-6` (16px) with vertical rhythm built from `flex flex-col gap-[var(--space-8)]` (24px) between major page sections.

Data-dense regions (stat rows, dashboards) use `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` rather than a fixed column count, so cards reflow naturally at narrower widths. Lists/tables are left-aligned and full-width inside their panel; no centered marketing-style containers appear anywhere in the app shell.

Responsive/mobile-specific layout was not observed in the scanned components (desktop-first, fixed sidebar); treat narrow-viewport behavior as unresolved rather than assume a pattern exists.

## Elevation & Depth

Flat at rest, shadow only as an interaction or layering response — never ambient decoration on static content.

### Shadow Vocabulary
- **sm** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): resting elevation for cards/panels sitting on the canvas (e.g. dashboard stat cards).
- **md** (`0 2px 6px 0 rgb(0 0 0 / 0.08), 0 1px 2px 0 rgb(0 0 0 / 0.04)`): hover state for the same cards, and the resting elevation for anything that floats over content — dropdown menus, select popovers, the avatar menu.
- **lg** (`0 8px 24px 0 rgb(0 0 0 / 0.10), 0 2px 6px 0 rgb(0 0 0 / 0.06)`): modal/dialog content only — the single highest elevation in the system, reserved for content that blocks the rest of the UI.

### Named Rules
**The Elevation-As-Response Rule.** A surface's shadow level should describe *why* it's raised (floating over content vs. blocking all content), not how important it is. Never reach for `lg` to make something "feel bigger."

## Shapes

Three-step radius scale used consistently by role, not by component size: `sm` (6px) for the smallest interactive controls (checkboxes, small icon buttons, the focus-ring corner), `md` (8px) for the default control size — buttons, inputs, selects, badges' container-level use, notification icon buttons — and `lg` (12px) reserved for dialogs and any elevated card-like container. `pill` (9999px) is exclusively for status/badge chips, avatars, and small count bubbles — never for buttons or inputs, which stay at `md`.

Borders are single-pixel and drawn from the three border tokens (`subtle`/`default`/`strong`) rather than opacity tricks in light mode; dark mode borders instead use white-alpha (`rgb(255 255 255 / 0.05–0.18)`) since a fixed grey border reads poorly against a dark panel.

One recurring signature mark: a **3px left-border accent stripe** in the `urgent` status color, used to flag expedited orders inline in lists (e.g. the dashboard action row) without needing a full badge.

## Components

### Buttons
- **Shape:** `radius-md` (8px), height 36px (`md` size) or 28px (`sm` size).
- **Primary:** brand-blue fill, white text, brand-hover darkens on hover.
- **Secondary:** white/panel fill, default border, primary text; hover fills to the sunken surface color rather than darkening a border.
- **Danger / Success:** solid fill using the status-family's `text` token as the background (not the family's own subtle bg), white text, hover is a flat opacity dip rather than a color shift.
- **Ghost:** transparent, hover fills to sunken. **Link:** transparent, brand-colored text, underline on hover, no padding — used inline in copy, not as a button-shaped control.

### Badges & StatusPill (signature)
- **Badge:** pill shape, bordered, one of 8 variants (`default` + the 7 status families), each a fixed bg/border/text triplet — never a bespoke color pairing.
- **StatusPill:** the app's single source of truth for order-status color. A lookup table (`ORDER_STATUS_FAMILY`) maps every order/work-order status string to one of the 7 families; an `expedited` flag unconditionally overrides the family to `urgent` regardless of the underlying status. This is the pattern every future status-like indicator should follow rather than re-deriving color logic locally.

### Cards / Containers
- **Corner style:** `radius-lg` (12px).
- **Background:** panel white, with a colored-tint variant (status-family bg) for cards that need to draw attention, e.g. an "accent" stat card.
- **Shadow strategy:** `sm` at rest, `md` on hover (see Elevation).
- **Border:** always present, `subtle` by default or a status-border color when tinted.
- **Internal padding:** `space-6` (16px).

### Inputs / Fields
- **Style:** white/panel fill, `default` border, `radius-md`, 36px height, subtle resting shadow-sm.
- **Focus:** 1px ring in brand blue (inputs/selects) or the global 2px offset focus-visible ring (buttons, links, nav) — two related but distinct focus treatments depending on control type.
- **Date inputs** auto-open the native picker on click (a small but deliberate UX default, not a browser accident).
- **Checkbox:** distinct from inputs — 16x16px, `radius-sm`, unchecked = strong border, checked = full brand-blue fill with a white check glyph. Used for lists/attestations per the project's own Checkbox-vs-Toggle convention (see `REBUILD_PLAN.md`).

### Navigation
- **Sidebar:** panel background, default-border right edge, active item = `brand-subtle` fill + brand text + semibold weight + heavier icon stroke; inactive hover = sunken fill. Optional numeric badge (pill, brand fill) for unread/queue counts, caps display at "99+".
- **Topbar:** sticky, panel background, default-border bottom edge, page title left-aligned, utility icons (theme toggle, notifications-with-dot, avatar menu) right-aligned. No shadow — separation is border-only, consistent with the flat-at-rest rule.
- **Tabs:** underline style — 2px transparent bottom border becomes brand-colored + brand text on the active tab; inactive tabs are muted text that darkens on hover. No filled/pill tab treatment anywhere.

### DataTable + ExpandableRow (signature)
- Sortable column headers render as uppercase `label`-style micro-text with a sort-direction chevron; sunken background differentiates the header row from body rows.
- Rows are click-and-keyboard expandable inline (not a modal or a navigation) — an expanded row highlights in `brand-subtle` and reveals a `canvas`-background detail panel directly beneath it, full-width. This inline-expand pattern is the project's chosen alternative to opening every row in a separate detail view; reuse it for any future dense list rather than introducing a new expand pattern.

## Do's and Don'ts

### Do:
- **Do** route every status indicator through the 7-family status vocabulary (`ORDER_STATUS_FAMILY` / the Badge/StatusPill variants) — never hardcode a one-off status color.
- **Do** keep amber exclusively for "needs attention" signals; if a new element is purely structural, use blue/grey.
- **Do** use `shadow-sm → shadow-md` as the resting → hover pattern for cards, and reserve `shadow-lg` for modal-level content only.
- **Do** use the `pill` radius only for badges, avatars, and count bubbles — buttons and inputs stay at `radius-md`.

### Don't:
- **Don't** introduce a second typeface or a decorative display font — hierarchy comes from weight/size on the one system stack.
- **Don't** treat this palette as final. It is a working placeholder chosen to unblock building the application's functional framework, and the product owner has explicitly not committed to it — expect a dedicated redesign pass before this is customer-facing polish, not just before-launch fit and finish.
- **Don't** add shadow to static, non-interactive, non-layered content — it breaks the flat-by-default read established throughout the shell.
- **Don't** reuse `danger` (red) for expedited/urgent orders, or vice versa — they are deliberately separate families (a rush order is a priority, not a problem).
