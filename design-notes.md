# Apartment Finder: Design Specification

A personal apartment-search tool for one renter (a woman of about 70) looking in the Washington DC and Maryland suburbs. Her son set it up and helps maintain the data, but she uses it, almost always on an iPhone 17 in portrait. Static site: HTML, CSS, vanilla JS modules, no framework, no build step, deployed on GitHub Pages.

This spec is decisive. It describes one design, not a set of options. Build it as written.

## 1. Design principles

Calm, reassuring, uncrowded. The renter should be able to open the page, read the top building, and understand it without scrolling sideways, pinching, or hunting. Results come first. Filtering is a deliberate side trip she chooses to take, never a wall she has to pass through.

Every interactive thing is large. Tap targets are at least 48px tall, body text never drops below 18px, and the screen is never busier than one building's worth of information at a time as she scrolls.

She is the only user, so there is no login, no onboarding, no settings she has to discover. The first paint is the answer.

## 2. Overall mobile layout and navigation

### Screen inventory

The app is a single page with two overlay surfaces. There is no router and no separate pages.

1. **Results screen (home).** The default and almost only view. A vertical scroll of building cards, ranked best fit first. This is where she lives.
2. **Refine sheet (overlay).** A full-screen panel that slides up over the results when she taps Refine. It holds the must-haves and the weighted preferences. Closing it returns her to the results, re-ranked.
3. **Building detail (expanded card, in place).** Tapping a building card expands it in the flow of the list rather than opening a new page. The map, full distance card, and the list of available units appear inside the expanded card. Tapping the header again collapses it. Only one card is expanded at a time; expanding a second collapses the first.

There is no separate "unit detail" screen. Units live inside their building's expanded card.

### The home screen, top to bottom

```
[ safe-area top inset, clears Dynamic Island ]
  Title bar (Fraunces): "Apartments"            <- small, calm
  One line of context: "8 buildings match"      <- the result count, live
  ------------------------------------------------
  Building card (rank 1)   <- best fit, partially the fold
  Building card (rank 2)
  ...
[ sticky bottom action bar: WALK/DRIVE toggle | Refine (count) ]
[ safe-area bottom inset ]
```

**Above the fold** (iPhone 17 portrait, roughly 880px of usable height after insets): the title bar, the match-count line, and the entire first building card down through its badges and distance card. The first card's photo, name, rent range, best-fit score, must-have confirmation, and distances are all visible without scrolling. The second card peeks in at the bottom to signal that the list continues.

### The sticky bottom action bar

A single fixed bar pinned to the bottom of the viewport, sitting above the home-indicator safe area. It holds exactly two controls:

- **Left: the global WALK / DRIVE segmented toggle.** Flips every distance in the app between walking minutes and driving minutes. It lives here, not per-card, because it is one global state.
- **Right: the Refine button.** Shows the live remaining count as a pill, for example "Refine (8)". Tapping opens the Refine sheet.

The bar is 64px tall plus the bottom safe-area inset. It uses a solid off-white background with a hairline top border and a soft upward shadow so it reads as floating above the list. Cards get 80px of bottom scroll padding so the last card is never trapped under the bar.

There is no top navigation bar beyond the title. No hamburger, no tabs, no breadcrumb. The two surfaces (Refine, expanded card) are the only navigation.

## 3. The building card

### States

Each card has two states: **collapsed** (default, in the ranked list) and **expanded** (after tap). The collapsed card is a tappable summary. The expanded card adds the map and the units.

### Collapsed card anatomy, top to bottom

```
+------------------------------------------+
|  [ photo, 4:3, rounded top corners ]     |
|                              [ ❷ dots ]  |  <- carousel dots if >1 photo
+------------------------------------------+
|  ⓵ BEST FIT            score 92          |  <- rank ribbon, top card only
|  Building Name (Fraunces, large)         |
|  $2,400 to $3,100 / month                |  <- rent range across units
|                                          |
|  ✓ 2BR+  ✓ 24h concierge                 |  <- must-haves, confirmed row
|  ✓ Balcony  ✓ In-unit laundry            |
|                                          |
|  +----- distance card -----------------+ |
|  | Kemp Mill Synagogue     12 min walk | |
|  | Berman Academy           9 min walk | |
|  | Closest Metro           15 min walk | |
|  +-------------------------------------+ |
|                                          |
|  3 units available           [ View ▾ ] |  <- tap zone to expand
+------------------------------------------+
```

### Photo treatment

- **Aspect ratio:** 4:3, set with `aspect-ratio: 4 / 3` so the card height is stable before the image loads (no layout shift). Rounded top corners (16px) matching the card radius; the photo bleeds to the card's left and right edges.
- **One vs. many:** If a building has one photo, show it static. If it has more than one, make it a horizontal swipe carousel using CSS scroll-snap (`scroll-snap-type: x mandatory`), one photo per snap point, with small dot indicators bottom-right. No JS carousel library; native scroll-snap handles it. No autoplay.
- **Fallback when no photo yet:** A solid panel in the sage tint (`--c-surface-sunk`) at the same 4:3 ratio, centered with a simple building glyph (inline SVG, 48px, in `--c-ink-soft`) and the building name below it in Fraunces. It must look intentional and calm, not broken. Never show a stretched placeholder or a broken-image icon.

### Information hierarchy

The reading order is: see the building, know it qualifies, know what it costs, know how far things are, then decide to open it.

1. **Photo** establishes the place.
2. **Rank ribbon and score** (top of the text block). Only the number-one card carries a filled "BEST FIT" ribbon in accent teal. Every card shows its numeric score (0 to 100) right-aligned on the same line, quietly, in `--c-ink-soft`. The score is the weighted ranking result. Cards below the first show their rank as a small numeral in a circle at the top-left of the photo ("2", "3").
4. **Building name** in Fraunces, the largest text on the card (1.5rem).
5. **Rent range** in IBM Plex Sans, 1.25rem, the range across that building's currently available units ("$2,400 to $3,100 / month"). If one unit, show the single figure.
6. **Must-have confirmation row.** Because the four hard requirements are non-negotiable and every shown building passes them, present them as a calm reassurance grid of four checked items, not as filters. Green check glyph plus short label: "2BR+", "24h concierge", "Balcony", "In-unit laundry". This tells her every building she sees already clears her floor.
7. **Distance card** (see below).
8. **Units summary line** with the expand affordance.

### The distance card

A bordered inset block listing the three fixed destinations in fixed order:

1. Kemp Mill Synagogue
2. Berman Academy
3. Closest Metro

Each row: destination name left, time and mode right ("12 min walk" / "8 min drive"). The mode word reflects the global WALK/DRIVE toggle and all three rows flip together. Use the label "Closest Metro" exactly; the underlying station name may appear as a smaller second line under it if useful, but the primary label stays "Closest Metro". No personal names anywhere.

When DRIVE is active, rows read "min drive". When a distance is missing in the data, show a dash placeholder and a muted "not yet measured", never a guess.

### Map placement

The small map appears only in the **expanded** card, not the collapsed one. The collapsed card uses the distance card as its spatial summary; the map would crowd the list and cost tiles on every card. In the expanded card the map sits directly below the distance card, full card width, 220px tall, rounded 12px corners. See section 5.

### How units nest inside

When expanded, below the map, the card shows a **units list**, one row per available unit:

```
+------------------------------------------+
|  Unit 0712          $2,750 / month        |
|  2 BR · 1,050 sq ft                        |
|  [Balcony] [In-unit laundry] [Verified]   |  <- badges
+------------------------------------------+
|  Unit 1104          $3,100 / month         |
|  1 BR + den · 1,180 sq ft                  |
|  [Balcony] [In-unit laundry] [Confirm]     |
+------------------------------------------+
   View live availability  →                 <- link to leasing page
```

Each unit row shows: unit label, monthly rent (bold), beds or "1 BR + den", square footage, and small badges. Badges: **Balcony**, **In-unit laundry**, and a verification badge that is either **Verified** (teal, filled) or **Needs confirmation** (amber outline). The "View live availability" link sits once at the bottom of the units list and opens the building's leasing page in a new tab (`target="_blank" rel="noopener"`), styled as a clear text link with a trailing arrow, not a button competing with the card.

## 4. The Refine experience

Refine is a **full-screen sheet** that slides up from the bottom over the results. Full-screen (not a half-height bottom sheet) because the renter benefits from one calm thing at a time and from large controls that do not fight a peeking results list behind them.

### Structure, top to bottom

```
+------------------------------------------+
|  ✕                                  Done |  <- close left, Done right
|  Refine (Fraunces)                        |
|  8 buildings match                        |  <- live count, updates as she edits
|  ----------------------------------------|
|  MUST HAVES                               |  <- section label
|  These can't be turned off.               |  <- one-line explanation
|                                           |
|   ✓ At least 2 bedrooms (or 1BR + den)    |  <- locked, checked, dimmed
|   ✓ 24-hour concierge                     |
|   ✓ Private balcony                        |
|   ✓ In-unit laundry                        |
|  ----------------------------------------|
|  WHAT MATTERS TO YOU                       |
|  Turn on what you care about. Slide to     |
|  say how much.                             |
|                                            |
|   [ on ] Lower monthly cost                 |
|         [o==========]  72                  |  slider appears when on
|   [ off] Short walk to Metro                |  off: no slider shown
|   [ on ] Quiet, away from train noise       |
|         [====o======]  45                  |
|   ...                                       |
+------------------------------------------+
|  [        Show 8 buildings        ]        |  <- sticky primary button
+------------------------------------------+
```

### Must-haves: simple on/off, visually locked

The four hard requirements render as a list of pre-checked rows with the check filled in accent teal and the row text in full-strength ink, but the control is **not editable**. A small lock glyph and the line "These can't be turned off" make clear they are fixed. They are shown so she trusts what the ranking already guarantees, not so she can toggle them. (If the son ever needs to relax one, he edits the config file, not the UI.)

Visually distinct from preferences: must-haves have no slider, no number, and a faint lock; preferences have a toggle and, when on, a slider with a number.

### Weighted preferences: check, then set weight

Each preference is one row with a large toggle switch on the left and the preference name. The full list, in this order:

Lower monthly cost, Short walk to Metro, Quiet (away from train noise), Elevator, Pet-friendly (small dog occasionally), Close to Kemp Mill Synagogue, Close to Berman Academy, More square footage, Pool, Nearby playground.

**The check-then-set-weight interaction:**

- When a preference is **off**, the row shows only the toggle and the name, and no slider. The row is compact (56px).
- When she turns it **on**, the row expands smoothly (respecting reduced-motion) to reveal a slider beneath the name with a numeric weight (0 to 100) shown as a large value at the slider's right end. New preferences default to a weight of 50.
- The slider is full row width, with a 28px thumb and a 12px track, easy to drag with a thumb. The numeric weight updates live as she drags and is also announced to VoiceOver.
- Turning the preference off again collapses the slider but remembers its last weight, so toggling back on restores it.

This makes the two-step nature obvious: the toggle decides whether it counts, the slider decides how much.

### Showing how many results remain

The remaining count appears in three places, all driven by the same value:

1. Under the Refine sheet title ("8 buildings match"), updating live as she toggles must... (preferences do not change the count, only the ordering; toggling a preference re-ranks but does not exclude). To be precise: because must-haves are locked and preferences only re-rank, the count is stable while she is in the sheet, but the number is still shown so she always knows how many buildings she is choosing among.
2. On the sticky primary button at the bottom of the sheet: "Show 8 buildings".
3. On the Refine button in the home action bar: "Refine (8)".

If a future state lets the son relax a must-have, the live count is already wired to drop or rise as that changes.

### Closing

Both "Done" (top right) and "Show N buildings" (bottom) close the sheet and apply the ranking. There is no separate Apply versus Cancel; edits apply live and the sheet just closes. A tap on the dimmed area is disabled in full-screen mode (there is no exposed backdrop), so she cannot lose her place by mis-tapping.

## 5. The map

### Recommendation: Leaflet plus OpenStreetMap tiles

Use **Leaflet** (about 42KB gzipped, no API key, no account) with the standard **OpenStreetMap raster tile** layer. This is the right call for a one-user static GitHub Pages site: no key to leak in a public repo, no billing, no sign-up. Vector-tile alternatives (MapLibre) need a tile provider that almost always wants a key, which defeats the purpose. Leaflet plus OSM is the default and it is the recommendation; do not add a keyed provider.

Pin Leaflet to a fixed version from a CDN (jsDelivr or unpkg) with subresource integrity, and lazy-load the Leaflet JS and CSS only when the first building card is expanded, so the home screen does not pay for the map library on load.

Respect OSM tile usage policy: this is a single private user with light traffic, which is within the acceptable-use norms. Set a clear `attribution` on the tile layer (OpenStreetMap contributors) as required.

### Markers

- **Building marker:** a filled teardrop pin in accent teal (`--c-accent`) with a white building glyph, slightly larger (40px) so it reads as the subject of the map.
- **Three fixed landmarks:** smaller circular markers (28px), each a distinct calm color with a one-letter or small glyph, consistent app-wide:
  - Kemp Mill Synagogue: warm gold circle.
  - Berman Academy: muted plum circle.
  - Closest Metro: slate-blue circle with an "M".
- Markers use `L.divIcon` with inline SVG so there are no external image requests and colors come from the token palette. Each marker has an accessible `title`/`alt` with its destination name.

### Default view

Center the map on the building marker. Default zoom **14** (neighborhood scale showing the building and typically all three landmarks). Fit the bounds to include the building plus the three landmarks when they all fit at zoom 13 to 15; otherwise center on the building at zoom 14 and let her pan. Disable scroll-wheel zoom (irrelevant on touch) and keep pinch-zoom on. Map height 220px, rounded corners, inside the expanded card.

### Static fallback

If Leaflet fails to load (offline, CDN blocked, tile error), show a static fallback in the same 220px box: the sage surface tint, a centered map-pin glyph, and the line "Map unavailable. Distances are listed above." The distance card already carries the essential spatial information, so the fallback loses nothing critical. Detect failure with a load timeout on the Leaflet script and a tile `tileerror` handler.

## 6. Photos sourcing and handling

Photos come from each building's own website (the `og:image` or a gallery image), downloaded by the son and committed into the repo under `/photos/<building-id>/`. They are not hotlinked.

### Sizes and format

- Commit a **single web-optimized JPEG** per photo at **1080px wide** (4:3, so 1080x810). One iPhone-17-appropriate size is enough for one user; no `srcset` matrix needed. If a source image is smaller, do not upscale; let `object-fit: cover` handle it.
- Target file size under about 200KB per image; re-encode at quality 78 to 82.
- Optionally also commit a WebP twin and serve it via `<picture>`, with the JPEG as the fallback `<img>`. This is a nicety, not a requirement.

### Loading and layout

- `loading="lazy"` and `decoding="async"` on every card image except the first card's first image, which should be eager so the top of the page paints immediately.
- Set `width` and `height` attributes (or rely on the CSS `aspect-ratio: 4 / 3` on the wrapper) so there is **zero layout shift** as images arrive.
- `object-fit: cover; object-position: center` so off-ratio source images crop gracefully.

### Graceful fallback styling

When a building has no committed photo, render the fallback panel described in section 3: a calm sage-tint 4:3 block with a centered building glyph and the building name. Drive this from the data: if the building's `photos` array is empty, render the fallback component instead of `<img>`. The fallback must never look like an error.

Carousel: when more than one photo exists, the swipe carousel uses the same lazy-loading rules; only the first photo in each carousel is given priority, the rest stay lazy.

## 7. Type scale and spacing for an older reader

Tuned up from typical mobile defaults because the reader is about 70 and the son prefers larger type generally. Base is 18px, not 16px.

### Type scale (IBM Plex Sans body, Fraunces headings)

| Token | rem | px (at 18px root) | Use |
| --- | --- | --- | --- |
| `--fs-root` | base | 18px | `html` font-size, sets rem |
| `--fs-xs` | 0.875rem | 15.75px | badges, captions, attribution (floor for incidental text) |
| `--fs-sm` | 1rem | 18px | secondary lines, distance rows, unit details |
| `--fs-base` | 1.125rem | 20.25px | body, slider values, toggle labels |
| `--fs-lg` | 1.25rem | 22.5px | rent figures, preference names |
| `--fs-xl` | 1.5rem | 27px | building name (Fraunces) |
| `--fs-2xl` | 1.875rem | 33.75px | sheet title, page title (Fraunces) |

Set `html { font-size: 18px; }`. Never render meaningful text below 15.75px. Line-height 1.5 for body, 1.2 for the Fraunces headings. Numerals in rent and distances use `font-variant-numeric: tabular-nums` so columns align.

### Spacing scale (8px base)

| Token | px | Use |
| --- | --- | --- |
| `--sp-1` | 4px | hairline gaps |
| `--sp-2` | 8px | tight internal padding |
| `--sp-3` | 12px | between stacked lines |
| `--sp-4` | 16px | card inner padding (sides) |
| `--sp-5` | 24px | between sections inside a card |
| `--sp-6` | 32px | between cards |
| `--sp-7` | 48px | major section breaks in Refine |

Card inner padding is 16px horizontal, 16px to 20px vertical. Gap between cards is 24px to 32px (generous; the list should breathe). Refine rows have 16px vertical padding.

### Tap targets

- **Minimum 48px by 48px** for every interactive element. Toggles, the Refine button, the WALK/DRIVE segments, unit links, carousel dots (give dots a 48px invisible hit area even though the dot is small).
- Slider thumb 28px visible, 48px touch height via padding on the track wrapper.
- The whole collapsed card header is one large tap target to expand.
- Minimum 8px between adjacent tap targets so she does not hit the wrong one.

### Contrast

All body text on the off-white background meets WCAG AA at minimum; primary text targets AAA (see tokens). The accent teal is dark enough for white text on it at AA for large text and is used for buttons and the building name accent.

## 8. Accessibility

### Contrast targets

- Body text (`--c-ink` on `--c-bg`): at least 7:1 (AAA).
- Secondary text (`--c-ink-soft` on `--c-bg`): at least 4.5:1 (AA).
- White text on accent teal (`--c-accent`): at least 4.5:1; verify and darken the teal if needed (the chosen `#1a5462` clears 4.5:1 against white).
- Badge text on tinted badge fills: at least 4.5:1.
- Never use color alone to carry meaning. The verification state pairs color with the words "Verified" / "Needs confirmation". Must-haves pair the teal check with a lock glyph and text.

### Focus states

Every interactive element shows a visible focus ring: a 3px solid `--c-focus` (a high-contrast teal-blue) outline with a 2px offset, using `:focus-visible` so it appears for keyboard and switch-control users without cluttering touch use. Never remove outlines without replacing them.

### Reduced motion

Honor `@media (prefers-reduced-motion: reduce)`: the Refine sheet appears without the slide animation (instant or a 1-opacity fade only), the card expand reveals without height animation, the slider-reveal is instant, and the carousel keeps scroll-snap but loses any smooth-scroll easing. No motion is essential to meaning.

### VoiceOver labeling

- **Preference toggle:** a real `<input type="checkbox" role="switch">` (or `<button role="switch" aria-checked>`), labeled with the preference name plus state, for example "Lower monthly cost, on". When on, its associated slider is announced as a separate control.
- **Weight slider:** `<input type="range">` with `aria-label="Importance of lower monthly cost"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuenow` kept in sync; also set `aria-valuetext` to spoken form, for example "72 out of 100". The visible number is `aria-hidden` to avoid double reading.
- **WALK/DRIVE toggle:** a labeled segmented control, `role="radiogroup"` with `aria-label="Show distances by"`, two radios "Walking" and "Driving"; the current mode is announced. When toggled, an `aria-live="polite"` region announces "Distances now showing driving minutes".
- **Distance rows:** each row reads as one phrase, for example "Kemp Mill Synagogue, 12 minutes walking". Mark the destination and value so they read together, not as two stray fragments.
- **Must-haves:** announced as checked and disabled, with the explanation "Always on" so a screen-reader user understands they cannot be changed.
- **Cards:** the collapsed card header is a real `<button>` with `aria-expanded` reflecting its state and a label like "Building Name, best fit, score 92, show details".
- **Result count:** wrap the "N buildings match" text in `aria-live="polite"` so re-ranking and any count change is announced.
- Images: each photo has descriptive `alt` ("Front exterior of Building Name"). The fallback panel has `alt="No photo available for Building Name"`.

### Other

- `lang="en"` on the document. `meta name="viewport"` includes `viewport-fit=cover` so safe-area insets work around the Dynamic Island; use `env(safe-area-inset-*)` for top title padding and bottom bar padding.
- All controls reachable and operable with VoiceOver and Switch Control. No drag-only interaction without a discrete alternative: the weight slider also responds to a tap on the track and to increment via the platform rotor.

## 9. Color and type tokens

Paste into `:root`. Palette refined from the existing teal/sage toward warmer, higher-contrast values while keeping the calm character.

```css
:root {
  /* ---------- Color ---------- */
  --c-bg:            #f4f6f3; /* off-white app background */
  --c-surface:       #ffffff; /* card surface */
  --c-surface-sunk:  #e7ece6; /* sage tint: photo fallback, map fallback, insets */
  --c-border:        #d3dbd2; /* hairline borders */

  --c-ink:           #1c2522; /* primary text, ~13:1 on --c-bg (AAA) */
  --c-ink-soft:      #4a5650; /* secondary text, ~7:1 on --c-bg (AAA small) */
  --c-ink-faint:     #6b756f; /* tertiary, meets AA on --c-bg */

  --c-accent:        #1a5462; /* teal: buttons, building name accent, building pin */
  --c-accent-press:  #123f49; /* pressed/active accent */
  --c-on-accent:     #ffffff; /* text on accent, >4.5:1 */

  --c-good:          #2f6b3f; /* confirmed/verified green (check, Verified badge) */
  --c-good-bg:       #e3efe5; /* verified badge fill */
  --c-warn:          #8a5a12; /* needs-confirmation amber text */
  --c-warn-bg:       #f6ecd6; /* needs-confirmation badge fill */

  --c-focus:         #0b6e8c; /* focus ring, high contrast */

  /* landmark marker colors */
  --c-mark-syn:      #b8860b; /* warm gold: Kemp Mill Synagogue */
  --c-mark-school:   #7a4b6b; /* muted plum: Berman Academy */
  --c-mark-metro:    #3d5a80; /* slate blue: Closest Metro */

  /* ---------- Type ---------- */
  --font-head: "Fraunces", Georgia, serif;
  --font-body: "IBM Plex Sans", system-ui, -apple-system, sans-serif;

  --fs-xs:   0.875rem; /* 15.75px */
  --fs-sm:   1rem;     /* 18px    */
  --fs-base: 1.125rem; /* 20.25px */
  --fs-lg:   1.25rem;  /* 22.5px  */
  --fs-xl:   1.5rem;   /* 27px    */
  --fs-2xl:  1.875rem; /* 33.75px */

  --lh-body: 1.5;
  --lh-head: 1.2;

  /* ---------- Spacing ---------- */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px;

  /* ---------- Radius & shadow ---------- */
  --radius-card: 16px;
  --radius-inner: 12px;
  --radius-pill: 999px;
  --shadow-card: 0 1px 3px rgba(28, 37, 34, 0.08),
                 0 4px 12px rgba(28, 37, 34, 0.06);
  --shadow-bar:  0 -2px 12px rgba(28, 37, 34, 0.10);

  /* ---------- Controls ---------- */
  --tap-min: 48px;
  --slider-track: 12px;
  --slider-thumb: 28px;
}

html { font-size: 18px; }
body {
  background: var(--c-bg);
  color: var(--c-ink);
  font-family: var(--font-body);
  font-size: var(--fs-base);
  line-height: var(--lh-body);
}
h1, h2, .building-name { font-family: var(--font-head); line-height: var(--lh-head); }
```

## 10. Wireframes (portrait iPhone)

### A. Results / building-list screen

```
┌──────────────────────────────┐
│   ░░ Dynamic Island ░░        │
│                               │
│  Apartments                   │  Fraunces 33px
│  8 buildings match            │  ink-soft, aria-live
│                               │
│ ┌───────────────────────────┐ │
│ │                           │ │
│ │   [ building photo 4:3 ]  │ │
│ │                       • • │ │  carousel dots
│ ├───────────────────────────┤ │
│ │ ◆ BEST FIT        score 92│ │  teal ribbon
│ │ The Carlisle              │ │  Fraunces 27px
│ │ $2,400 to $3,100 / month  │ │  22px bold
│ │                           │ │
│ │ ✓ 2BR+      ✓ 24h concierge│ │  must-have grid
│ │ ✓ Balcony   ✓ In-unit laun.│ │
│ │ ┌───────────────────────┐ │ │
│ │ │ Kemp Mill Syn. 12m walk│ │ │
│ │ │ Berman Academy  9m walk│ │ │
│ │ │ Closest Metro  15m walk│ │ │
│ │ └───────────────────────┘ │ │
│ │ 3 units available  View ▾ │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ ②  [ photo ]              │ │  next card peeks
│ │     The Aldridge          │ │
├──────────────────────────────┤
│  [ Walk | Drive ]   Refine(8) │  sticky bar, 64px
│   ▔▔▔▔ home indicator ▔▔▔▔    │
└──────────────────────────────┘
```

### B. Expanded building card

```
┌──────────────────────────────┐
│ ┌───────────────────────────┐ │
│ │   [ building photo 4:3 ]  │ │
│ ├───────────────────────────┤ │
│ │ ◆ BEST FIT        score 92│ │
│ │ The Carlisle              │ │
│ │ $2,400 to $3,100 / month  │ │
│ │ ✓ 2BR+   ✓ 24h concierge   │ │
│ │ ✓ Balcony ✓ In-unit laundry│ │
│ │ ┌ distance card ─────────┐ │ │
│ │ │ Kemp Mill Syn. 12m walk │ │ │
│ │ │ Berman Academy  9m walk │ │ │
│ │ │ Closest Metro  15m walk │ │ │
│ │ └────────────────────────┘ │ │
│ │ ┌ map 220px ─────────────┐ │ │
│ │ │      ◉ building          │ │ │
│ │ │   ●gold  ●plum  ●M       │ │ │
│ │ │   © OpenStreetMap        │ │ │
│ │ └────────────────────────┘ │ │
│ │ Available units            │ │
│ │ ┌────────────────────────┐ │ │
│ │ │ Unit 0712   $2,750/mo   │ │ │
│ │ │ 2 BR · 1,050 sq ft      │ │ │
│ │ │ [Balcony][Laundry][✓Ver]│ │ │
│ │ └────────────────────────┘ │ │
│ │ ┌────────────────────────┐ │ │
│ │ │ Unit 1104   $3,100/mo   │ │ │
│ │ │ 1 BR + den · 1,180 sqft │ │ │
│ │ │ [Balcony][Laundry][Conf]│ │ │
│ │ └────────────────────────┘ │ │
│ │ View live availability  →  │ │
│ │ Hide details ▴             │ │
│ └───────────────────────────┘ │
├──────────────────────────────┤
│  [ Walk | Drive ]   Refine(8) │
└──────────────────────────────┘
```

### C. Refine sheet (full screen)

```
┌──────────────────────────────┐
│  ✕                       Done │
│  Refine                       │  Fraunces 33px
│  8 buildings match            │  aria-live
│ ──────────────────────────── │
│  MUST HAVES        🔒          │
│  These can't be turned off.   │
│   ✓ 2 bedrooms (or 1BR + den) │
│   ✓ 24-hour concierge         │
│   ✓ Private balcony           │
│   ✓ In-unit laundry           │
│ ──────────────────────────── │
│  WHAT MATTERS TO YOU          │
│  Turn on what you care about. │
│  Slide to say how much.       │
│                               │
│  ◉  Lower monthly cost        │  toggle ON
│     ●━━━━━━━━━━━━━━     72     │  slider shows
│                               │
│  ○  Short walk to Metro       │  toggle OFF
│                               │  (no slider)
│  ◉  Quiet, away from train    │
│     ━━━━●━━━━━━━━     45       │
│                               │
│  ○  Elevator                  │
│  ◉  Pet-friendly (small dog)  │
│     ━━━━━━━●━━━━     60        │
│  ○  Close to Kemp Mill Syn.   │
│  ○  Close to Berman Academy   │
│  ◉  More square footage       │
│     ━━●━━━━━━━━━     30        │
│  ○  Pool                      │
│  ○  Nearby playground         │
├──────────────────────────────┤
│  [      Show 8 buildings    ] │  sticky primary
│   ▔▔▔▔ home indicator ▔▔▔▔    │
└──────────────────────────────┘
```

## 11. Implementation notes for the developer

- **Ranking:** filter to buildings where every unit-or-building passes all four must-haves (a building qualifies if it has at least one passing unit). Score each qualifying building as the weighted sum of its active preference scores, each preference normalized to 0..1 across the result set, multiplied by its slider weight, summed, then mapped to 0..100 for display. Re-rank live when the Refine sheet applies. Distances feed the Metro-walk, synagogue, and school preferences from the same data the distance card uses.
- **Walk/Drive:** keep one global state variable; every distance render reads it. Persist it for the session only (no storage needed for one user, but `sessionStorage` is fine).
- **Data shape:** buildings array, each with `id`, `name`, `photos[]`, `leasingUrl`, `coords`, `distances` (walk and drive minutes to the three fixed places), `mustHaves` (booleans), `preferenceScores`, and `units[]` (each with `label`, `rent`, `beds`/`den`, `sqft`, `balcony`, `laundry`, `verified`). The existing `housing-properties.json` and `housing-config.json` in this repo are the starting point; align the renderer to that schema.
- **No build step:** ES modules via `<script type="module">`, Leaflet from a pinned CDN URL with SRI, lazy-loaded on first expand.
- **One expanded card at a time;** collapsing is automatic when another opens.
