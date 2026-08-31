# DESIGN.md — Giir di Mont 3D Broadcast Design System

*Extracted 2026-08-31 via `design-system` skill from `index.html:1`, `impostazioni.html:1`, `src/style.css:1`, `src/impostazioni.css:1`, `vite.config.js:1`. Source: local HTML/CSS (live URL not needed). Covers both pages — 3D operator view + control dashboard share tokens.*

---

## 1. Visual Theme & Atmosphere

**Mood:** Alpine broadcast mission-control — dark, high-contrast, neon-lime accents on near-black. Feels like a TV gallery at dawn in Premana: sky `#94b5c7` behind 3D, HUD panels floating with `backdrop-filter: blur(12px)`, thin `1px` subtle borders, no heavy gradients. Depth comes from layered shadows, not gloss.

**Philosophy:** Content (map, track, athletes) dominates; chrome retreats. Accent `Giallo Giir` punches through low-saturation mountain palette. Every interactive element has a 0.15s ease — snappy, never sluggish. Type is condensed and uppercase — broadcast typography, not editorial.

**Light:** Near-black canvases let the 3D and lime pop. `FogExp2 #9dbecd 0.00068` softens distant terrain (denser than original 0.00045 to hide blue DEM borders `src/main.js:19`). ACESFilmicToneMapping + exposure 1.12 gives a natural HDR alpine sky.

**Reference:** Imagine Eurosport mountain stage + Swiss timing dashboard — that contrast.

---

## 2. Colour Palette & Roles

| Role | Name | Hex / Value | Usage |
|------|------|-------------|-------|
| **Primary accent** | Giallo Giir (neon lime) | `#dff654` `--accent-neon` | Primary actions, active tabs, active scene btn, `kbd` accent, bib default, track highlight, tally caution, frame overlay, dots |
| **Bg app** | Near-black | `#080d10` `--bg-main` (3D page) / `#0a0f12` `--bg-dark` (dashboard) | `body` behind canvas/dashboard |
| **Surface card** | Charcoal glass | `rgba(14,20,23,0.92)` `--card-bg` / `#12191d` `--bg-card` | `side-panel`, `operator`, `profile-card`, `ndi-bar`, `nav-tabs` |
| **Surface input** | Input charcoal | `#0a0e10` `--bg-input` / `rgba(0,0,0,0.3-0.5)` | `split-input`, `form-control`, `athlete-edit-box`, table cells |
| **Surface elevated-2** | Dashboard card | `#12191d` | `card` in impostazioni (shadow `0 12px 36px rgba(0,0,0,0.4)`) |
| **Text primary** | Off-white | `#f7f5ec` / `#f5f7f5` `--text-main` | Body, headings, bib text on lime uses `#11170e` |
| **Text secondary** | Muted sage | `#95a298` `--text-muted` / `#aeb6ae` / `#cfd6cd` / `#adb6ad` | Eyebrows, subtitles, help text, small sums |
| **Text on accent** | Near-black | `#11170e` | Text inside `.nav-tab.active`, `.scene-btn.active`, `.badge`, `.btn-primary` |
| **Border subtle** | Glass border | `rgba(255,255,255,0.12)` `--border-subtle` / `--border-color` | All cards, bars, panels, inputs — always thin 1px |
| **Semantic red** | Race red | `#ff3b30` `--accent-red` | `on-program` tally `rgba(255,59,48,0.2)`, DOT pulse 1s, brand presets |
| **Semantic green** | Live green | `#34c759` `--accent-green` | `ndi-badge.live` dot, `pulse-green 2s` |
| **Semantic yellow** | Caution | `#ffcc00` `--accent-yellow` | `tally-tag.preview`, transition indicator |
| **Terrain tree** | Alpine fir | `#1a3826` | `ConeGeometry` material `roughness 0.9` `src/main.js:161` |
| **Terrain sky** | Alpine sky | `#94b5c7` `scene.background` | Sky, fog colour `#9dbecd` |
| **Accent presets** | Broadcast alternates | `#00f0ff` ciano, `#ff9500` arancio, `#34c759`, `#ff3b30` | `impostazioni.html:144` preset-btns |
| **Overlay scratch** | HUD hint | `rgba(223,246,84,0.9)` dashed frame + `#dff654` glow | `.ndi-frame` border `1.5px dashed` |

**Contrast notes:** Lime `#dff654` on `#080d10` passes AAA for large text (use `#11170e` on lime buttons). Red badge `#ff3b30` on white text passes AA. Dashboard uses `DM Sans` small text at 12-13px — ensure line-height 1.4.

**Dark mode:** Native dark only — no `.dark` toggle; both pages are dark by design.

---

## 3. Typography

**Families (Google Fonts `@import` in both CSS):**
```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;500;700&family=Montserrat:wght@500;700;800&family=Oswald:wght@500;700&display=swap');
```
- **Primary / Headings:** `Barlow Condensed` 500-800 — all titles, buttons, badges, `eyebrow`, `scene-btn`, `profile-title`, tallies. Letter-spacing `0.03-0.16em`, uppercase everywhere except prose.
- **Secondary / Body (dashboard):** `DM Sans` 400/500/700 — table body, subtitles, help text, prose (`--font-family` in impostazioni).
- **Alternates:** `Montserrat` / `Oswald` selectable via `#font-family-select` (`impostazioni.html:155`) — broadcast alternates, not default.
- **Mono:** `monospace` for `kbd`, `split-input`, `op-elapsed`, `sim-speed-val`, `splits-table` times.

| Token | Value | Where |
|-------|-------|-------|
| `--font-primary` | `'Barlow Condensed', sans-serif` | `src/style.css:11` — used on `body`, all HUD |
| `--font-heading` (dash) | `'Barlow Condensed'` / `'DM Sans'` body | `src/impostazioni.css:12-13` |
| Eyebrow | `700 11-12px /1`, `tracking 0.16em`, uppercase, `color: var(--accent-neon)` | `.eyebrow` `src/style.css:38` |
| H1 (dash) | `800 28px/1.1`, `tracking 0.02em`, uppercase | `.brand h1` `impostazioni.css:47` |
| Brand strong (HUD) | `700 24px/1`, `tracking 0.03em` uppercase | `.brand strong` `style.css:33` |
| Scene button | `600 14px`, `tracking 0.04em` | `.scene-btn` `style.css:216` |
| Nav tab | `700 13px`, `tracking 0.06em` | `.nav-tab` `style.css:64` |
| Badge | `700 11px`, `tracking 0.12em` uppercase | `.badge` `impostazioni.css:90` |
| Table header | `700 11px`, `tracking 0.08em` uppercase | `.splits-table th` `impostazioni.css:209` |
| Card h2 | `700 22px`, uppercase, `tracking 0.03em` | `.card-header h2` `impostazioni.css:99` |
| Small help | `11px /1.4`, `color: var(--text-muted)` | `.help-text` `impostazioni.css:305` |
| KBD | `700 9-11px monospace`, `color: var(--accent-neon)` | `.operator p kbd` `style.css:642` |
| Body base | `500 13-14px`, `line-height 1.4` | `impostazioni.css:204` |

**Line-height:** HUD cards `1.1-1.4`; dashboard paragraphs `1.4`; no explicit `--leading` tokens — keep tight.

**Weights used:** 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold). No 300/400 thin in production.

---

## 4. Component Styles

**Buttons**
- **Primary:** `background: var(--accent-neon) #dff654; color: #11170e; padding 10px 18px; radius 6px; font 700 14px uppercase tracking 0.06em` — hover `opacity 0.9`. Used `.btn-primary`, `.action-btn`, `.mini-btn`.
- **Secondary ghost:** `background rgba(255,255,255,0.08); border 1px solid var(--border-subtle); color #fff; padding 8px 14px; radius 5px; font 700 12px uppercase` — hover `rgba(255,255,255,0.15)`. Class `.btn-secondary`.
- **Scene button:** Full-width flex `gap 10px`, `background rgba(255,255,255,0.06); border 1px transparent; padding 9px 12px; radius 5px; font 600 14px letter 0.04em` — `active/hover` = lime fill `var(--accent-neon)` text `#11170e` + `kbd` invert. `src/style.css:204`.
- **Danger:** `background rgba(255,59,48,0.15); color #ff6961; border rgba(255,59,48,0.3); padding 8px 14px; radius 5px` `.btn-danger`.
- **Outline:** transparent + `1px border` `var(--border-subtle)` text muted — hover white border `.btn-outline`.
- **Action in NDI bar:** `rgba(255,255,255,0.08) 5px 10px radius 4px font 700 12px` — hover lime. Disabled variant `rgba(255,59,48,0.2)` red.
- **Interaction:** All `transition: all 0.15s ease` — no spring.

**Cards**
- **Operator / Side-panel / Profile:** `background var(--card-bg) rgba(14,20,23,0.92-0.94); border 1px solid var(--border-subtle); radius 8px; backdrop-filter blur(12-14px); shadow 0 12-16px 32-36px rgba(0,0,0,0.5)` — header has `border-bottom 1px subtle`. Padding `10-16px`. `src/style.css:175/552`.
- **Dashboard card:** Larger — `background var(--bg-card) #12191d; border 1px solid var(--border-color); radius 10px; padding 24px; shadow 0 12px 36px rgba(0,0,0,0.4); gap 24px in grid` `.card` `impostazioni.css:74`.
- **Header inside card:** flex `justify-content space-between`, `.badge` above `h2`, subtitle `color var(--text-muted) 13px`.
- **Nested boxes:** `athlete-edit-box` = `rgba(0,0,0,0.25) border subtle radius 8px padding 16px`. `table-container` = `border 1px subtle radius 8px`.

**Navigation**
- **Nav tabs (HUD):** `position fixed top 20 left 24`, flex `gap 4px`, `background rgba(12,17,20,0.92) border subtle radius 8px padding 4px backdrop blur 12px shadow 0 8px 24px`. Tabs `transparent` + `padding 8px 16px radius 6px font 700 13px tracking 0.06em color #aeb6ae` — `active` = lime fill `#11170e`. Hover `rgba(255,255,255,0.08)`.
- **Dashboard header:** `display flex justify space-between align center margin-bottom 24px padding-bottom 20px border-bottom 1px solid var(--border-color)`.
- **Athlete tabs:** flex wrap gap 8px, `.ath-tab` `rgba(255,255,255,0.05) border radius 6px padding 8px 14px` — active lime.
- **Scene quick list:** In `#tab-scenes` `side-panel` at `top 60 left 12 width 320 max-height calc(100vh-180px)` — always visible, not behind nav.
- **Active indicator:** Filled background, not underline. No icon — `kbd` number carries wayfinding.

**Forms**
- **Text / select:** `background var(--bg-input) #0a0e10; border 1px solid var(--border-color); color #fff; padding 8px 12px; radius 5px; font 500 14px var(--font-family)` — focus `border-color var(--accent-neon)` no outline. Placeholder muted.
- **Color input:** `height 38px width 100% radius 5px border subtle` — dashboard shows 50px for theme picker + 4 preset circles `32px radius 50% border 2px transparent hover scale 1.15`.
- **Range slider:** `width 100% accent-color var(--accent-neon)` — labels `700 11px uppercase tracking 0.08em color var(--text-muted)`. Help text `11px muted` above/below.
- **Choice radio cards:** Grid `1fr 1fr 1fr gap 10px`, `.card-content` `rgba(255,255,255,0.04) border subtle padding 12px radius 6px` — `:checked + .card-content` = `border-color lime + rgba(223,246,84,0.1)` bg.
- **Split input:** `width 75-95px background rgba(0,0,0,0.5) border subtle color var(--accent-neon) font 700 12-13px monospace padding 4-5px 6-8px radius 3-4px text-center`.
- **Checkbox:** `display flex gap 8px cursor pointer` — label `700 11-12px uppercase muted` unless `.checkbox-group` where `text-transform none` and white.
- **Splits table:** `border-collapse collapse text-left 13px`, header `rgba(255,255,255,0.04) padding 10px 12px font 700 11px tracking 0.08em uppercase`, cell `padding 10px 12px border-bottom rgba(255,255,255,0.05)`. Container `border 1px subtle radius 8px`.

**Overlays & HUD extras**
- **NDI bar:** `fixed top 20 right 24 flex gap 12 align center background var(--card-bg) border subtle padding 6px 12px radius 8px blur 12px shadow`. Badge `flex gap 8 padding 4px 8px radius 4px background rgba(0,0,0,0.35) border 1px rgba(255,255,255,0.1) font 700 12px tracking 0.08em uppercase` — states: `live` green border + pulse, `on-program` red `rgba(255,59,48,0.2)` + red pulse 1s, `offline` grey. Info `600 12px tracking 0.06em color #cfd6cd`.
- **NDI 16:9 frame:** `fixed top 50 left 50 translate -50/-50 width min(calc(100vw-32px), calc((100vh-32px)*16/9)) height min(...*9/16) aspect 16/9 border 1.5px dashed rgba(223,246,84,0.9) radius 6px z 8 box-shadow inset 1px + 0 0 22px`. Corners `18px border 3px lime` top-left / bottom-right. Label `top -11 left 50 translateX -50 background lime color #11170e font 700 9px tracking 0.12em padding 3px 8px radius 3px shadow`. Hidden with `body.clean` or `.hidden` class. `src/style.css:688`.
- **Transition indicator:** `left 50 bottom 88 translateX -50 background rgba(223,246,84,0.95) color #11170e padding 6px 14px radius 4px font 700 12px tracking 0.08em shadow 0 4px 16px`. `src/style.css:457`. Shown only while `ndiTween` active `src/main.js:1214`.
- **Elevation HUD:** `left 50 bottom 24 translateX -50 width 520 pointer-events none`. Inner `.profile-card` same glass. Title `700 15px tracking 0.04em`, stats `700 16px lime`, axis `700 10px muted tracking 0.06em`. Marker `.marker-dot 10px lime circle shadow 0 0 10px`. `src/style.css:469`.
- **Operator card:** `left 24 bottom 24 width 320 background linear-gradient(145deg rgba(16,24,26,0.94), rgba(20,32,28,0.9)) border subtle radius 8px shadow 0 16px 36px blur 12px overflow hidden`. Title `flex justify between padding 10px 14px border-bottom`. `#mode 700 12px tracking 0.1em white`. Tally `700 11px tracking 0.08em padding 3px 8px radius 3px background rgba(255,255,255,0.1) muted` — program red `var(--accent-red) shadow 0 0 10px`, preview yellow `var(--accent-yellow) color #111`. Rider row `grid 42px 1fr auto gap 10 padding 10px 14px`, `.bib 800 18px lime on #11170e radius 4px`. Scrubber `padding 0 14px 10px input accent lime`. Foot `background rgba(0,0,0,0.35) 8px 14px color #adb6ad 10px kbd lime on rgba(0,0,0,0.4)`.
- **Clean notice:** `fixed left 20 bottom 20 z 30 padding 10px 16px background rgba(14,20,23,0.85) border subtle radius 6px color lime font 700 12px tracking 0.1em blur 8px display none → block in body.clean`.

**Data display**
- **Athlete row:** `grid 36px 1fr auto gap 10 align center background rgba(255,255,255,0.05) border subtle radius 6px padding 8px 10px cursor pointer` — hover `rgba(255,255,255,0.1)` active `border-color lime background rgba(223,246,84,0.12)`. Bib `background lime color #111 font 800 15px padding 4px`.
- **Checkpoint sprite:** Canvas `512×160` `createCheckpointLabelSprite()` `src/main.js:251` — rounded box `rgba(14,20,23,0.92) r 10 boxH 110 + 6px accent strip`, name `700 34px Barlow Condensed uppercase white centered`, sub `700 20px DM Sans #f6f4e9`, stem `lineWidth 6 color accent + shadowBlur 12`. Sprite `scale 80×25 world units layer 0` (HUD + NDI) `src/main.js:296`. Marker sphere `r 4.8 16/12 color white or theme`, dot `r 1.0 10/8 color theme` `src/main.js:324`.

---

## 5. Layout Principles

- **Max widths:** Dashboard `max-width 1380px margin 0 auto padding 24px` `impostazioni.css:27`. Operator HUD `width 320px left 24 bottom 24`. Side-panel same 320. Elevation `width 520` centered. These are hard ceilings — content never stretches edge-to-edge.
- **Grid:** Dashboard `grid 1.4fr 1fr gap 24px` `impostazioni.css:69` → collapses to `1fr` at `900px`. Radio-cards grid `1fr 1fr 1fr gap 10px`. Athlete rows grid `36px 1fr auto`. Rider card `42px 1fr auto`.
- **Vertical rhythm:** Sections separated by `12-24px` margins; `panel-divider 1px var(--border-subtle) margin 14px 0`. Card headers `margin-bottom 12-20px`. Form groups `margin-bottom 12-14px`.
- **Padding scale (observed):** 4, 6, 8, 10, 12, 14, 16, 20, 24. Use 8/12/16 as defaults; 24 only for card outer padding.
- **Radius scale:** 3px (kbd, bib small), 4px (badge, buttons, inputs), 5-6px (cards, scene-btn, frame), 8px (panels, operator, elevation), 10px (dashboard card), 50% (dots/presets).
- **Shadow scale:** `elevation 1` 8/24 shadow (bars, nav), `2` 12/32 (panels, dash cards), `3` 16/36 (operator), all `rgba(0,0,0,0.4-0.5)`. No colored shadows except lime/tally glows `0 0 10-12px`.
- **Blur:** `backdrop-filter blur(12px)` default, `14px` for side-panel — glass effect on dark, not frosted white.
- **Whitespace:** Balanced → generous. Header has `margin-bottom 24 padding-bottom 20 + border`. Cards breathe with 24px padding, not cramped.
- **Responsive:** Break at `900px`: elevation hidden, `dashboard-grid 1fr`, `side-panel width calc(100% - 48px)`, `operator width calc(100% - 48px)`. Canvas `#world fixed inset 0` always full.
- **Z-layers:** Canvas 0, HUD `z 10`, NDI frame `z 8`, clean notice `30`. Drone crosshair `5`.
- **Build:** Multi-entry Vite `vite.config.js:7` — `main→index.html`, `impostazioni`, `edit`, `controller` separate chunks. No Tailwind; pure CSS tokens above.

---

## 6. Design System Notes for Generation

*Paste this block verbatim into any baton / image-to-code prompt when generating new pages for this project — the model will reproduce the visual language without resampling.*

> **Design language: Alpine broadcast dark — Giir di Mont**
> - **Theme:** Dark only, near-black `#080d10` app bg, charcoal glass cards `rgba(14,20,23,0.92)` with `1px rgba(255,255,255,0.12)` borders, `blur 12px`, shadows `0 12px 32px rgba(0,0,0,0.5)`. No light mode.
> - **Accent:** Primary lime `#dff654` (Giallo Giir) for all active/CTA states; text on lime is `#11170e`. Support semaphores: red `#ff3b30` on-program, green `#34c759` live, yellow `#ffcc00` preview.
> - **Typography:** `Barlow Condensed 500/600/700/800` for headings/buttons/badges (uppercase, tracking `0.04-0.16em`), `DM Sans 400/500/700` for dashboard body, `monospace 700` for times/inputs. Eyebrow = `700 11px tracking 0.16em uppercase lime`. Load `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;500;700&family=Montserrat:wght@500;700;800&family=Oswald:wght@500;700&display=swap`.
> - **Type scale:** Brand 24px bold, H1 28/1.1, card H2 22px bold, badge 11px/0.12em, table header 11px/0.08em, body 13-14px/1.4, help 11px muted, kbd 9-11px mono on dark.
> - **Radii:** 3-4px inputs/badges, 5-6px buttons/frame, 8px panels/operator, 10px dashboard cards, 50% dots. Consistently tight, never pill-large except nav `8px`.
> - **Buttons:** Primary lime `10px 18px radius 6px 700 14px uppercase 0.06em #11170e` hover opacity 0.9; secondary ghost `rgba(255,255,255,0.08) 1px subtle border 8px 14px 700 12px` hover `0.15`; scene-btn `full width flex gap 10 padding 9px 12px radius 5px 600 14px #fff on 0.06` active = lime fill; all `transition 0.15s`.
> - **Cards/panels:** Glass dark, `radius 8-10px`, `shadow 12/32`, `blur 12-14px`, header `flex space-between` with badge + `h2 700 18-22px uppercase` + subtitle `13px muted`, footer `border-top subtle`.
> - **Nav:** Fixed `top 20 left 24` pill `background rgba(12,17,20,0.92) radius 8px padding 4px gap 4px` tabs `padding 8px 16px radius 6px 700 13px 0.06em color muted #aeb6ae` active lime; NDI bar `top 20 right 24` same glass `padding 6px 12px` + badge `rgba(0,0,0,0.35) 4px 8px`.
> - **Forms:** Input `bg #0a0e10 border subtle radius 5px padding 8px 12px 500 14px #fff` focus `border lime`; range `accent lime`; radio cards `grid 1fr×3 gap 10` each `rgba(255,255,255,0.04) radius 6px padding 12px` checked `border lime bg 0.1`.
> - **Overlays:** NDI 16:9 dashed lime `1.5px` `aspect 16/9` `radius 6px` glow; elevation HUD `width 520 center bottom 24` glass; transition pill `rgba(223,246,84,0.95) #11170e radius 4px 700 12px` above elevation; clean mode = `opacity 0.15 bars / 0.3 operator / hide panels + frame`.
> - **Spacing max:** Dashboard `1380px` centered `padding 24`; HUD panels `320px`; elevation `520px`. Gaps `12-24px`. Tight 4/8/12/16 base.
> - **Motion:** Only `transition all 0.15s ease` and `marker-dot left 0.15s ease-out`; badges pulse `2s`/`1s`. No GSAP on static chrome (reserved for camera tweens `easeInOutCubic 1.8s`).
> - **Imagery:** Alpine sky `#94b5c7` + fog `#9dbecd`; track is neon rainbow cycling `HSL hue ratio*4 + t*0.0003` traveled vs `0.35,0.38,0.42` remaining `src/main.js:384`; trees `InstancedMesh ConeGeometry 2.4×11 + base translate 5.5` color `#1a3826` count 600.
> - **Do:** Keep uppercase condensed hierarchy, one lime accent per screen, 1px subtle borders everywhere, blur on glass, condensed large numbers, monospace for times.
> - **Don't:** Introduce light backgrounds, pill-rounded 999px cards, gradient overlays on HUD, secondary accent competing with lime, thin 300 weights, drop-shadows heavier than 16/36.

---

## 7. Source Audit

**Files analysed:** `index.html:1` (119 lines), `impostazioni.html:1` (444), `src/style.css:1` (780), `src/impostazioni.css:1` (388), `src/main.js:1` (1279), `vite.config.js:1` (19), `edit.html`, `controller.html`.

**Exact tokens (no approximation):** All hex values from `:root` and explicit rules — no screenshot sampling. Font stacks from `@import` URL are exact. Radii/shadows copied verbatim.

**⚠️ Flagged for human review:**
- `#94b5c7` vs `#9dbecd` sky/fog are close — intentional split (fog slightly lighter) per `src/main.js:18`.
- Dashboard subtitle line-height `1.4` is inferred from `padding` + `font-size`, not tokenized.
- `Montserrat`/`Oswald` are loaded but unused except via selector — keep loaded for user choice, but default remains Barlow Condensed.
- NDI badge `display:none` for conns/fps `src/style.css:152` is UI-03 decision — tokens still defined but hidden.

**Generation fidelity check:** N/A — file extraction, not image; compare a recreated button (`padding 10px 18px radius 6px lime on #11170e 700 14px 0.06em`) to screenshot and values match CSS; no browser visual diff needed.

*Generated for YOU-28 (Closes #51) — one design system, one source of truth for all subsequent YOU-29/30/33 and threejs-* phases.*
