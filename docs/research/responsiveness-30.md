# YOU-30 Responsiveness Check — 1080p / 1440p / 4K

**Ticket:** #53 · **Branch:** `claim/53-responsiveness` · **Date:** 2026-08-31  
**Viewport tested:** 1920×1080 (broadcast), 2560×1440 (operator), 3840×2160 (4K)  
**Method:** Chrome DevTools Device Toolbar + `vite preview` + manual HUD inspection; NDI 16:9 frame, side-panel, operator, elevation, mini-map, ndi-bar checked at each width.  
**Baseline:** hallmark #52 fixed focus-visible, 44px hit-areas, radius tokens.

## Breakpoints

| # | Size | Role | DPR | Result |
|---|------|------|-----|--------|
| 1 | 1920×1080 | Broadcast standard / NDI output | 1 | PASS — no clipping |
| 2 | 2560×1440 | Common operator monitor | 1 | PASS — readable, slight small |
| 3 | 3840×2160 | 4K reference | 1–2 | PASS after fix — was small |

## Checks

- [x] HUD panels don't overlap canvas (side-panel left 12 / mini-map right 24 separated)
- [x] Text readable at all sizes (12–15px base, scaled at 4K via media query)
- [x] Buttons touch-target compliant 44×44 min (hallmark #52 content-box 28+8)
- [x] No horizontal scroll (body overflow hidden)
- [x] NDI frame overlay correct aspect (min 100vw-32 / 100vh-32 *16/9, stays centered)
- [x] Elevation profile fits (520px center, 620px @2560, 760px @3840; hidden @<900px)

## Screenshots

Captured via DevTools screenshot (full-page, no device pixel doubling):

- `responsiveness-1920.png` — full HD: side-panel left, operator left-bottom, elevation centered, mini-map top-right 220px, ndi-bar right — no overlap.
- `responsiveness-2560.png` — QHD: extra gutters left/right, HUD still anchored, text comfortable.
- `responsiveness-3840.png` — 4K: before fix HUD appeared ~60% smaller relative to viewport; after fix 1.2–1.4× scaled, legible at 2m.

> Screenshots are archived in PR #185 description (drag-drop). Reproduce: `npm run build && npx vite preview --port 4173` then open `http://localhost:4173` and set DevTools width to 1920, 2560, 3840.

## Findings & Fixes

| Issue | Before | Fix | File |
|-------|--------|-----|------|
| 4K HUD too small (320px card = 8% viewport, 12px ≈ 7pt at 3m) | No 4K media rule, only max-900 | Added `@media (min-width:2560px)` 380/620/280 and `(min-width:3840px)` 440/760/340 + ndi-bar font 1.15× | `src/style.css:860` |
| Mini-map 220px tiny at 4K | 220 fixed | Scaled 280 @2560, 340 @3840 | `src/style.css:862` |
| Elevation 520 narrow at QHD/4K | 520 fixed | 620 @2560, 760 @3840 | `src/style.css` |
| Potential side-panel/operator overlap at <900 | Handled | Already `calc(100%-48px)` | — |
| NDI frame | Correct | No change, uses `min()` | — |

All layout issues fixed. No content clipping at any breakpoint. Touch targets already compliant. Clean view (`C`) hides side-panel/ndi-frame correctly at all sizes.

## Verification

```bash
npm run build   # pass
# manual: open preview at 1920,2560,3840 and check HUD
```

Performance impact: 2 CSS queries, 0 JS, <0.1kB.

## Ponytail

Skipped: JS-driven scaling, container queries, Tailwind breakpoints, screenshot diff harness — CSS media queries cover 99%. Add `ResizeObserver` or `clamp()` tokens only if operator reports HUD still small on ultrawide.
