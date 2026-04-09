# Building a Wall Calendar with React + TypeScript

A deep dive into how this project works — from the visual design tricks to the state management, animations, and responsive behaviour.

---

## What is this project?

It's a wall calendar that actually looks like a physical paper calendar hanging on a wall. Not just a grid of dates — it has a spiral binding at the top, a cover photo with diagonal cut shapes, month flip animations with sound, date range selection, per-date notes, holiday indicators, and 5 color themes. Everything runs in the browser with no backend. Notes persist in `localStorage`.

---

## Tech Stack

- **React 18** with hooks only — no class components
- **TypeScript** for type safety across all state and props
- **Vite** as the build tool and dev server
- **CSS** (plain, no Tailwind or CSS-in-JS) with CSS custom properties for theming
- **Font Awesome** (`@fortawesome/react-fontawesome`) for icons
- **localStorage** for note persistence — no database needed

---

## Project Structure

```
src/
  WallCalendar.tsx   — entire app logic and JSX
  WallCalendar.css   — all styles
  assets/
    cover.webp       — hero photo
public/
  tone.mp3           — page flip sound
```

Everything lives in two files intentionally. The component is self-contained and can be dropped into any React project.

---

## Visual Design — How the Hero Section Works

This is the most interesting part of the UI. The hero looks like a photo with two blue geometric shapes peeking out from underneath it, forming a V-notch at the bottom. Here's how it's actually built.

### Layer Stack

There are four layers stacked on top of each other inside `.wc-hero`:

```
z=1  .wc-shape-left    — blue left triangle
z=1  .wc-shape-right   — blue right parallelogram (holds year/month text)
z=2  .wc-cover-wrap    — the photo, clipped with a diagonal V-cut
z=30 .wc-hero-overlay  — year, month text, nav buttons
```

The photo sits on top of both blue shapes. Its bottom edge is cut diagonally using `clip-path`, which exposes the blue shapes underneath — giving the illusion that the shapes are "behind" the photo and peeking out.

### The Photo Clip Path

```css
.wc-cover-wrap {
  clip-path: polygon(0% 0%, 152% -1%, 30% 95%, -1% 72%);
}
```

This cuts the photo into a quadrilateral — full width at the top, then a diagonal cut from bottom-right to bottom-left. The `152%` and `-1%` values intentionally go outside the element bounds to ensure no gaps appear at the edges.

### The Blue Shapes

`.wc-shape-left` is a small triangle that peeks out from the bottom-left of the photo cut:

```css
clip-path: polygon(25% 69%, -115% 64%, -1% 100%);
```

`.wc-shape-right` is a large parallelogram covering the right side, which also contains the year/month text:

```css
clip-path: polygon(2% 34%, 102% 139%, 100% -1%);
```

Both shapes use `background: var(--wc-main)` so they automatically update when the theme changes.

### Image Loading Fallback

```css
.wc-cover-wrap {
  background-color: var(--wc-main);
  background-image: url(...);
}
```

`background-color` renders behind `background-image`. So while the image loads — or if it fails — the clipped area shows the theme color instead of a white gap.

---

## The Spiral Binding

The `SpiralBinding` component renders 18 coil divs and a nail hook above them:

```tsx
function SpiralBinding() {
  const coils = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="wc-spiral-bar">
      <div className="wc-nail-hook" />
      {coils.map((i) => <div key={i} className="wc-coil" />)}
    </div>
  );
}
```

Each `.wc-coil` is a small div with a border, no bottom border, and a border-radius on the top — making it look like the top half of a ring. The `.wc-nail-hook` uses a `::before` pseudo-element to add the nail head above the hook. All sizes use `clamp()` so they scale with the viewport.

---

## Theming System

Five themes are defined as plain objects:

```ts
const THEMES = {
  blue:  { main: "#1a85d6", dark: "#0e5fa0", light: "#e8f4fd" },
  teal:  { main: "#0d9488", dark: "#0f766e", light: "#d1fae5" },
  amber: { main: "#d97706", dark: "#b45309", light: "#fef3c7" },
  rose:  { main: "#e11d48", dark: "#9f1239", light: "#ffe4e6" },
  slate: { main: "#475569", dark: "#1e293b", light: "#f1f5f9" },
};
```

The active theme's values are injected as CSS custom properties on the root element:

```tsx
const themeVars = {
  "--wc-main":  t.main,
  "--wc-dark":  t.dark,
  "--wc-light": t.light,
  "--wc-range-bg": hexToRgba(t.main, 0.12),
  ...
} as React.CSSProperties;

<div className="wc-root" style={themeVars}>
```

Every component that needs a theme color just uses `var(--wc-main)` in CSS. Switching themes is instant — React updates the inline style, the browser recalculates all CSS variables in one pass.

Two utility functions support this:

- `hexToRgba(hex, alpha)` — converts a hex color to `rgba()` for transparent variants like the range selection background
- `darken(hex, amount)` — darkens a hex color by subtracting from each RGB channel, used for the hero gradient

---

## Calendar Grid Logic

### Calculating the Start Offset

The grid starts on Monday. JavaScript's `Date.getDay()` returns 0 for Sunday, so we need to remap:

```ts
const firstDayOfWeek = new Date(year, month, 1).getDay();
const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
```

If the month starts on Sunday (0), we need 6 empty cells before it. Otherwise we subtract 1 to shift from Sunday-first to Monday-first.

### Overflow Days

Before the first day, we show the tail end of the previous month (greyed out, disabled). After the last day, we fill the remaining cells with the start of the next month. These cells are rendered as disabled `DayCell` buttons.

### DayCell Component

Each day is a `<button>` that accumulates CSS class modifiers:

```tsx
const classes = [
  "wc-day",
  isOtherMonth ? "wc-day--other" : "",
  isToday      ? "wc-day--today" : "",
  isWeekend    ? "wc-day--weekend" : "",
  isStart      ? "wc-day--start" : "",
  isEnd        ? "wc-day--end" : "",
  inRange && !isStart && !isEnd ? "wc-day--range" : "",
  hasHoliday   ? "wc-day--holiday" : "",
  noteType === "single" ? "wc-day--note-single" : "",
  noteType === "range"  ? "wc-day--note-range"  : "",
].filter(Boolean).join(" ");
```

This keeps the rendering logic clean — the component just receives boolean props and maps them to classes.

---

## Date Range Selection

Selection works in two clicks:

1. First click → sets `rangeStart`, clears `rangeEnd`, sets `selecting: true`
2. Second click → sets `rangeEnd`, sets `selecting: false`

```ts
const handleDayClick = (d: number) => {
  const pt = { y: year, m: month, d };
  if (!selecting || !rangeStart) {
    setRangeStart(pt);
    setRangeEnd(null);
    setSelecting(true);
  } else {
    setRangeEnd(pt);
    setSelecting(false);
  }
};
```

To determine if a day falls within the range, dates are converted to a comparable integer:

```ts
function toComparable(dt: DatePoint): number {
  return dt.y * 10000 + dt.m * 100 + dt.d;
}
```

This lets us do simple `>=` / `<=` comparisons without creating `Date` objects for every cell on every render.

The range highlight uses `border-radius` tricks:
- Start day: `border-radius: 50% 0 0 50%` (rounded left, flat right)
- End day: `border-radius: 0 50% 50% 0` (flat left, rounded right)
- Middle days: `border-radius: 0` (flat rectangle)
- Single day (start === end): `border-radius: 50%` (full circle)

---

## Notes System

### Storage Keys

Notes are stored in `localStorage` under the key `wc-notes` as a JSON object. The keys inside that object identify what the note belongs to:

- Single date: `"2026-3-14"` (year-month-day)
- Date range: `"2026-3-14__2026-3-20"` (two date keys joined by `__`)
- Month fallback: `"2026-2"` (year-month, used when no date is selected)

```ts
function rangeNoteKey(start, end) {
  // always stores with the earlier date first
  const s = toComparable(start) <= toComparable(end) ? start : end;
  const e = toComparable(start) <= toComparable(end) ? end : start;
  return `${dateKey(s)}__${dateKey(e)}`;
}
```

### Dot Indicators on Days

When rendering the grid, we scan all stored notes and build a `Map<day, "single" | "range">`. Days with notes get a small colored dot in the top-right corner via a `::before` pseudo-element:

- Purple dot → single-date note
- Green dot → range note

### All Notes View

The "All (n)" button in the notes panel switches to a read-only list of all notes for the current month. The `NotesList` component groups notes by their key, shows a colored header (purple for single, green for range), and provides delete buttons for individual notes or entire groups.

---

## Page Flip Animation

When navigating months, the card rotates on the X axis around its top edge — like peeling a page off a physical wall calendar.

### The Trick: Swap Content Mid-Animation

The content (month/year data) updates at the midpoint of the animation, not at the start or end. This is why it feels natural — you see the old page fold away, then the new page unfolds into view.

```ts
const triggerFlip = (dir, cb) => {
  playSound();
  setFlipDir(dir);
  setTimeout(() => {
    cb();           // ← update month/year here, at the fold point
    setFlipDir(null);
  }, 380);
};
```

### The Keyframes

```css
@keyframes wc-flip-next {
  0%   { transform: perspective(1200px) rotateX(0deg);   opacity: 1; }
  40%  { transform: perspective(1200px) rotateX(-70deg); opacity: 0.6; }
  60%  { transform: perspective(1200px) rotateX(-70deg); opacity: 0.6; }
  100% { transform: perspective(1200px) rotateX(0deg);   opacity: 1; }
}
```

The card holds at `-70deg` for frames 40–60% — this is the "folded" state where the content swap happens invisibly. Then it rotates back to `0deg` showing the new month.

`transform-origin: top center` ensures the rotation pivots from the top edge (where the spiral binding is), not the center.

### Sound

An `Audio` object is created once on mount and reused:

```ts
const flipAudio = useRef(null);
useEffect(() => { flipAudio.current = new Audio("/tone.mp3"); }, []);
```

On each flip: `flipAudio.current.currentTime = 0` resets it so rapid navigation always plays from the start. `.play().catch(() => {})` silently handles browsers that block autoplay before user interaction.

---

## Year / Month Picker

Clicking the year or month text in the hero opens a popover. The popover is rendered via `createPortal` into `document.body` — this avoids clipping issues from the `overflow: hidden` on the hero container.

```tsx
{pickerOpen && createPortal(
  <div id="wc-picker-portal" className="wc-picker-popover" style={...}>
    ...
  </div>,
  document.body
)}
```

Position is calculated from the overlay element's bounding rect:

```ts
const r = overlayRef.current.getBoundingClientRect();
setPickerPos({
  top: r.bottom + window.scrollY + 6,
  right: window.innerWidth - r.right
});
```

A `mousedown` listener on `document` closes the picker when clicking outside both the trigger and the portal.

Selecting a year or month also triggers the flip animation, with direction determined by whether the new value is greater or less than the current one.

---

## Holiday Indicators

Holidays are hardcoded as a `Record<string, string>` with keys in `"year-month-day"` format:

```ts
const HOLIDAYS = {
  "2026-1-26": "Republic Day",
  "2026-8-15": "Independence Day",
  ...
};
```

`getHolidaysForMonth(year, month)` filters this down to just the current month and returns a `Record<day, name>`. Days with holidays get a small amber dot at the bottom via `::after`. The notes panel also lists all holidays for the month in a separate section.

---

## Responsive Design

### Desktop

The lower section uses a two-column CSS grid: `200px` for the notes panel, `1fr` for the calendar grid.

### Mobile (≤ 620px)

The grid collapses to a single column. The notes panel becomes a collapsible dropdown:

- The "Notes" header becomes a tappable button with a Font Awesome chevron icon
- The notes body has `max-height: 0; overflow: hidden` by default
- Adding `.wc-notes-body--open` transitions it to `max-height: 600px`
- The chevron rotates 180° when open

```css
.wc-notes-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.wc-notes-body--open {
  max-height: 600px;
}
```

This keeps the calendar grid immediately visible on mobile without the notes taking up half the screen.

The hero section maintains the same `clip-path` geometry on mobile as on desktop — the same diagonal V-cut and both blue shapes — just with a fluid height using `clamp(160px, 48vw, 240px)`.

All font sizes and spacing in the hero use `clamp()` to scale smoothly between breakpoints without needing multiple media query overrides.

---

## CSS Architecture

All styles use a `wc-` prefix (wall calendar) to avoid collisions if the component is embedded in a larger app.

CSS custom properties (`--wc-main`, `--wc-dark`, `--wc-light`, etc.) are set inline on the root element and consumed throughout the stylesheet. This means the entire theme can change by updating a single style attribute — no JavaScript needs to touch individual elements.

BEM-style modifier classes (`wc-day--today`, `wc-day--start`, `wc-card--flip-next`) keep specificity flat and predictable.

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The `tone.mp3` file needs to be in the `public/` folder for the flip sound to work.

```bash
npm run build
```

Outputs to `dist/`. Static files, no server required.
