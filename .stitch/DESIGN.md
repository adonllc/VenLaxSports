---
name: VENLAX Sports
colors:
  surface: '#FFFFFF'
  surface-dim: '#F3F4F6'
  surface-bright: '#FFFFFF'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#F9FAFB'
  surface-container: '#F3F4F6'
  surface-container-high: '#E5E7EB'
  surface-container-highest: '#D1D5DB'
  on-surface: '#0A0A0A'
  on-surface-variant: '#6B7280'
  inverse-surface: '#030712'
  inverse-on-surface: '#F9FAFB'
  outline: '#E5E7EB'
  outline-variant: '#D1D5DB'
  surface-tint: '#10B981'
  primary: '#0A0A0A'
  on-primary: '#FFFFFF'
  primary-container: '#111827'
  on-primary-container: '#9CA3AF'
  inverse-primary: '#F9FAFB'
  secondary: '#10B981'
  on-secondary: '#FFFFFF'
  secondary-container: '#D1FAE5'
  on-secondary-container: '#065F46'
  tertiary: '#F97316'
  on-tertiary: '#FFFFFF'
  tertiary-container: '#FFEDD5'
  on-tertiary-container: '#9A3412'
  error: '#EF4444'
  on-error: '#FFFFFF'
  error-container: '#FEE2E2'
  on-error-container: '#991B1B'
  primary-fixed: '#E5E7EB'
  primary-fixed-dim: '#9CA3AF'
  on-primary-fixed: '#0A0A0A'
  on-primary-fixed-variant: '#374151'
  secondary-fixed: '#D1FAE5'
  secondary-fixed-dim: '#6EE7B7'
  on-secondary-fixed: '#022C22'
  on-secondary-fixed-variant: '#047857'
  tertiary-fixed: '#FFEDD5'
  tertiary-fixed-dim: '#FED7AA'
  on-tertiary-fixed: '#431407'
  on-tertiary-fixed-variant: '#C2410C'
  background: '#FFFFFF'
  on-background: '#0A0A0A'
  surface-variant: '#F3F4F6'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 96px
    fontWeight: '900'
    lineHeight: '0.88'
    letterSpacing: -0.02em
  display-md:
    fontFamily: Outfit
    fontSize: 64px
    fontWeight: '800'
    lineHeight: '0.9'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.12em
  stat-lg:
    fontFamily: Outfit
    fontSize: 52px
    fontWeight: '800'
    lineHeight: '1'
rounded:
  sm: 0.375rem
  DEFAULT: 0.5rem
  md: 0.5rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

# Design System: VENLAX Sports

**Project ID:** 17675673343709046597

## 1. Visual Theme & Atmosphere

VENLAX Sports is built on an editorial sports-media aesthetic — the visual DNA of a
premium sports publication crossed with a modern SaaS product. Pure white
backgrounds provide maximum contrast against obsidian-black typography, while the
3px emerald top rail on hero sections signals sport identity without shouting.
The design respects the content: big photography, bold numerals, and a restrained
use of color ensure the sport images and stats do the heavy lifting.

Whitespace is generous and intentional. Major sections breathe at 80px+ vertical
margins; content blocks are contained to `max-w-7xl` with 40px desktop gutters. The
overall density leans editorial — a hero with one massive headline, a stats band,
a how-it-works row — rather than information-dense dashboard. This is a league
platform that earns trust through clarity and restraint.

## 2. Color Palette & Roles

### Primary Foundation
- **Pure White** `#FFFFFF` — page background, card surfaces, navbar background
- **Almost White** `#F9FAFB` / `#F3F4F6` — section alternates, input backgrounds
- **Hairline Gray** `#E5E7EB` — dividers, card borders, input borders at rest
- **Mid Gray** `#D1D5DB` — decorative strokes, disabled states
- **Obsidian** `#0A0A0A` — body text, headings, primary CTA button fill
- **Charcoal 900** `#111827` — footer background, deep sections

### Accent & Interactive
- **Emerald Sport** `#10B981` — Tennis primary, stat numbers, hero sub-headline, active tab, kicker dot
- **Emerald Light** `#D1FAE5` — Tennis badge background, hover background
- **Emerald Dark** `#059669` — Tennis hover state
- **Pickleball Orange** `#F97316` — Pickleball primary accent
- **Orange Light** `#FFEDD5` — Pickleball badge background
- **Cricket Blue** `#2563EB` — Cricket primary accent
- **Blue Light** `#DBEAFE` — Cricket badge background

### Typography & Text Hierarchy
- **Primary Text** `#0A0A0A` — headings, body, high-emphasis labels
- **Secondary Text** `#6B7280` — body copy, descriptions, subtext
- **Tertiary Text** `#9CA3AF` — placeholder text, kicker labels, captions
- **Inverse Text** `#FFFFFF` — text on dark/sport-colored backgrounds
- **Accent Text** `#10B981` — hero "Earn your rank.", stat counters

### Functional States
- **Success** `#10B981` (shares Tennis emerald — intentional brand reinforcement)
- **Error** `#EF4444`
- **Warning** `#F97316` (shares Pickleball orange)
- **Info** `#2563EB` (shares Cricket blue)

## 3. Typography Rules

### Hierarchy & Weights

**Outfit** is the display and heading typeface — geometric, tightly tracked, used for
anything that needs to command attention. It projects athletic precision and modern
confidence. Always set in weights 700–900; never use it for body copy.

**DM Sans** is the workhorse — neutral, humanist, chosen for superior legibility
in UI contexts. Used for all body copy, labels, descriptions, and UI chrome. Set
at 300–600 weight range.

| Role | Size | Weight | Font | Notes |
|---|---|---|---|---|
| Hero H1 | `clamp(3.25rem, 7.5vw, 6rem)` | 900 | Outfit | leading-[0.88], tracking-tight |
| Hero Sub | `clamp(1.25rem, 3vw, 2rem)` | 600 | Outfit | emerald color |
| Body copy | `clamp(1rem, 1.5vw, 1.125rem)` | 400 | DM Sans | max-width 44ch, gray-500 |
| Stat counter | `clamp(2rem, 4.5vw, 3.25rem)` | 800 | Outfit | emerald text |
| Section heading | 36–40px | 700 | Outfit | tracking-tight |
| Card heading | 18–20px | 700 | Outfit | |
| Label / kicker | 12px | 600 | DM Sans | tracking-[0.12em], uppercase |
| Body UI text | 14–16px | 400–500 | DM Sans | |

### Spacing Principles

Letter-spacing on headings: `-0.01em` to `-0.02em` — tight, editorial, athletic.
Kicker labels (section labels above headings): `0.12em` letter-spacing, uppercase,
small size (12px) — creates editorial hierarchy without visual noise.
Line-height on massive display text: `0.88` — deliberately tight to create density
and impact on the hero.

## 4. Component Stylings

### Buttons

**Primary (CTA):** `bg-gray-900 text-white rounded-md px-8 py-4` — obsidian black
fill, `rounded-md` (0.5rem), generous padding, `hover:bg-gray-700`. No shadows.
Bold weight. `transition-colors` only (no scale or movement).

**Secondary (Ghost):** `border border-gray-200 text-gray-700 rounded-md px-8 py-4` —
hairline border, transparent background. On hover: `border-gray-900 text-gray-900`.
Matches primary dimensions for paired CTA rows.

**Sport Pills (navigation/filter):** `rounded-full border border-gray-200` with
sport-color text on hover. Small, pill-shaped (full radius), used for explore/filter
contexts. Not for primary CTAs.

**Nav CTAs:** `bg-black text-white rounded-lg px-4 py-2 text-sm` — slightly smaller
radius (`rounded-lg`) than page CTAs.

### Cards & Containers

**Flat cards:** white background, `border border-gray-200` (1px hairline), no shadow
at rest. On hover: `translate-y-1 shadow-lg` — subtle lift with shadow arrival.
`rounded-xl` on hero image cards (sporting images); `rounded-lg` on data cards.

**Sport image cards:** `rounded-2xl overflow-hidden`, photography fills the card,
`bg-gradient-to-t from-black/80 via-black/20 to-transparent` overlay, content
pinned to bottom-left. Sport icon badge in sport accent color bottom-left.

**Dropdown / modal:** `bg-white border border-gray-200 rounded-xl shadow-lg` —
elevated above page via shadow (not glassmorphism). Internal padding 8px, items use
`hover:bg-gray-50 rounded-lg`.

### Navigation

Sticky header: `sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-gray-200`
— glassmorphism treatment (white with 70% opacity + blur). Height: `h-24` (96px).

Sport pills in nav: `text-sm font-medium rounded-md` with sport-color text, hover
background in sport-light tint. Not underline-style.

Logo: left-anchored. Auth CTAs: right-anchored. Nav links: center. Gap between
links: `gap-1` (tight). Active state: `bg-gray-100 text-gray-900 font-semibold`.

Mobile: full-width drawer below header, `bg-white border-t border-gray-200`.

### Inputs & Forms

`border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900`
— hairline border at rest; obsidian border on focus. No heavy shadows. Inputs match
button radius (`rounded-lg`). Background white.

### Domain-Specific: Stats Band

Horizontal strip: `grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100`.
Each cell: large Outfit number in emerald, 12px uppercase label below. Stat numbers
use `stat-counter` class with sport-emerald color. Generous internal padding
(`px-6 lg:px-10 py-10`).

### Domain-Specific: Sport Cards (2 Sports, One Platform)

Large photography card with colored accent border at top, stat tags below image,
"Enter the League" CTA in sport color. Sport identity conveyed through color accent
and badge, not background fills.

### Domain-Specific: Footer

`bg-gray-950 text-white` — deep charcoal. Top accent: `h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent`. 4-column grid (brand, sports, platform, cities). Section labels: `font-bold uppercase tracking-widest text-gray-400`. Links: `text-gray-300` with sport-color hover.

## 5. Layout Principles

### Grid & Structure

- **Max content width:** `max-w-7xl` (1280px)
- **Page margins:** `px-4 sm:px-6 lg:px-8` (16→24→32px)
- **Hero grid:** `grid md:grid-cols-[1fr_360px] lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]` — asymmetric 2-col, text left / image stack right
- **Stats band:** 4-col with dividers
- **Sport features:** 2-col, alternating image/text side
- **Footer:** 4-col grid, 2-col mobile

### Whitespace Strategy

Base unit: 8px. Section vertical spacing: `py-20` to `py-28` (80–112px). Between
major sections: `border-b border-gray-100` acts as a visual rest. Within sections:
8px gap for tight elements, 24px for card grids, 48px for major sub-sections.

Hero text column: `py-12 sm:py-16 lg:py-28` — scales generously on desktop to give
the headline room to breathe.

### Alignment & Visual Balance

Hero: left-aligned text (no center alignment for primary content). Stats band:
center-aligned numbers. Section kickers: left-aligned uppercase labels with a
preceding emerald dot. Cities grid: left-to-right reading with equal-weight cards.

### Responsive Behavior & Touch

- Mobile-first Tailwind breakpoints (sm: 640, md: 768, lg: 1024, xl: 1280)
- Touch targets: `min-h-[44px]` on sport pills and interactive elements
- Hero becomes single-column on mobile (image stack moves below or hides)
- `object-cover` photography scales to fill without distortion
- Navigation collapses to hamburger drawer at `md:` breakpoint

## 6. Design System Notes for Stitch Generation

### Language to Use

> "Clean editorial sports platform. Pure white canvas, obsidian black headlines
> in Outfit Extra Black. One emerald accent color. Photography-forward hero with
> asymmetric text-left / image-right grid. Stats band with massive number counters.
> Minimal chrome — no gradients, no decorative elements. Cards lift slightly on hover."

### Color References

- White canvas: `#FFFFFF`
- Obsidian primary: `#0A0A0A`
- Hairline border: `#E5E7EB`
- Tennis emerald: `#10B981`
- Pickleball orange: `#F97316`
- Cricket blue: `#2563EB`
- Deep footer: `#030712`

### Component Prompts

**Hero section:**
> "Sports league hero. White background. Left column: massive black headline in heavy
> Outfit font, emerald subtitle 'Earn your rank.', two-button CTA row (black primary +
> ghost secondary), sport pill filters. Right column: stacked sport photography cards
> with gradient overlay and sport icon badges."

**Stats band:**
> "Four-column stats band. White background. Large emerald numbers (Outfit 800 weight),
> small uppercase gray labels below. Divided by hairline vertical lines."

**League card:**
> "Flat white card. 1px gray border. No shadow at rest. Sport badge (colored pill),
> league name in bold Outfit, city and format details in DM Sans, join CTA button
> in sport color. Lifts with shadow on hover."

### Incremental Iteration

- Keep backgrounds white unless explicitly building footer/dark sections
- Use Outfit for all headings; never substitute Inter for display roles
- Sport colors should be used as accents only — never as full backgrounds
- Stat counters should always use emerald (#10B981) regardless of sport context
- The emerald top rail on hero sections is a structural identity marker — keep it
- Cards: flat by default, shadow only on hover interaction
