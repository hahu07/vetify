# Design Brief

## Direction

HalalVet Kashif Agent Extension — visual system for investment discovery with compatibility matching, deal reports, and side-by-side profile comparison. Extends existing Tawthiq and Mizan agents with premium analytics dashboard aesthetic for financier-side investment discovery.

## Tone

Premium, data-driven, trustworthy — investment analytics platform optimized for Islamic finance professionals making evidence-based financing decisions. Compatibility scores and deal reports frame borrower profiles as investable opportunities, not approval decisions.

## Differentiation

Compatibility scoring visualized as animated gauge indicators ranked in discovery list; side-by-side comparison view surfaces key financial differences and compliance alignments at a glance. Deal report cards generate comprehensive investment narratives from Mono bank data and Mizan underwriting results, positioned as primary input for financier decision-making.

## Color Palette Extension (Kashif)

| Token                 | OKLCH (Light)     | OKLCH (Dark)      | Role                                        |
| --------------------- | ----------------- | ----------------- | ------------------------------------------- |
| compatibility-high    | 0.55 0.18 150     | 0.65 0.2 150      | High-compatibility match, strong investment |
| compatibility-medium  | 0.7 0.15 85       | 0.75 0.15 85      | Medium compatibility, requires deeper review |
| compatibility-low     | 0.65 0.2 25       | 0.65 0.2 25       | Low compatibility, low priority ranking      |
| deal-card-bg          | 1.0 0.0 0         | 0.2 0.01 260      | Deal report card background                 |
| deal-highlight        | 0.92 0.01 260     | 0.22 0.01 260     | Deal metric highlight zone                  |
| comparison-diff       | 0.96 0.015 150    | 0.25 0.015 150    | Comparison view diff highlight              |

## Typography

- Display: Lora (serif) — deal title headers, investment narrative headers, authority in underwriting context
- Body: General Sans (sans-serif) — compatibility labels, deal summary text, financier instructions
- Mono: Geist Mono — compatibility score (0–100), financial metrics, transaction amounts
- Scale: deal header `text-lg font-semibold`, compatibility label `text-sm font-medium`, metric value `font-mono text-base`, narrative body `text-sm leading-relaxed`

## Elevation & Depth

Deal cards use elevated shadow (4px blur); on hover, shadow increases (8px); comparison view uses maximum elevation (12px). All shadows dark-mode aware. No inset shadows — deals float above content layer for prominence.

## Structural Zones (Kashif Discovery)

| Zone                 | Background       | Border             | Notes                                   |
| -------------------- | ---------------- | ------------------ | --------------------------------------- |
| Discovery List       | background       | —                  | Paginated list of ranked compatibilities |
| Compatibility Gauge  | card             | compatibility-line | 0–100 animated circular gauge per deal  |
| Matched Badge        | primary faded    | primary border     | Teal badge (right side of card)         |
| Deal Card            | deal-card-bg     | border subtle      | Investment summary snapshot             |
| Shortlist Toggle     | muted            | —                  | Star icon, activates on click            |
| Comparison Trigger   | secondary        | —                  | Button to open side-by-side view        |

## Structural Zones (Kashif Comparison)

| Zone          | Background     | Border        | Notes                                  |
| ------------- | -------------- | ------------- | -------------------------------------- |
| Profile Left  | card           | border subtle | Profile A details (business data)      |
| Profile Right | card           | border subtle | Profile B details (business data)      |
| Diff Rows     | comparison-diff| —             | Highlighted row when values diverge    |
| Metrics Bar   | card           | —             | Horizontal bar chart (income/debt)     |
| Risk/Halal    | badge zone     | colored       | Side-by-side risk and compliance badges |
| Action Zone   | secondary      | —             | Select/reject buttons below comparison |

## Spacing & Rhythm

Discovery list uses 1rem vertical spacing between cards; 1.5rem padding inside deal cards. Compatibility gauge 80px diameter, right-aligned in card header. Comparison view uses 2rem horizontal gap between profiles. Metrics bars 12px height with 1rem spacing. Consistent 2rem section breaks between discovery list and detail view.

## Component Patterns — Kashif Additions

- **Compatibility Gauge:** 80px SVG circular gauge, animated fill 0–100 on mount (compatibility-pulse infinite), color-coded: green (high), amber (medium), red (low)
- **Matched Badge:** Teal primary color, outlined style with 1px border, uppercase label + checkmark icon, floats top-right of discovery card
- **Deal Card:** Slight elevation (kashif-card shadow), 1.5rem padding, Lora serif h3 title, muted background metric rows, compact layout for scanning
- **Shortlist Star:** Toggles on click (shortlist-toggle animation), fills primary color when selected, outline style when unselected
- **Comparison View:** Two-column layout, metrics bars for income/debt/revenue side-by-side, diff rows highlight in comparison-diff background, risk/halal badges side-by-side at bottom

## Motion

- Discovery list: Cards enter with kashif-reveal (0.4s ease-out) staggered by index
- Compatibility gauge: SVG stroke animates from 0 to final % on mount (1s cubic-easing), continuous subtle pulse (compatibility-pulse 2s)
- Shortlist toggle: Momentary scale animation on click (shortlist-toggle 0.3s ease-out)
- Comparison view: Profile cards fade in (200ms), diffs highlight with smooth background color transition (300ms)
- Hover: Discovery cards lift slightly (kashif-hover shadow on hover), comparison metrics brighten on row hover (opacity shift)

## Constraints

- No gradients, no gloss effects, no decorative animations — investment analytics require visual clarity
- Compatibility gauges SVG-based for crisp rendering and precise score visualization
- All compatibility badge colors conform to WCAG AA contrast requirements
- Deal card layouts must fit 1200px viewport; mobile uses stacked single-column with full-width shortlist and comparison buttons
- Comparison view requires side-by-side layout on desktop (≥md), stacked on mobile with clear section dividers
- All tokens use OKLCH values only — no hex, rgb(), or named colors
- Discovery list pagination always visible; max 20 results per page to maintain performance
- Sidebar-first layout preserved; Kashif discovery/comparison views use full content area

## Signature Detail

Compatibility gauge animation frames deal-discovery not as binary approval but as investment opportunity ranking — the visual progression from 0 to final score creates a moment of investment assessment, positioning Kashif as the analytical lens through which financiers evaluate opportunities. Animated reveal on discovery list reinforces the sense of discovering new matching opportunities.

## Kashif Structural Zones (Financier Discovery)

| Zone                     | Content                                          | Notes                                                    |
| ------------------------ | ------------------------------------------------ | -------------------------------------------------------- |
| Discovery Ranking List   | Business cards ranked by compatibility score     | Animated reveal, highest matches first, pagination 20/page |
| Compatibility Gauge      | 0–100 circular SVG, color-coded (green/amber/red) | Right side of card header, animated fill on mount        |
| Matched Badge            | Checkmark + "Matched" label in primary color     | Top-right corner of discovery card                       |
| Deal Summary Card        | Business name, industry, risk level, compliance  | Compact snapshot, Lora header, muted metric rows         |
| Shortlist Star Toggle    | Click to add to personal shortlist                | Primary color when selected, outline when unselected     |
| Comparison Trigger       | Opens side-by-side detail view                    | Secondary button, appears below discover card            |
| Deal Report Preview      | AI-generated investment narrative                 | Truncated prose, "View Full Report" expands inline       |

## Kashif Structural Zones (Comparison View)

| Zone                 | Content                                   | Notes                                           |
| -------------------- | ----------------------------------------- | ----------------------------------------------- |
| Profile Left         | Business A full profile (name, CAC, etc.) | Card background, teal left border accent        |
| Profile Right        | Business B full profile                   | Card background, muted left border              |
| Risk Badge Pair      | Low/Medium/High risks side-by-side        | Color-coded badges, clear visual contrast       |
| Halal Compliance     | Compliance scores and flags compared      | Side-by-side check marks and warnings           |
| Financial Metrics    | Income, debt, revenue horizontal bars     | Normalized 0–100 scale for easy comparison      |
| Transaction Summary  | Top categories, frequency, patterns       | Muted background rows, mono font for values     |
| Action Buttons       | Select / Reject investment opportunity    | Bottom row, clear hierarchy (primary / secondary) |

