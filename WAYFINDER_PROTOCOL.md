# WAYFINDER PROTOCOL — Giir di Mont 3D Broadcast

> **Effective:** 2026-08-28 · **Branch:** `master` is source of truth · **Authority:** this file overrules `.wayfinder/map.closed.md:1` and any untriaged issue body.
> **Audience:** every contributor (human or agent) before touching any ticket from the new map. No code, no branch, no assignment until you have read and complied with this document.

---

## 0. TL;DR — What you MUST do before writing code

1. Read §§1-6 fully. This map is **not** the old 33-ticket `YOU-` list.
2. Do **not** push to `master` or to shared `feat/ndi-50fps` directly.
3. Do **not** pick a ticket that has `needs-triage` or an assignee.
4. Claim = `gh issue edit <num> --add-assignee "@me"` **before** `git checkout -b` — an open+unassigned issue is the frontier.
5. One ticket = one branch `claim/<num>-slug` off `master` = one commit = one PR `Closes #<num>`.
6. Ask yourself: is the issue blocked? If `Dipendenze` lists a parent and that parent is still `OPEN`, skip it.
7. Run `npm run dev:web` verification before PR (see §7).

If you violate 2-4 you will duplicate work. This has already happened (see §2).

---

## 1. Context — what was found on GitHub (verified 2026-08-28)

### 1.1 Three maps in one repo

| Map | Where | Status | Author | When | Scope |
|-----|-------|--------|--------|------|-------|
| **Old Wayfinder** | `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\.wayfinder\map.closed.md:1` + GH `#1 [Wayfinder Map] Giir di Mont 3D - race-day broadcast quality route` | `CLOSED 2026-08-27T15:48:23Z` · label `wayfinder:map` | closed by system | 2026-08-27 | 2 decisions resolved (`#4 DEM upgrade source`, `#5 Vertex budget 256 OK / 512 ceiling`) + 5 open tickets, then closed. Destination was surgical: `crisp checkpoint labels in NDI Program + terrain upgrade decision + 50fps headroom` — *planning only*, not delivery. |
| **Intermediate (YOU)** | GH `#57 [WAYFINDER] Giir di Mont 3D — Complete roadmap (33 tickets across 7 phases)` + issues `#23-#56` (`YOU-01`..`YOU-33`, minus `#26` missing) | `OPEN` · `labels:[]` on #57, no `wayfinder:map` | `LucaBert00` | `2026-08-27 15:57-16:30Z` (33 tickets in 33 min) | Translation of `.wayfinder/map.closed.md:79` phases into executable `YOU-` tickets. 7 phases: NDI Performance (7), Camera (4), Lower-Thirds (4), Mini-Map (3), Atmosphere (5), Hardware/Data (4), Design/QA (6). |
| **New contributor map — NOW PRIORITY** | GH `#58-#97` (40 tickets) prefixes `PERF/UI/RACE/CAM/PROG/TRANS/MAP` | `OPEN` · `labels: ["wayfinder:task","needs-triage"]` · `assignees:[]` all 40 | `Teooo06` | `2026-08-28 12:48:13Z - 12:52:28Z` — 40 tickets in **4 minutes** (script bulk) | Superset of YOU: finer slices, Italian `Obiettivo/Acceptance/Dipendenze`, adds `PERF-02 readPixels Opt`, `PROG bicolore`, `TRANS NDI-only`, `RACE splits`, `MAP DEM/texture/persistence`. **This map has priority over old one per maintainer decision.** |

### 1.2 Git branch truth (2026-08-28 `git fetch origin --prune`)

```
master                 da932fc  [origin/master]  merge: NDI fix documentation + previous fixes
feat/ndi-50fps         bf8dd43  [origin/feat/ndi-50fps]  6 commits ahead of master
feat/vertex-budget-5   ceff04e  [origin/feat/vertex-budget-5]
DevTeooo               e6ef653  [origin/DevTeooo]  (lagging master)
dev-work               (new)    [origin/dev-work]
```

`feat/ndi-50fps` history (chronological):

```
bf8dd43 feat(live): POST /timing webhook → WS broadcast (YOU-27)              — server/ndi-service.js + ws
ccec9f5 feat(data): CSV import button in /impostazioni — bulk upsert (YOU-26) — impostazioni.html + race-manager.js
1789a00 feat(input): gamepad API — left orbit / right zoom / D-pad (YOU-24)   — src/main.js:34 lines
c0dc2ab fix(3d): terrain adherence for GPX track — DEM+offset clamp (YOU-22)  — src/main.js / terrain-manager.js
b8a2578 feat(cam): ease orbit damping 0.08->0.02 during scene tween (YOU-11)   — src/main.js
c325e8d feat(cam): dead-zone + 18m look-ahead for runner follow (YOU-10)      — src/main.js
a0f7d42 feat(cam): cinematic 1.8s tween for scene 1-5 — easeInOutCubic lerp   — src/main.js
26f47b3 perf(ndi): NDI-1 sustained 50fps — shadow 1024, tube 400, trees 800   — ndi-streamer.js + main.js
```

`master` is **behind** `feat/ndi-50fps` by those 6. No PR merges them — they live only on the feature branch. Any work branched from `master` without merging `feat/ndi-50fps` first will **re-implement** them.

### 1.3 Reference docs (local)

- `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\TODO.md:1` — DevTeooo 6-point list, `NDI-1 checkpoint in NDI ✅ FATTO (07d54f0)` with `createCheckpointLabelSprite()` CanvasTexture 512×160 + `THREE.Sprite` layer 1, `camera.layers 0` / `programCamera 0+1`.
- `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\STATO_PROGETTO_E_LOG.md:1` — snapshot 2026-08-26: terrain DEM SRTM 256×256, 1400 trees, 10 checkpoints, `/impostazioni` BroadcastChannel sync, NDI `GIIR-3D-PROGRAM` 1080p50, Tally/FPS HUD.
- `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\SPECIFICHE_PROGRAMMA.md:5` — system arch diagram (Operator Mac → Vite :5173 → WS :9998 → `grandi` NDI 6.3 → LAN → vMix), 5 future bullets that new map expands.
- `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\package.json:6` — scripts `dev` = `concurrently vite --host + node server/ndi-service.js`.

---

## 2. Direction check — does the new map go the right way?

**Alignment: YES.** New 40 tickets faithfully explode `SPECIFICHE_PROGRAMMA.md:99` "Idee e Sviluppi Futuri" + `STATO_PROGETTO_E_LOG.md:68` roadmap (camera splines, lower-thirds, atmosphere, mini-map, hardware, CSV/webhook) into executable steps. That explosion is the *intent* of the contributor bulk.

**Gap — missing Destination:** No master issue states `## Destination` for the 40. `#57` says `Complete roadmap (33 tickets)` — not a decision boundary. Per `wayfinder/SKILL.md:32` `## The Map` + `§ Invocation: Name the destination`, every session orients to Destination first (scope gate + fog boundary). Without it scope is unbounded and `Not yet specified` vs `Out of scope` cannot be judged.

> **Required Destination (adopt this line as map header, see §6.1):**
> `From current master to race-day-ready broadcast: stable 1080p50 NDI `GIIR-3D-PROGRAM` on MacBook Air M2, operator can drive full 32km in simulated or live-timing mode, checkpoints/GPX visually correct, scene transitions NDI-clean, then map is done.`

**Planning vs delivery confusion:** Old map was `Plan, don't do` (`wayfinder/SKILL.md:12`). New map smuggles execution into the map (40 `wayfinder:task` only — zero `research/prototype/grilling`). That is allowed **only** if `Notes` declares `this map carries execution`. Otherwise tickets that need a HITL grill (e.g. lower-third design, fog shader choice) become AFK assumptions.

**Fog prematurely sliced:** Old map kept `Camera transitions / Lower-thirds / Atmosphere / Mini-map / Hardware` in `## Not yet specified` fog (`map.closed.md:50`). New map tickets them before the blocking decisions cleared — violates `wayfinder/SKILL.md:90` `Fog or ticket?` test ("sharp question → ticket, vague → fog"). Acceptable, but expect new fog to graduate as `RACE/CAM/TRANS` resolve.

**Direction verdict: headed correctly along SPEC, but Destination sentence + execution-mode declaration are mandatory before coding.**

---

## 3. Wellness audit — why the map is not yet healthy

| # | Wayfinder rule | New map (`#58-#97`) | Severity | Must fix before coding |
|---|----------------|---------------------|----------|------------------------|
| W1 | Canonical map `wayfinder:map` label · `wayfinder/SKILL.md:21` | None. `#1` had it (closed), `#57` has `labels:[]`, none of `#58-97` has it | 🔴 blocker | §6.1 |
| W2 | Tickets are **child issues** of map | 40 issues are orphaned — not linked as GitHub Sub-issues to `#57`, no `Parent #57` reference | 🔴 | §6.2 |
| W3 | Blocking uses **native** dependency (renders frontier visually) · `wayfinder/SKILL.md:69` | Dependencies are **text only** `Dipendenze: - PERF-01` in body (`gh issue view 59 --json body`), zero `gh` Blocked-by edges → GitHub shows 40 all takeable | 🔴 | §6.2 — 15 edges listed |
| W4 | Claim = assignment · `wayfinder/SKILL.md:66` | All 40 `assignees:[]` (correct for frontier, but no protocol) — with 80 OPEN (+ 33 YOU) collision is certain | 🔴 | §6.3 |
| W5 | Labels `wayfinder:task/research/prototype/grilling` · `wayfinder/SKILL.md:65` | 40/40 `wayfinder:task`+`needs-triage`. Zero `research/prototype/grilling` — design choices hidden as AFK assumptions | 🟠 | §6.5 — triage |
| W6 | `needs-triage` must be triaged to `ready-for-agent` / `ready-for-human` | 40/40 still `needs-triage` | 🟠 | §6.5 |
| W7 | `## Decisions so far` index (one-line gist + link) | Absent for new map | 🟠 | §6.1 |
| W8 | `## Not yet specified` (fog) + `## Out of scope` | Absent. Old map ruled out WebGPU/Electron/Cesium (`map.closed.md:97`); new map re-opens `MAP-02` 4096 texture (136 MB both GL contexts at 1024 per old bench `docs/research/vertex-budget.md`) without gate | 🟡 | §6.1 |
| W9 | Sizing: one 100K-token session · `wayfinder/SKILL.md:57` | Most ✅ small (`UI-01` 2 HTML lines `index.html:19`, `UI-02` 1 CSS, `PERF-03` 1 line `sun.shadow.mapSize`). `PERF-02` OffscreenCanvas+Worker and `RACE-03` split interpolation across `src/main.js:753` are larger — okay but note ceiling | 🟡 | annotate with `ponytail:` |
| W10 | Refer by name, not bare IDs · `wayfinder/SKILL.md:18` | Titles readable (`PERF-01: …`) ✅, but `#57` body lists ` #23 [YOU-01]` bare IDs | 🟡 | keep titles |
| W11 | Duplication — two live namespaces covering same ground | 33 YOU + 40 new + `61` legacy = **80 OPEN** — same slices appear twice with different names/acceptance | 🔴 | §4 + §6.4 |

**Result: 🔴 not healthy to start parallel work.** Steps W1-W6 are blocking; do them in one 30-min triage pass (commands in §6).

---

## 4. Deduplication — old YOU vs new contributor tickets

Same code surface appears twice. Do **not** implement both.

| Area | Old YOU (still OPEN) | New contributor (priority, `Teooo06`) | Already on `feat/ndi-50fps` (not on `master`) | Resolution (adopt) |
|------|----------------------|--------------------------------------|-----------------------------------------------|---------------------|
| NDI profile | `YOU-01 #23` | `PERF-01 #58` **duplicate** | `a22923c` bench done, `26f47b3` perf | **Keep `PERF-01`**, close `YOU-01` as `Superseded by #58` |
| readPixels opt | — | `PERF-02 #59` depends `PERF-01` | — | **Keep** — blocked until `PERF-01` proves bottleneck |
| shadow 1024 | `YOU-03 #25 2048→1024` | `PERF-03 #60 512 check` (further) | `26f47b3` already `mapSize 1024` ✅ | **Close `YOU-03`** (done), keep `PERF-03` only if quality fails |
| tube 400 | `YOU-04 #27 800→400` | `PERF-04 #61 300` (further) | `26f47b3 400` ✅ | **Close `YOU-04`**, keep `PERF-04` |
| trees 800 | `YOU-05 #28 1400→800` | `PERF-05 #62 600` (further) | `26f47b3 800` ✅ | **Close `YOU-05`** |
| MSAA 2× | `YOU-06 #29 4→2` | `PERF-06 #63 MSAA 2×` duplicate | `26f47b3 samples 2?` check | **Keep `PERF-06`**, close `YOU-06` |
| preserveDrawingBuffer | `YOU-07 #30` | — | `26f47b3 false` ✅ | **Close `YOU-07`** |
| FPS target | `YOU-02 #24 30fps` | `PERF-08 #65 25/50` **conflict: 30 not broadcast std** | — | **Close `YOU-02`**, keep `PERF-08` (25/50 correct, 30fps dropped in `#65` acceptance) |
| quality presets | — | `PERF-07 #64 High/Balanced/Performance` | — | **Keep** — blocked `← PERF-01` |
| camera look-ahead | `YOU-10 #33 15-20m` | `CAM-01 #79 tangente` + `CAM-03 #81 look-ahead` duplicate | `c325e8d look-ahead` ✅ partial | **Close `YOU-10`**, keep `CAM-01`→`CAM-03` chain |
| damping ease | `YOU-11 #34 0.08→0.02` | — | `b8a2578 lerp` ✅ | **Close `YOU-11`** |
| terrain adherence | `YOU-22 #45 TER-1` | `MAP-01 #94 DEM bordi blu` (separate problem) | `c0dc2ab fix adherence` ✅ | Keep both — different验收 |
| gamepad | `YOU-24 #47` | — | `1789a00 gamepad` ✅ | **Close `YOU-24`** |
| CSV import | `YOU-26 #49` | — | `ccec9f5 CSV` ✅ | **Close `YOU-26`** |
| live webhook | `YOU-27 #50` | — | `bf8dd43 POST /timing` ✅ | **Close `YOU-27`** |
| others `YOU-08/09/12-23/28-33` | 16 untouched | RACE/CAM/PROG/TRANS/MAP superset | — | Keep — new refines them, don't double-close |

**Net effect:** 8 YOU tickets are already done on the *wrong branch*. Either merge `feat/ndi-50fps → master` in one PR or cherry-pick atomically — do not re-implement on `master`.

---

## 5. Ticket catalog (new map, canonical order by dependency)

### PERF (NDI performance) — `src/ndi-streamer.js:147` `readPixels` 8.3 MB × 50 = 415 MB/s is suspect

- `PERF-01 #58` Profilare frame budget — Chrome Performance 10 s + `renderer.info` screenshot — no deps — **FRONTIER**
- `PERF-02 #59` Ottimizzare readPixels — `OffscreenCanvas + Worker` or buffer halve — target <4 ms — deps `PERF-01`
- `PERF-03 #60` Verificare shadow 512 — `sun.shadow.mapSize 512` — deps none
- `PERF-04 #61` Verificare tube segments 300 — `TubeGeometry(...,300,...)` — deps none
- `PERF-05 #62` Verificare trees 600 — `InstancedMesh 600` `ConeGeometry` — deps none
- `PERF-06 #63` Test MSAA 2× — `ndi-streamer.js:47 samples 2` — deps `PERF-01`
- `PERF-07 #64` Modalità qualità configurabile — presets High/Balanced — deps `PERF-01`
- `PERF-08 #65` Target FPS selezionabile 25/50 — NDI cfg in `/impostazioni` — deps none

### UI (operator UX) — `index.html:19-22` `.brand` , `src/main.js:318-324` `.label`, `src/main.js:844-846` `zoomScale`

- `UI-01 #66` Rimuovere brand `GIIR DI MONT` — delete `section.brand.hud` — **FRONTIER**
- `UI-02 #67` Spostare nav tabs left 24 px — CSS `.nav-tabs left 50%→24px` — deps `UI-01`
- `UI-03 #68` Ridurre NDI status bar — keep source+tally only — **FRONTIER**
- `UI-04 #69` Rimuovere HTML `.label` checkpoint — delete `add3DCheckpoint div.label` — **FRONTIER**
- `UI-05 #70` Aggiustare zoomScale per sprite — match `createCheckpointLabelSprite 80×25` — deps `UI-04`
- `UI-06 #71` Legenda shortcut in `/impostazioni` — list 1-4/C/N/M/D/Space — **FRONTIER**
- `UI-07 #72` Clean View trasparenza graduata — `body.clean opacity 0.15/0.3` — **FRONTIER**

### RACE (simulation) — `src/race-manager.js` `defaultSplits2025`, `src/main.js:753` `ath.km += dt*0.08`

- `RACE-01 #73` Dati splits 2025 Magnini 03:14:04 — `defaultSplits2025` 10 CP — **FRONTIER**
- `RACE-02 #74` Selettore velocità /impostazioni — Real-Time / 10×-100× slider → `localStorage` — **FRONTIER**
- `RACE-03 #75` Interpolazione splits — replace linear `ath.km` with segment `elapsedSec` lerp — deps `RACE-01,RACE-02`
- `RACE-04 #76` Velocità variabile salita/discesa — incline factor — deps `RACE-03`
- `RACE-05 #77` Pausa + riavvolgimento — Space + `athlete-km-slider` — deps `RACE-03`
- `RACE-06 #78` UI tempi dettagliati — `updateRiderCard()` elapsed/remaining/pace/% — deps `RACE-03`

### CAM (camera) — `src/main.js: frame()` `routeCurve.getTangentAt(ratio)` `controls.dampingFactor`

- `CAM-01 #79` Camera follow con offset tangente — `tangent*-dist + up*height` lerp — **FRONTIER**
- `CAM-02 #80` Raycast collision — raycast down, lateral nudge 15 m — deps `CAM-01`
- `CAM-03 #81` Look-ahead 15-20 m — target ahead on tangent — deps `CAM-01`
- `CAM-04 #82` Altezza adattiva a pendenza — `Δele` between verts — deps `CAM-01`
- `CAM-05 #83` Preset inquadratura — Close/Wide/Helicopter + `Shift+1/2/3` — deps `CAM-01`
- `CAM-06 #84` Transizione fluida presets — lerp 1.8 s — deps `CAM-05`

### PROG (progress) — `src/main.js:263` `rebuildTrack3D()` `TubeGeometry`, leader sphere

- `PROG-01 #85` Tube bicolore — 2 `TubeGeometry` accent vs gray 50% split at `ratio` — **FRONTIER**
- `PROG-02 #86` Aggiornamento dinamico progresso — every frame/5 — deps `PROG-01`
- `PROG-03 #87` Rimuovere indicatore leader grande — delete large sphere+bib — **FRONTIER**
- `PROG-04 #88` Checkpoint marker lungo traccia — 10 small spheres `r=1.0` — deps `PROG-01`

### TRANS (NDI scene transitions) — `src/main.js: setScene()` `a0f7d42` 1.8s `easeInOutCubic` already on branch

- `TRANS-01 #89` Transizione solo NDI — tween moves `programCamera` only, browser holds — **FRONTIER**
- `TRANS-02 #90` Coda transizioni — queue, never interrupt — deps `TRANS-01`
- `TRANS-03 #91` Durata variabile per coppia — 2.5 s overview→runner, 1.5 s etc. — deps `TRANS-01`
- `TRANS-04 #92` Indicatore browser `Transizione in corso…` above elevation profile — deps `TRANS-01`
- `TRANS-05 #93` Tally TRANSIZIONE yellow vs ON-PROGRAM red — deps `TRANS-01`

### MAP (terrain/data) — `public/data/terrain-premana.json` 256×256 SRTM `scale 0.1`, `src/terrain-manager.js:88`

- `MAP-01 #94` Estendere DEM evitare bordi blu — enlarge bbox or fog — **FRONTIER**
- `MAP-02 #95` Texture satellite higher-res per NDI — 4096 NDI / 2048 browser — **FRONTIER**
- `MAP-03 #96` Persistenza configurazione — `localStorage` all prefs — **FRONTIER**
- `MAP-04 #97` Export/Import configurazione JSON — `Esporta/Importa Config` buttons — deps `MAP-03`

> Frontiers above = open + unassigned + unblocked when native edges are wired. Until W3 is fixed, GitHub shows *all* as unblocked — use the `deps` column above as source of truth.

---

## 6. Mandatory pre-development checklist — do these before any ticket branch

Perform **in order**, one commit per bullet, on `master`. Until green, no ticket work.

### 6.1 Canonical map fix (W1, W7, W8)

Update `#57` (or create `#98`) to skill template:

```markdown
## Destination

From current master to race-day-ready broadcast: stable 1080p50 NDI `GIIR-3D-PROGRAM` on MacBook Air M2, operator can drive full 32km in simulated or live-timing mode, checkpoints/GPX visually correct, scene transitions NDI-clean, then map is done.

## Notes

- Domain: Three.js WebGL2 + NDI 6.3 `grandi` bridge 1080p50 on dedicated offscreen renderer `src/ndi-streamer.js:34`, browser preview + `/impostazioni` sync via `BroadcastChannel('giir_sync_channel')` `src/main.js:107`.
- Terrain: `public/data/terrain-premana.json` 256×256 SRTM 1" (~30m/post) `scale 0.1` in `src/terrain-manager.js`; styles satellite/stylized/dark. Bench `docs/research/vertex-budget.md`: 256 OK, 512 ceiling, 1024 needs LOD.
- Convention: ponytail — shortest working diff, one runnable check per non-trivial change, `ponytail:` comments on ceilings.
- Skills to consult per phase: `threejs-geometry` (track/trees), `threejs-shaders` (fog/godrays), `threejs-textures` (satellite), `vite` (build).
- Execution mode: this map **carries execution** (40 task tickets) — decisions recorded in issue close comments, no separate spec phase.

## Decisions so far

- #4 DEM upgrade source — SRTM GL1 30m via OpenTopography → 512 resample; Lombardy DTM deferred. `docs/research/dem-upgrade.md`. (closed 2026-08-26)
- #5 Vertex budget — 256 OK / 512 OK / 1024 LOD. Bench `bench-vertex-budget.mjs`. (closed 2026-08-27)
- bf8dd43 POST /timing webhook → WS `timing_update` (YOU-27) — `server/ndi-service.js` + `src/main.js`.
- ccec9f5 CSV import in /impostazioni (YOU-26) — `src/race-manager.js`.
- 1789a00 Gamepad API (YOU-24) — `navigator.getGamepads()` poll in `frame()`.
- c0dc2ab GPX terrain adherence (YOU-22) — DEM clamp.
- b8a2578/ c325e8d / a0f7d42 cinematic tween + look-ahead + damping (YOU-10/11/08).

## Not yet specified

- Lower-thirds layout choice (HTML overlay vs Sprite layer 1) — pending `PROG-01` track decision.
- Volumetric fog shader shape — pending terrain style final (`MAP-02`).
- Mini-map ortho vs Canvas2D — pending perf headroom (`PERF-01`).

## Out of scope

- Full WebGPU migration — buys nothing at 65k verts; reopen only if 512 DEM fails 50fps on WebGL2.
- Electron packaging (`electron` dep unused).
- Cesium / globe engine replacement.
- 4096 texture beyond `MAP-02` experiment — deferred if PERF shows VRAM issue.
```

Commands:

```powershell
gh issue edit 57 --add-label "wayfinder:map" --remove-label "needs-triage"
# paste body above via: gh issue edit 57 --body-file .wayfinder/map.new.md
```

If maintainer prefers, create fresh `#98` with `wayfinder:map` and close `#57` as duplicate — either satisfies W1.

### 6.2 Wire blocking edges natively (W2, W3)

Use GitHub Sub-issues + `Blocked by` (Tasks UI) so frontier renders visually. The 15 edges that match `Dipendenze` in ticket bodies:

```
#59 ← #58
#63 ← #58
#64 ← #58
#70 ← #69
#84 ← #83
#80 ← #79
#81 ← #79
#82 ← #79
#83 ← #79
#86 ← #85
#88 ← #85
#90 ← #89
#91 ← #89
#92 ← #89
#93 ← #89
#97 ← #96
#75 ← #73 and #74
#76 ← #75
#77 ← #75
#78 ← #75
#67 ← #66
```

Manual: GitHub issue → `Blocked by #<num>` → Add. Script: `gh issue edit <child> --body "$(gh issue view <child> --json body --jq .body)\n\nBlocked by #<parent>"` then add Sub-issue relation `gh api repos/Teooo06/giir-di-mont-3d/issues/57/sub_issues --method POST --field sub_issue_id=<child>` if using sub-issues preview.

After this, `gh issue list --state open --json number,title,state,labels | where labels contains wayfinder:task and blocked=false and assignees=[]` equals frontier.

Also add the 40 new tickets as Sub-issues of `#57` in one pass.

### 6.3 Assignment-lock protocol (W4)

- Open + unassigned = takeable. **First action** on any ticket: `gh issue edit <num> --add-assignee "@me"` and comment `Claiming #<num> — branch claim/<num>-slug`. Concurrent sessions must query `gh issue view <num> --json assignees` before claiming — skip if already assigned.
- If you claimed in error, unassign immediately: `gh issue edit <num> --remove-assignee "@me"`.

### 6.4 Deduplicate the two namespaces (W11)

Run once, referencing commits:

```powershell
gh issue close 23 --reason "completed" --comment "Superseded by PERF-01 #58 — same profiling scope. See duplication §4."
gh issue close 24 --comment "Replaced by PERF-08 #65 — 30fps non-standard, 25/50 correct. See §4."
gh issue close 25 --comment "Done in 26f47b3 (shadow 1024). Kept PERF-03 #60 for optional 512 check."
gh issue close 27 --comment "Done in 26f47b3 (tube 400). Kept PERF-04 #61 for 300 check."
gh issue close 28 --comment "Done in 26f47b3 (trees 800). Kept PERF-05 #62."
gh issue close 29 --comment "Duplicate of PERF-06 #63."
gh issue close 30 --comment "Done in 26f47b3 (preserveDrawingBuffer false)."
gh issue close 33 --comment "Partial done c325e8d look-ahead; superseded by CAM-01 #79 → CAM-03 #81."
gh issue close 34 --comment "Done b8a2578 damping lerp."
gh issue close 47 --comment "Done 1789a00 gamepad."
gh issue close 49 --comment "Done ccec9f5 CSV."
gh issue close 50 --comment "Done bf8dd43 POST /timing."
# optional: close #55-#53 etc. if contributor confirms new MAP/UI supersedes design-system tickets — or keep #51-56 as Icebox and link to this doc.
```

Add comment on each kept new ticket: `Supersedes YOU-0x #<old> — see WAYFINDER_PROTOCOL.md §4`.

### 6.5 Triage `needs-triage` (W5, W6)

Apply `ready-for-agent` to the 7 frontier heads (independent):

```powershell
foreach ($n in 58,66,68,69,71,72,73,74,79,85,87,89,94,95,96) { gh issue edit $n --add-label "ready-for-agent" --remove-label "needs-triage" }
```

Mark `PERF-01 #58` additionally `ready-for-human` if profiling needs physical MacBook + NDI Studio Monitor — or keep `ready-for-agent` with manual screenshot step in acceptance.

### 6.6 Merge `feat/ndi-50fps` gap

Choose one:

- **Option A (preferred, one PR):** `git checkout master; git merge origin/feat/ndi-50fps --no-ff -m "merge: feat/ndi-50fps 6 tickets (YOU-10/11/22/24/26/27) — closes #33 #34 #47 #49 #50"`; `git push`; close those YOU issues with `Closed via merge <sha>`.
- **Option B (atomic):** cherry-pick per ticket onto `claim/<num>` branches PR'd individually — slower but maps 1:1 to new tickets.

Do not leave `master` behind `feat/ndi-50fps` while contributors branch from `master`.

### 6.7 After triage, update this doc

Append `## Decisions so far` entries and clear graduated fog entries from `## Not yet specified` on `#57` as each ticket closes. Keep this file as the **human-readable index**; the issue is the tracker-of-record.

---

## 7. Git workflow — branch, commit, PR, merge (exploiting `skills/git-workflow/SKILL.md` `§ PR Preparation` + `§ Branch Cleanup`)

### 7.1 Before any ticket

```powershell
git fetch origin --prune
git checkout master
git pull --ff-only
git status  # must be clean
gh issue view 58 --json assignees,state,labels  # verify unassigned + ready + unblocked
gh issue edit 58 --add-assignee "@me"           # CLAIM
# add comment: gh issue comment 58 --body "Claiming PERF-01 — branch claim/58-perf-profile"
```

### 7.2 Branch + work

```powershell
git checkout -b claim/58-perf-profile
# edit src/ndi-streamer.js, src/main.js, chrome bench
# ONE commit per ticket — descriptive, ponytail-marked if deliberate simplification
git add src/ndi-streamer.js
git commit -m "perf(ndi): PERF-01 profile NDI frame budget (Closes #58)

- Chrome Performance 10s + renderer.info FPS graph
- documented bottleneck: readPixels/share
- ponytail: single-file mark, no worker yet — upgrade only if PERF-02 proves it

Closes #58"
git push -u origin claim/58-perf-profile
```

### 7.3 PR

```powershell
gh pr create --title "PERF-01: profile NDI frame budget (#58)" --body "$(cat <<'EOF'
## Summary
- Profiling per #58 acceptance
- Screenshot + renderer.info analysis

## Changes
- docs/research/perf-ndi-budget.md

## Test plan
- [ ] npm run dev:web — NDI Studio Monitor FPS ≥25 stable
- [ ] screenshot browser vs NDI diff archived

Closes #58

🤖 Generated with WAYFINDER_PROTOCOL.md §7
EOF
)"
gh pr view --web
```

### 7.4 Merge

- Other contributor reviews, approves, **squash or merge-commit** (choose one and keep it). Auto-close via `Closes #58` triggers decision propagation.
- After merge: `git checkout master; git pull; git branch -d claim/58-perf-profile`
- Append one line to `#57` `Decisions so far`: `- #58 PERF-01 — bottleneck is readPixels 3-6ms ... ([link])`

### 7.5 What not to do

- ❌ No direct `git push origin master`.
- ❌ No `claim/*` branched from `feat/ndi-50fps` or `DevTeooo` — branch from `master` only (after §6.6).
- ❌ No PR that closes multiple tickets — one ticket per PR (research tickets may batch per `wayfinder/SKILL.md:105` exception).
- ❌ No `git push --force` to shared `feat/*` without pairing.

### 7.6 Periodic cleanup

```powershell
git checkout master; git pull
git branch --merged master | Select-String -NotMatch "master" | ForEach-Object { git branch -d $_.ToString().Trim() }
git fetch --prune
```

---

## 8. Suggested ownership split (avoids file contention)

`src/main.js` is hotspot (touched by CAM + PROG + RACE + TRANS). Use blocking chains to serialize, and split by vertical to keep PRs independent.

| Owner | Chain (take in order, respect deps) | Files predominantly | Why no clash |
|-------|--------------------------------------|---------------------|--------------|
| **Luca** | `RACE-01 #73 → RACE-02 #74 → RACE-03 #75 → RACE-04 #76 / RACE-05 #77 / RACE-06 #78` then `PROG-01 #85 → PROG-02 #86 → PROG-04 #88` | `src/race-manager.js`, `src/main.js:frame() ath.km`, `elevation-profile.js` | Isolated data/logic, no NDI renderer |
| **Teooo06** | `PERF-01 #58 → PERF-02 #59 → PERF-06 #63 / PERF-07 #64` chain + `UI-01 #66 → UI-02 #67` + `UI-04 #69 → UI-05 #70` + `CAM-01 #79 → CAM-02 #80 / CAM-03 #81 / CAM-04 #82` | `src/ndi-streamer.js`, `server/ndi-service.js`, `src/style.css`, `index.html` | Owns NDI + CSS + camera until `CAM-05/06` |
| Either after frontier clears | `TRANS-01 #89 → TRANS-02 #90 / #91 / #92 / #93` (owns `setScene()` only after `CAM` tween is stable) + `MAP-01 #94 / MAP-02 #95 / MAP-03 #96 → MAP-04 #97` (heavy assets, `ponytail: defer 4096 unless PERF-01 justifies`) | `src/main.js:setScene`, `public/data/terrain-premana.json`, `impostazioni.js` localStorage | Serial behind `TRANS-01`, so one owner at a time |

No two owners touch the same file on same day if you follow deps.

---

## 9. Verification — one runnable check per non-trivial ticket (`ponytail: verification-before-completion`)

- `PERF-*`: `npm run dev:web` + `npm run dev:ndi` + NDI Studio Monitor — FPS graph screenshot in PR.
- `UI-*`: `npm run dev:web` — visual diff screenshot browser vs NDI frame (`#ndi-frame` overlay).
- `RACE-*`: `npm run dev` — slider/space/tempo display; `BroadcastChannel` sync check `/` vs `/impostazioni`.
- `CAM-*`: `npm run dev` — `runner` follow orbit smoothness, no terrain clip (`raycast` 15 m).
- `PROG-*`: `npm run dev` — bicolore split at leader `ratio` visible in 3D + NDI.
- `TRANS-*`: `npm run dev:ndi` — tally indicator + browser `Transizione in corso…`, queue no-interrupt.
- `MAP-*`: `npm run dev` — no blue border at overview, texture swap verifiable.

Trivial 1-2-line CSS/HTML (`UI-01/02/03`) need no automated test — screenshot suffices per `wayfinder/SKILL.md` ponytail convention.

---

## 10. References — where every fact came from

- Map bodies: `gh issue view 1 --json body`, `gh issue view 57 --json body`, `gh issue view 58 --json body` etc. (`--jq .body` for `Dipendenze`).
- Counts: `gh issue list --state open --json number,title,labels | ConvertTo-Json` → 80 OPEN (`wayfinder:task` 40 new + 40 YOU/legacy).
- Authors/dates: `gh api repos/Teooo06/giir-di-mont-3d/issues --jq {number,user.login,created_at}` — `LucaBert00` 2026-08-27 15:4x-16:30, `Teooo06` 2026-08-28 12:48:13-12:52:28.
- Branches/commits: `git branch -a`, `git log --all --oneline --graph -25`, `git show bf8dd43/ccec9f5/1789a00 --stat`.
- Local docs: `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\TODO.md:6`, `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\STATO_PROGETTO_E_LOG.md:1`, `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\SPECIFICHE_PROGRAMMA.md:5`, `C:\Users\matte\Documents\LUCA\RANDOM\giir-di-mont-3d\package.json:6`.
- Skills consulted: `C:\Users\matte\.agents\skills\19-wayfinder\wayfinder\SKILL.md` (Destination, Map body, Tickets, Fog, Out of scope, Invocation, Claim = assignment `§ Tickets`); `skills/git-workflow/SKILL.md` (`§ PR Preparation`, `§ Branch Cleanup`); implicitly `skills/verification-before-completion` and `skills/ponytail/SKILL.md` (shortest diff, `ponytail:` ceiling comments).

---

## 11. What changes, what is kept

- **Kept:** `SPECIFICHE_PROGRAMMA.md:99` 6-bullet roadmap direction; `STATO_PROGETTO_E_LOG.md:68` log; DEM SRTM 256 + bench decisions (`Wayfinder #4/#5`); ponytail shortest-diff convention.
- **Superseded by this protocol:** any `Dipendenze` text-only boundary — replaced by native `Blocked by` (§6.2); `30fps` target in `YOU-02 #24` — replaced by `25/50` in `PERF-08 #65`; bare-ID references in `#57` body; arco rotation #147 (sostituito da #159); tracciato spezzato #146 (sostituito da #161); qualità NDI #149 (sostituito da #162).
- **Add when needed:** full `pre-commit` hooks, `Lighthouse` perf suite, `OffscreenCanvas` worker — only if `PERF-01` proves required.

---

## 12. Immediate next action

1. Maintainer executes §6.1-6.6 triage in one sitting on `master` (estimate 20 commits + 15 edge adds + 10 closes).
2. Then each contributor claims **one** frontier ticket (suggest `Teooo06 → PERF-01 #58`, `Luca → RACE-01 #73` or `UI-01 #66`) and works through §7.
3. After each close, graduate fog: `PERF-01` → reveal `PERF-02` shape; `CAM-01` → reveal `CAM-02..06`; etc.

> **Rule while this map is live:** One ticket at a time. Finish → verify → commit → PR → merge → next. No parallel tickets touching the same file. See `wayfinder/SKILL.md:105` `never resolve more than one ticket per session`.

---

## 13. User-requested changes (fix/user-changes — 2026-08-30)

Modifiche richieste direttamente dall'operatore, implementate su branch `fix/user-changes`.

| Modifica | File | Issue |
|----------|------|-------|
| Arco Bocchetta Larec rotation | `main.js:409`, `arch.js` | #159 |
| Sfere checkpoint dimezzate | `main.js:310,319` | #160 |
| Tracciato GPX fluido | `main.js:405-407,429,472-474` | #161 |
| Qualità NDI soft shadow + exposure | `src/ndi-streamer.js:68-70` | #162 |
| Toggle camera auto/manual (tasto F) | `main.js:530-531,1095-1145` | #163 |
| Marker progresso + custom GPX | `main.js:210-238,1093`, `impostazioni.html`, `impostazioni.js` | #164, #165 |

> **Rule while this map is live:** One ticket at a time. Finish → verify → commit → PR → merge → next. No parallel tickets touching the same file. See `wayfinder/SKILL.md:105` `never resolve more than one ticket per session`.

---

*Generated 2026-08-28 by wayfinder audit of 80 open issues + local map + branch history. Push this file to `master` — it is the gate before development on the new map.*
