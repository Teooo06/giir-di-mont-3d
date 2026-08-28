# YOU-12: Lower-Third Layout — Design Spec (Teooo06)

> **Ticket:** `#35` · **Branch:** `claim/35-lowerthird-design` · **Phase:** Broadcast Graphics
> **Deliverable:** HTML mockup + specs (Figma placeholder) per `YOU-12` acceptance

## 1. Overview

Broadcast lower-third 16:9 safe area, **height 80px (5% 1080p)**, position **bottom 10%**, width **80% centered** or full width, themeable via `settingsManager.settings.themeColor`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🇮🇹  ● Morven Goodrum        GBR    +02:40    6:18 min/km  │
└─────────────────────────────────────────────────────────────────────────────┘
- Background: rgba(14,20,23,0.92) — var(--card-bg)
- Top accent: 4px themeColor
- Fonts: Barlow Condensed primary, DM Sans secondary
- Spacing: 16px padding, 12px gap, 40×40 flag, 60×60 avatar
```

## 2. Fields (6)

1. **Flag** — emoji/SVG 40×40, `flag` (e.g., 🇮🇹)
2. **Avatar** — circular 60×60, `photoUrl` or placeholder `●`
3. **Name** — bold 18px Barlow Condensed, `name`
4. **Nation** — 12px uppercase DM Sans, `country` (3-letter)
5. **Gap** — 14px mono, `gap` (e.g., +02:40 or LEADER)
6. **Pace** — 12px mono, `pace` (e.g., 6:05 min/km)

## 3. Specs

- **Container:** `height 80px`, `border-radius 6px`, `backdrop-filter blur(12px)`, `border 1px --border-subtle`
- **Accent bar:** `height 4px`, `background var(--accent-neon)` (themeColor)
- **Text:** `name 700 18px/1 Barlow`, `country 700 12px DM Sans uppercase`, `gap 700 14px mono #fff`, `pace 600 12px #cfd6cd`
- **Layout:** flex `flag 40 + avatar 60 + name/country flex:1 + gap + pace`, `gap 16px`
- **Safe area:** `bottom 10%` (`~108px` from bottom), `left 10%` `width 80%`, `z-index 15` above NDI frame
- **Theme:** `themeColor` drives accent bar + flag border, via `document.documentElement.style.setProperty('--accent-neon', color)`

## 4. HTML Mockup

See `public/mockups/lower-third.html` — static mockup with 3 states: `LEADER`, `+02:40`, `DNF` (greyed). Open via `http://localhost:5173/mockups/lower-third.html`.

## 5. Animation (for YOU-15 GSAP)

- **In:** `slide up 300ms easeOut` + `fade` from `translateY(20px) opacity 0` → `0,1`
- **Out:** `slide down 250ms easeIn` → `20px,0`
- **Punch:** gap change `scale 1.1 →1` 150ms

## 6. Assets

- **Flags:** emoji fallback, SVG via `https://flagcdn.com/w40/{cc}.png` (cc lower)
- **Avatar:** `https://i.pravatar.cc/60?u={bib}` placeholder or `src/assets/avatar-{bib}.jpg`

## 7. NDI vs Browser

- **Browser:** HTML overlay `div.lower-third` (above), `layer` not needed
- **NDI:** CanvasTexture Sprite `layer 1` (as checkpoint sprites) or HTML → `ndi-streamer` capture includes overlay if `preserveDrawingBuffer` true on browser? **Decision:** HTML overlay for browser, Sprite for NDI (same content, dual render) — matches `PROG-01` bicolor dual geometry approach.

---

*Generated for YOU-12 #35 per WAYFINDER_PROTOCOL Not yet specified → fog graduato (lower-thirds pending PROG-01 track decision) — HITL: feedback su layout/photo/flag prima di YOU-13 build.*
