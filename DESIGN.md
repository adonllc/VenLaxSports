# Design System — VENLAX Sports

## Product Context
- **What this is:** Ranked league platform for competitive Tennis and Pickleball players
- **Who it's for:** Serious players who want skill-matched opponents and measurable progression
- **Space/industry:** Sports leagues, competitive gaming, player ranking systems
- **Project type:** Web app + marketing landing page (hybrid)
- **Memorable thing:** "Winning & progression" — players should feel ambitious, like they're climbing toward achievement

## Aesthetic Direction
- **Direction:** Athletic Competitive
- **Mood:** Bold, confident, progress-driven. High contrast. Modern without being trendy. Serious players, serious platform.
- **Decoration level:** Intentional (subtle color accents, strategic spacing, minimal ornament)
- **Key principle:** Lead with YOUR progression, not the system. Hero = personal rating card, not generic sports hero image.

## Typography

### Font Stack
- **Display/Hero:** [Geist](https://vercel.com/font) (900 weight)
  - Modern, technical but approachable. Signals precision + confidence. Replaces overused Inter.
  - Use for: Main headline (h1), section titles (h2), CTA buttons, leaderboard ranks
  
- **Body:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (400, 500, 600 weights)
  - Friendly, highly legible on mobile. Approachable competitive vibe.
  - Use for: Paragraph text, descriptions, league card labels, navigation
  
- **Data/Tables:** [DM Sans](https://fonts.google.com/specimen/DM+Sans) (500, 700 weights) with `font-variant-numeric: tabular-nums`
  - Monospaced-feeling clarity. Tabular-nums ensure numbers align in leaderboards/rating displays.
  - Use for: Ratings (1847), ranks (#1), scores, match results, any numeric data
  
- **Code (if needed):** Fira Code or JetBrains Mono

### Loading Strategy
- **Google Fonts CDN** (production):
  ```
  https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&display=swap
  ```
- **Fallback stack:** 
  - Geist → system-ui (not fallback-friendly; always load from CDN)
  - Plus Jakarta Sans → -apple-system, BlinkMacSystemFont, "Segoe UI"
  - DM Sans → monospace

### Scale
| Level | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| 2xl | 48px | 700 (DM), 900 (Geist) | 1.2 | Rating display, hero numbers |
| xl | 32px | 700 (Geist) | 1.1 | Large CTA, section headings |
| lg | 24px | 600 (Geist), 700 (Plus Jakarta) | 1.3 | Subheadings, league names |
| md | 18px | 600 (Plus Jakarta), 500 (Geist) | 1.5 | Body text, nav labels |
| sm | 14px | 500 (Plus Jakarta) | 1.6 | Small body, form labels |
| xs | 12px | 600 (DM Sans) | 1.4 | Metadata, badges, timestamps |

## Color Palette

### Primary System
- **Primary (Victory):** `#10B981` (emerald)
  - Use for: CTA buttons, active states, leaderboard highlights, "won" badges, primary accent
  - Psychology: Confidence, victory, growth. Sports authority.
  
- **Accent (Next Action):** `#F97316` (orange)
  - Use for: Secondary CTAs, "schedule match" urgency, rating increases, pickleball indicators
  - Psychology: Action, momentum, energy. Draws attention without screaming.

### Neutral System (High Contrast)
- **Dark Text:** `#1F2937` (dark gray)
  - Use for: All body text, headlines, primary content
  
- **Light Background:** `#F9FAFB` (off-white)
  - Use for: Page backgrounds, card backgrounds
  
- **Secondary Gray (muted text):** `#4B5563` (medium gray)
  - Use for: Descriptions, secondary labels, "supporting" information
  
- **Border:** `#D1D5DB` (light gray)
  - Use for: Card borders, dividers, input borders

### Semantic Colors
- **Success (Won match):** `#10B981` (same as primary)
- **Error (Lost/Alert):** `#EF4444` (red)
- **Info (Upcoming match):** `#F97316` (same as accent orange)
- **Neutral (Pending):** `#D1D5DB` (border gray)

### Dark Mode
- Reduce saturation by 10-15% on colors
- Flip: text `#1F2937` → `#F9FAFB`, backgrounds `#F9FAFB` → `#111827`
- Secondary surface: `#1F2937`
- Maintain primary/accent as-is (high enough contrast in dark mode)

### CSS Variables (Recommended)
```css
:root {
  --primary: #10B981;
  --accent: #F97316;
  --dark: #1F2937;
  --light: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-300: #D1D5DB;
  --gray-600: #4B5563;
  --success: #10B981;
  --danger: #EF4444;
}
```

## Spacing

### Base Unit
- **Base:** 8px (8px grid throughout)
- **Rationale:** Mobile-friendly, predictable, aligns with all modern design systems

### Spacing Scale
| Name | Value | Use Case |
|------|-------|----------|
| 2xs | 2px | Micro: spacing within buttons, inner gaps |
| xs | 4px | Extra tight: icon spacing within labels |
| sm | 8px | Tight: gap between adjacent elements, padding in badges |
| md | 16px | Standard: padding in cards, gaps between card rows |
| lg | 24px | Spacious: gaps between sections, hero bottom margin |
| xl | 32px | Large: padding in modal/dialog, gap between major sections |
| 2xl | 48px | Extra large: top/bottom padding on hero, gaps between features |
| 3xl | 64px | Massive: between major layout blocks (hero to section) |

### Density Profile
- **Comfortable** (default): Card padding `md` (16px), section gaps `lg` (24px)
- **Tighter on mobile:** Reduce to `sm` (8px) / `md` (16px) on screens < 640px

## Layout

### Approach
- **Grid-disciplined** for app/sections (consistent columns, predictable alignment)
- **Creative-editorial for hero** (asymmetry, overlap, breaks grid to create visual surprise)

### Grid
- **Desktop:** 12-column grid, max-width 1200px, gutters 20px
- **Tablet:** 8-column grid
- **Mobile:** Single column, 16px side padding

### Key Sections
1. **Hero:** Centered single-column, stat card overlaps bottom (asymmetric visual surprise)
2. **League cards:** 3-column grid (desktop), 2-column (tablet), 1-column (mobile)
3. **Leaderboard:** Full-width table, horizontally scrollable on mobile
4. **CTA Section:** Centered column, text max-width 600px

### Border Radius
- **Buttons/Badges:** `8px` (minimal roundness, feels serious)
- **Cards:** `12px` (slightly warmer, but still geometric)
- **Inputs:** `8px`
- **Avatars:** `9999px` (full circle)

## Motion

### Approach
- **Minimal-functional:** Only animations that aid comprehension or guide attention
- **No playful bounces or excessive effects** (keep the serious vibe)
- **Scroll-driven reveals** for performance

### Easing & Duration
- **Micro-interactions (hover, focus):** 150-200ms, ease-in-out
- **Page entry animations (scroll reveal):** 600-800ms, ease-out
- **State transitions (open modal, toggle):** 250-350ms, ease-in-out

### Specific Animations
- **Fade-in-up on page load:** Hero content, sections as they scroll into view. Duration 600-800ms, 50-100ms stagger between elements.
- **Card hover:** Subtle translate-y(-4px) + shadow, 200ms ease-out
- **CTA button hover:** Scale 1.02, -2px translate, 150ms
- **Rating number count-up:** When a match result updates, animate number increase (e.g., 1823 → 1847) over 800ms
- **Leaderboard row highlight:** Subtle background flash when rank changes

### CSS Transitions (not CSS animations)
- Prefer `transition` over `@keyframes` for state changes (hover, active)
- Use `@keyframes` only for continuous or complex sequences

### Animation Library
- **No external library required.** Use CSS animations + framer-motion for React components (already installed).
- For vanilla HTML sections, use native CSS `@keyframes` + Intersection Observer or Scroll Behavior API.

## Components

### CTA Button
- **States:**
  - Rest: Background `--primary`, white text, rounded 8px, padding 16px 32px
  - Hover: Background darker (-10% brightness), translate-y -2px, box-shadow 0 8px 24px rgba(16,185,129,0.2)
  - Active: scale 0.95, no shadow
  - Focus: 2px outline in primary color
  
- **Secondary variant:** Use `--accent` instead of primary

### Card
- **Rest:** Background white, border 1px `--gray-300`, rounded 12px, padding 20px
- **Hover:** Translate-y -4px, box-shadow 0 12px 32px rgba(0,0,0,0.1)

### Badge
- **Size options:** xs (8px 12px), sm (8px 16px), md (12px 20px)
- **Color:** Background `--gray-100`, text `--dark`, 5px border-radius
- **Font:** DM Sans 12px, weight 600

### Input
- **Border:** 1px `--gray-300`
- **Padding:** 12px 16px
- **Border-radius:** 8px
- **Focus:** 2px outline primary, background white
- **Placeholder:** Color `--gray-600`, italic (optional)

## Design Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Lead with personal rating in hero | Category convention is to show browse/tournaments. VENLAX is player-progression-first, so hero should be YOUR rating, not "explore leagues." This creates immediate personalization. |
| 2026-06-02 | Geist for display, not Inter | Overused across AI-generated designs. Geist signals precision + modernity without the "I gave up on typography" vibe. |
| 2026-06-02 | #10B981 primary (emerald) + #F97316 accent | Already in use. Emerald = victory. Orange = next action. High contrast on light bg, maintain in dark mode. |
| 2026-06-02 | Comfortable spacing density | Not cramped (tight would lose breathing room on cards), not wasteful (loose would make pages endless). 16px padding in cards, 24px section gaps. |
| 2026-06-02 | Minimal animation approach | Motion serves comprehension (scroll reveal, state transition) not decoration. Matches the "serious competitor" vibe. |
| 2026-06-02 | Tabular-nums in leaderboards | Ensure rating numbers (1,847 vs 1,623) align vertically. Crucial for leaderboard scannability. Use DM Sans only for numeric content. |
| 2026-06-02 | Grid-break hero + disciplined sections | Hero asymmetry creates visual surprise (stat card overlaps grid). Sections snap to grid for predictability. Balances visual interest + usability. |

## Anti-patterns (DO NOT DO)

❌ Purple/violet gradients  
❌ 3-column icon grids with circles  
❌ Centered everything  
❌ Uniform bubbly border-radius on all elements  
❌ Gradient buttons  
❌ Stock photo hero images  
❌ system-ui font as primary body  
❌ Over-animating (every interaction shouldn't move)  

## Implementation Notes

### Frontend (React)
- Import fonts via Google Fonts CDN in `index.html` or `App.jsx`
- Use CSS variables in Tailwind config (or vanilla CSS)
- Use framer-motion for scroll-driven animations (already installed)
- Dark mode: toggle class `dark-mode` on `<body>`, swap CSS var values in dark-mode selector

### Tailwind Integration (if using)
```js
// tailwind.config.js
module.exports = {
  theme: {
    colors: {
      primary: '#10B981',
      accent: '#F97316',
      dark: '#1F2937',
      light: '#F9FAFB',
      gray: {
        100: '#F3F4F6',
        300: '#D1D5DB',
        600: '#4B5563',
      },
    },
    fontFamily: {
      geist: ['Geist', 'system-ui'],
      jakarta: ['Plus Jakarta Sans', 'sans-serif'],
      dm: ['DM Sans', 'monospace'],
    },
    spacing: {
      '2xs': '2px',
      'xs': '4px',
      'sm': '8px',
      'md': '16px',
      'lg': '24px',
      'xl': '32px',
      '2xl': '48px',
      '3xl': '64px',
    },
  },
};
```

### Testing the System
- View `venlax-landing-preview.html` in browser (includes dark mode toggle)
- Test on mobile (375px), tablet (768px), desktop (1440px) viewports
- Verify leaderboard numbers align (tabular-nums)
- Check contrast ratios (WCAG AA minimum 4.5:1 for text)

---

**Created:** 2026-06-02  
**By:** /design-consultation skill  
**Status:** Approved, ready for implementation  
