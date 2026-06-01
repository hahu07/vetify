# Design Brief

## Direction

Vetify 2.0 — extended with deal pipeline Kanban board, profile photo uploads, cycle balance monitoring, and admin compliance dashboard. Maintains existing dark/light card-based aesthetic while introducing workflow and operational visibility features.

## Tone

Professional, data-driven, operationally transparent — extending the existing Kashif investment discovery interface with deal pipeline management, personal identity management, and infrastructure health monitoring for admin oversight.

## Differentiation

Kanban board visualizes deal progression stages (Reviewing → Due Diligence → Offer Sent → Closed) with drag-and-drop affordance and real-time status badges. Cycle balance card surfaces ICP infrastructure health at a glance. Profile photo uploads introduce personal identity into the fintech workflow. Admin compliance view maintains regulatory audit trail through message thread monitoring.

## Color Palette Extension

| Token | OKLCH (Light) | OKLCH (Dark) | Role |
| --- | --- | --- | --- |
| cycle-healthy | 0.65 0.2 150 | 0.65 0.2 150 | Cycles available, platform operational |
| cycle-low | 0.75 0.15 85 | 0.75 0.15 85 | Cycles below threshold, top-up recommended |
| cycle-critical | 0.65 0.2 25 | 0.65 0.2 25 | Cycles insufficient, feature blocked |
| kanban-column-bg | 1.0 0.0 0 | 0.2 0.01 260 | Kanban column background (draggable zone) |
| compliance-unread | 0.65 0.2 25 | 0.65 0.2 25 | Unread compliance message thread |

## Typography

- Display: Lora (serif) — deal card headers, investment profiles, authority in underwriting
- Body: General Sans (sans-serif) — Kanban column labels, cycle status text, compliance thread metadata
- Mono: Geist Mono — cycle balance numbers, currency inputs (NGN), financial metrics
- Scale: Kanban card `text-sm font-medium`, column header `text-xs font-semibold uppercase`, cycle status `font-mono text-base`, compliance thread `text-xs`

## Elevation & Depth

Kanban cards use base shadow (2px blur); on drag, shadow elevates to 12px for visual feedback. Cycle balance card matches analytics card treatment (3px left accent bar, hover lift). Profile avatar circular zone with overlay opacity shift on hover. Compliance thread list uses minimal elevation — focus on read state indicator (left border) rather than shadow.

## Structural Zones

| Zone | Background | Border | Notes |
| --- | --- | --- | --- |
| Kanban Column | kanban-column-bg | subtle | Four draggable columns, min-height 400px, gap 1rem |
| Kanban Card | card | border | Business profile inside column, hover lift on drag |
| Cycle Balance Card | analytics-kpi-bg | border | 3px left accent bar (color-coded: green/amber/red), horizontal progress bar |
| Profile Avatar | card | border | Circular 120x120px zone, camera icon overlay, uploading state spinner |
| Compliance Thread | card | left-accent | Unread state: 3px left border in compliance-unread color |
| Compliance Avatar | muted | — | 24px circular avatars of thread participants |

## Spacing & Rhythm

Kanban columns use 1rem gap between cards, 1rem padding inside column. Kanban card padding 1rem. Cycle balance card 1.5rem horizontal padding, 1rem vertical. Profile avatar 120px diameter, 2rem spacing from adjacent content. Compliance thread list max-height 400px with scroll, 0.75rem gap between threads, 1rem padding inside thread item.

## Component Patterns

- **Kanban Column**: Off-white (light) or slate (dark) background, subtle rounded corners (6px), min-height 400px, draggable zone with visual feedback on drag-over
- **Kanban Card**: Card background, 1px border, Lora header, muted metrics rows, status badge (compatibility gauge or deal status), grab cursor, hover lift (6px blur shadow, -2px translateY)
- **Cycle Balance Card**: Horizontal layout — status badge (colored circle) + text label (healthy/low/critical) + progress bar + numeric display. Bar height 8px, border-radius 4px, color-coded fill
- **Profile Avatar**: Circular zone, border-radius 50%, camera icon overlay on hover, uploading state shows spinner or image skeleton, click to trigger file input
- **Compliance Thread Item**: Card background, unread state shows 3px left border accent, hover background shift to muted/0.5, compact layout with participant avatars (24px circular) + timestamp + message preview (truncated)

## Motion

- Kanban enter: Cards animate in 0.3s ease-out (opacity 0→1, translateY 8px→0)
- Kanban drag: On active drag, card shadow elevates to 12px, opacity 0.9 for visual feedback
- Kanban drop: Smooth drop-to-position animation (200ms ease-out)
- Cycle pulse: Continuous subtle pulse on healthy status (cycle-pulse 2s ease-in-out infinite)
- Avatar upload: Spinner during upload, fade-in on image load
- Compliance thread: Thread item fades in on mount (200ms ease-out)

## Constraints

- Kanban board designed for 1200px+ viewport; mobile uses single-column with horizontal scroll for columns
- Cycle balance card always visible in dashboard header or sticky panel
- Profile avatar upload zone max-size 120x120px; squared proportions enforced (circular crop)
- Compliance thread list max-height 400px with scroll; unread count badge separate from thread list
- All cycle status colors conform to WCAG AA contrast on both light and dark backgrounds
- No new fonts — extend existing Lora/General Sans/Geist Mono palette
- NGN currency inputs use mono font for alignment and clarity; leading zero suppression in display
- Kanban cards remain draggable on touch devices; touch feedback via scale() instead of transform (performance)

## Signature Detail

Kanban card drag-and-drop interaction creates a tangible sense of deal progression — financiers physically move opportunities through stages, reinforcing active deal management. Cycle balance indicator surfaces infrastructure health without requiring admin clicks, inverting the usual pattern where operational status is hidden behind a settings page. Profile avatar as circular zone with overlay affordance creates a persistent identity anchor across the platform, grounding abstract financing instruments in real business/person relationships.

## Kanban Board (Deal Pipeline)

| Zone | Content | Notes |
| --- | --- | --- |
| Column Header | Stage label (Reviewing, Due Diligence, Offer Sent, Closed) | Uppercase, 1px bottom border, slight text-transform shadow |
| Column Body | Draggable business cards, ranked by compatibility score | Min 400px height, cards enter with animation, drag-over state shows insert line |
| Business Card | Business name, risk level, compatibility gauge, shortlist star, comparison button | Lora header, muted metric rows, drag affordance cursor |
| Status Badge | Compatibility gauge 0-100 circular SVG | Right side of card, color-coded (green/amber/red) |

## Cycle Balance Card (Infrastructure Health)

| Zone | Content | Notes |
| --- | --- | --- |
| Status Icon | Colored circle (green/amber/red) | Matches cycle-healthy / cycle-low / cycle-critical token |
| Status Label | "Healthy" / "Low" / "Critical" | Text color matches status icon |
| Progress Bar | Horizontal bar chart (current cycles / max cycles) | Height 8px, background muted, fill color-coded |
| Numeric Display | "Current: 500K / Max: 1M cycles" | Mono font, smaller text |
| Action Link | "Top Up" button (if low/critical) | Links to admin settings or cycles wallet page |

## Admin Compliance Message View

| Zone | Content | Notes |
| --- | --- | --- |
| Thread Header | Participant avatars + names + timestamp | 24px avatars, left-align |
| Unread Badge | Red dot or number badge | Compliance-unread color, right side |
| Message Preview | First 80 characters of latest message | Muted text, ellipsis if truncated |
| Read State | Left border accent (3px) for unread | Visual affordance without text label |
| Hover State | Background shift to muted/0.5 | Indicates interactivity |

## Form Input Improvements

| Input Type | Pattern | Notes |
| --- | --- | --- |
| NGN Currency | "₦ 500,000" with number formatting | Mono font, group separators (1000s), no decimals |
| Monthly Income | "₦ 250,000 / month" with label | Mono font, clear unit label |
| Helper Text | "e.g. ₦ 1,000,000 for loan amount" | Muted foreground, 0.75rem spacing below input |
| Validation | Red border + error message on blur if invalid | Message: "Enter a valid amount (numbers only)" |
| Placeholder | "e.g. 500000" | Muted color, no Tawthiq/agent placeholder text bleeding in |

## Light Mode Adjustments

Light mode uses inverse token values: kanban-column-bg white (1.0 0.0 0), cycle status colors remain consistent, compliance thread borders use same accent colors. Avatar overlay semi-transparent black (0.0 0.0 0 / 0.4). All shadows remain subtle — no sharp elevation differences between light and dark.

## Dark Mode Adjustments

Dark mode kanban-column-bg slate (0.2 0.01 260), card background remains dark-slate (0.2 0.01 260), cycle status colors vibrant (higher chroma). Avatar overlay pure black. Shadows slightly stronger for depth on dark canvas (0 12px 24px / 0.25 opacity vs light 0.15).
