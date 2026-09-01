# Wayfinder Map — Giir di Mont 3D Broadcast
**Branch:** `claim/56-visual-regression` → `master` | **Last sync:** 2026-09-01 — YOU-33 visual regression 10 states done

---

## 🎯 Current State Snapshot

| Layer | Status | Notes |
|-------|--------|-------|
| **Terrain 3D (DEM SRTM)** | ✅ Done | Satellite HD / Stylized / Dark Minimal styles |
| **GPX Track + 10 Checkpoints** | ✅ Done | Catmull-Rom spline, smart Partenza/Arrivo toggle |
| **1,400 Alpine Trees (InstancedMesh)** | ✅ Done | ConeGeometry, elevation-filtered |
| **Race Manager (athletes, splits, state)** | ✅ Done | localStorage + BroadcastChannel sync |
| **Settings Dashboard (/impostazioni)** | ✅ Done | Theme, font, exaggeration, NDI config |
| **NDI 1080p50 Output** | ⚠️ **Partial** | Dedicated renderer, MSAA 4×, SRGB — ~17 FPS (target 50) |
| **Checkpoint Labels in NDI** | ✅ Done (07d54f0) | THREE.Sprite + CanvasTexture on layer 1 |
| **Camera Presets (5 scenes)** | ✅ Done | Keyboard 1-5, orbit controls |
| **Elevation Profile** | ✅ Done | SVG, synced to athlete position |
| **Visual Regression (YOU-33)** | ✅ Done (claim/56) | Playwright 10 states, CI, <60s, committed baselines |

---

## 📋 Missing / Incomplete from TODO & SPECIFICHE

| ID | Item | Source | Effort | Blocker |
|----|------|--------|--------|---------|
| **NDI-1** | NDI 50 FPS sustained | TODO#6, SPEC#99 | High | Double render + readPixels bottleneck |
| **NDI-2** | Verify NDI quality (screenshot diff) | TODO#1, TODO#2 | Low | Needs physical NDI monitor test |
| **CAM-1** | Cinematic camera transitions (Bezier/lerp) | SPEC#100, TODO#1 | Med | — |
| **CAM-2** | Auto-follow smoothing (dead-zone, look-ahead) | main.js:747 | Low | — |
| **GFX-1** | Broadcast lower-thirds (flag, photo, gap, pace) | SPEC#105, TODO#2 | High | New overlay system needed |
| **GFX-2** | Mini-map 2D PIP with athlete dots | SPEC#107, TODO#4 | Med | Canvas 2D or Three.js ortho |
| **ATM-1** | Volumetric fog / clouds / God Rays | SPEC#103, TODO#3 | High | Post-processing / custom shaders |
| **ATM-2** | Dynamic weather (time-of-day, cloud cover) | SPEC#103 | Med | ✅ Done (claim/14) — 4 presets + 5s lerp |
| **YOU-33** | Visual regression test suite (10 states) | Phase 7 QA | Low | ✅ Done (claim/56) — Playwright + pixelmatch, CI, <60s |
| **HW-1** | Stream Deck / MIDI / Gamepad input | SPEC#109, TODO#5 | Med | WebHID / WebMIDI API |
| **DATA-1** | CSV import / live timing webhook | SPEC#111, TODO#6 | Low | Backend endpoint or local parse |
| **TER-1** | Fix GPX sinking into terrain | TODO#3 | Med | Raycast elevation per vertex |
| **TER-2** | Recalibrate checkpoint lat/lon from GPX | TODO#3 | Low | Manual verification needed |
| **TER-3** | Add landmarks (rifugi, croci, baite) | TODO#4 | Med | New InstancedMesh or GLTF loader |
| **UI-1** | Zoom-adaptive scaling for all 3D markers | TODO#5 (partial) | Low | routeLine, treesMesh not scaled |
| **UI-2** | Clean view polish (hide all HUD cleanly) | main.js:465 | Low | Some elements persist |
| **PERF-1** | Profile & optimize render loop | TODO#6 | High | Chrome DevTools / renderer.info |

---

## ⚡ Optimization Opportunities (Ponytail Lens)

| Area | Current | Target | Quick Win |
|------|---------|--------|-----------|
| **NDI FPS** | ~17 | 50 | Drop to 30 FPS, reduce shadowMap to 1024, tube segments 400, trees 800 |
| **readPixels** | 8.3 MB × 50 = 415 MB/s | — | Use `OffscreenCanvas` + Web Worker; or `requestVideoFrameCallback` |
| **Double Render** | Browser + NDI each frame | Single | Render once to renderTarget, blit to both (but breaks layer separation) |
| **Shadow Map** | 2048² PCFSoft | 1024² PCF | `sun.shadow.mapSize.set(1024, 1024)` |
| **Tree Count** | 1,400 instances | 800 | LOD: far = billboard sprite |
| **Tube Segments** | 800 | 400 | Visual diff negligible |
| **MSAA** | 4× (NDI renderer) | 2× or off | `samples: 2` |
| **preserveDrawingBuffer** | true (both) | false | Only needed for readPixels — NDI canvas can keep it |
| **GPU Timing** | None | `renderer.info` + `performance.mark` | Add perf overlay |

---

## 🎨 UI/UX Upgrade Candidates (with Skills)

| Upgrade | Skill to Use | Description |
|---------|-------------|-------------|
| **Design System Extraction** | `design-system` | Reverse-engineer current CSS → DESIGN.md tokens |
| **High-End Visual Polish** | `high-end-visual-design` / `impeccable` | Elevate HUD, panels, typography to broadcast-grade |
| **Hallmark Audit** | `hallmark` | Full design audit → specific fixes |
| **Responsive Check** | `responsiveness-check` | Test HUD at 1920×1080, 2560×1440, 3840×2160 |
| **GSAP Motion** | `gpt-taste` | Cinematic camera tweens, lower-third animations |
| **Industrial Brutalist** | `industrial-brutalist-ui` | Alternative "mission control" skin |
| **Minimalist UI** | `minimalist-ui` | Clean operator mode |
| **Color Palette from Brand** | `color-palette` | Generate full 11-shade scale from `#dff654` |
| **Icon Set** | `icon-set-generator` | Custom SVG icons for checkpoints, athletes, weather |
| **Frontend Test/Debug** | `frontend-testing-debugging` | Automated visual regression on HUD |

---

## 🗺️ Next Wayfinder Map — YOUR TICKETS ONLY

> These tickets are **assigned to you** (human). No agent will pick them up.  
> Each ticket = one commit + verification. Work top-to-bottom.

---

### 🔴 PHASE 1 — NDI PERFORMANCE (Critical Path)

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-01** | Profile NDI frame budget | Open Chrome DevTools → Performance → record 10s → screenshot `renderer.info` + FPS graph |
| **YOU-02** | Reduce NDI target to 30 FPS | `ndiStreamer.setFps(30)` in settings; verify stability on MacBook Air M2 |
| **YOU-03** | Shadow map 2048 → 1024 | `sun.shadow.mapSize.set(1024, 1024)`; check visual diff |
| **YOU-04** | TubeGeometry 800 → 400 segments | `rebuildTrack3D()`; verify track smoothness |
| **YOU-05** | Trees 1400 → 800 instances | `generateAlpineForest()`; add LOD billboard for far trees (optional) |
| **YOU-06** | MSAA 4× → 2× on NDI renderer | `samples: 2` in `ndi-streamer.js:47`; verify aliasing |
| **YOU-07** | Remove `preserveDrawingBuffer` from browser renderer | `preserveDrawingBuffer: false` in `main.js:37`; confirm NDI still works |

---

### 🟠 PHASE 2 — CAMERA & CINEMATICS

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-08** | Implement `CameraSpline` class | `catmullRom` or `bezier` between scene positions; `duration` param |
| **YOU-09** | Wire scene buttons to spline transition | Press 1→3 = smooth 2s flight, not instant jump |
| **YOU-10** | Add "look-ahead" to runner follow | Camera leads athlete by 15-20m on curves |
| **YOU-11** | Auto-ease orbit damping on scene change | `controls.dampingFactor` lerp 0.08 → 0.02 during transition |

---

### 🟡 PHASE 3 — BROADCAST GRAPHICS (Lower-Thirds)

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-12** | Design lower-third layout (Figma/sketch) | Flag, photo, name, country, gap, pace — 16:9 safe area |
| **YOU-13** | Build `LowerThird` class (Three.js Sprite + CanvasTexture) | Layer 1 (NDI) + HTML overlay (browser), synced |
| **YOU-14** | Auto-show on athlete select / checkpoint cross | Trigger from `raceManager` events |
| **YOU-15** | GSAP animate in/out (slide + fade) | `gpt-taste` / `gsap` — 300ms easeOut |

---

### 🟢 PHASE 4 — MINI-MAP PIP

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-16** | Add orthographic camera + renderTarget (200×200) | Top-right corner, shows full track + athlete dots |
| **YOU-17** | Sync athlete positions from `raceManager` | Update every frame or 100ms |
| **YOU-18** | Toggle with key `M` | Hide/show, persists in settings |

---

### 🔵 PHASE 5 — ATMOSPHERE & POLISH

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-19** | Add volumetric fog shader (valley mist) | `threejs-shaders` — noise-based, altitude-dependent |
| **YOU-20** | God Rays (volumetric light scattering) | Post-process or custom material on sun shaft |
| **YOU-21** | Landmarks: 3 rifugi + 2 croci di vetta | `InstancedMesh` with GLTF or simple geometry |
| **YOU-22** | Fix GPX terrain adherence (raycast per vertex) | `getElevationAtWorld` + offset on `rebuildTrack3D` |
| **YOU-23** | Recalibrate 10 checkpoints from GPX | Visual verify each in satellite view |

---

### 🟣 PHASE 6 — HARDWARE & DATA

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-24** | Gamepad API: left stick = orbit, right = zoom, D-pad = scenes | `navigator.getGamepads()` polling in frame loop |
| **YOU-25** | Stream Deck: HTTP POST to local endpoint → scene change | Simple Express server or `node-http-server` |
| **YOU-26** | CSV import button in `/impostazioni` | Parse → populate athletes + splits |
| **YOU-27** | Live timing webhook endpoint (POST /timing) | Updates athlete km/gap/splits in real-time |

---

### ⚪ PHASE 7 — DESIGN SYSTEM & QA

| Ticket | Title | Acceptance |
|--------|-------|------------|
| **YOU-28** | Run `design-system` skill → extract DESIGN.md | Tokens: colors, spacing, typography, shadows |
| **YOU-29** | Run `hallmark` audit → fix top 5 findings | Screenshots before/after |
| **YOU-30** | Run `responsiveness-check` at 3 breakpoints | No layout break, HUD readable |
| **YOU-31** | Generate color palette from `#dff654` | `color-palette` → Tailwind config |
| **YOU-32** | Create icon set for UI | `icon-set-generator` → 20+ SVG icons |
| **YOU-33** | Visual regression test suite | `frontend-testing-debugging` — 10 key states | ✅ Done (claim/56) — 10 screenshots, Playwright, CI |

---

## 📦 How to Use This Map

1. **Pick one ticket** (start with YOU-01)
2. **Do the work** — one commit, descriptive message
3. **Verify** — `npm run dev` + NDI Studio Monitor / vMix
4. **Check off** — update this file, commit
5. **Next ticket**

> **Rule:** No parallel tickets. One at a time. Finish → verify → commit → next.

---

## 🔗 References

- `README.md` — Architecture & quick start
- `SPECIFICHE_PROGRAMMA.md` — Full spec & future ideas
- `TODO.md` — DevTeooo working list (source of truth)
- `STATO_PROGETTO_E_LOG.md` — Daily log & roadmap
- `.wayfinder/map.md` — **This file**

---

*Generated by wayfinder analysis. Only you (human) can take these tickets.*