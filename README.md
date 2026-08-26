# Giir di Mont — 3D Broadcast per Diretta (32km · 3800m D+)

Visualizzatore 3D broadcast in tempo reale per la diretta del **Giir di Mont** a Premana. Terreno reale da DEM SRTM, tracciato GPX, checkpoint e atleti, con uscita video **NDI 1080p50** pulita (`GIIR-3D-PROGRAM`) verso vMix / OBS / TriCaster su rete locale.

> Repo: branch `fix/ndi-quality` (NDI fixes in corso) + `master` stabile. Vedi [Istruzioni precise](#istruzioni-precise) e [TODO](#todo--prossime-modifiche).

---

## Requisiti

- **Node.js ≥18** (testato su 20+)
- **macOS / Windows / Linux** con GPU WebGL2
- **NDI SDK 6.3** via `grandi` (Apple Silicon / x64) — installato con `npm install`
- Rete locale Gigabit per NDI

---

## Installazione

```bash
git clone <repo-url>
cd "Percorso 3D"
npm install
```

---

## Istruzioni precise — Avvio

### Dev (consigliato: Vite + NDI insieme)
```bash
npm run dev
```
- Vite dev server `:5173` (`--host` quindi visibile in LAN)
- NDI bridge `ws://localhost:9998` → NDI `GIIR-3D-PROGRAM`

Apri:
- **Vista 3D Live (Program):** http://localhost:5173
- **Dashboard Impostazioni & Gara:** http://localhost:5173/impostazioni

Sulla regia (vMix / OBS / NDI Studio Monitor) seleziona sorgente **`GIIR-3D-PROGRAM`** (1080p50). Anche senza browser aperto vedi un frame di standby.

### Solo web (senza NDI)
```bash
npm run dev:web
```

### Solo NDI bridge
```bash
npm run dev:ndi
# opzionalmente: NDI_NAME="MIO-NOME" NDI_WS_PORT=9998 node server/ndi-service.js
```

### Build produzione
```bash
npm run build   # output in dist/
npm run preview # preview build
```

### Tasti rapidi vista 3D
- `1` Panoramica Valle · `2` Insegui Leader (drone) · `3` Bocchetta Larec · `4` Pizzo Alto · `5` Zenith
- `Spazio` Play/Pausa simulazione · `C` Clean view (nasconde HUD) · `N` Toggle riquadro NDI 16:9
- Trascina / Rotella = orbita / zoom

---

## Architettura

```
[Operatore Mac]
 ├─ /  (Three.js viewport + HUD) ─┐
 ├─ /impostazioni (dashboard) ─────┤─► BroadcastChannel + localStorage (sync live)
 └─ NdiStreamer (canvas hidden 1920x1080, renderer NDI dedicato) ─► ws://:9998 ─► NDI SDK 6.3 ─► LAN ─► vMix/OBS
```

- **Browser:** due pagine Vite (`vite.config.js:6` multi-page). Sincronia via `BroadcastChannel('giir_sync_channel')` (`src/main.js:107`).
- **NDI:** `src/ndi-streamer.js:3` crea un `WebGLRenderer` dedicato su canvas hidden 1920x1080 (pixelRatio 1, `SRGBColorSpace`, `ACESFilmic`) che renderizza la stessa `scene` con `programCamera` (16/9). `captureAndSend` fa `render` → `readPixels` → flip verticale → `ws.send` raw RGBA. Server `server/ndi-service.js:109` riceve via WebSocket e inoltra a NDI (`grandi`).
- **Terreno:** `src/terrain-manager.js:3` da `public/data/terrain-premana.json` + texture `public/textures/premana-satellite.jpg`.
- **Checkpoint:** 10 waypoint in `src/race-manager.js`, renderizzati come sfere `src/main.js:223` + label HTML `.label` `src/main.js:232` (solo browser, non in NDI — vedi TODO).

---

## Struttura

```
index.html, impostazioni.html, vite.config.js, package.json
src/
  main.js               # scena, camera, renderer, loop, NDI, HUD
  ndi-streamer.js       # NDI renderer dedicato + WebSocket
  terrain-manager.js    # DEM → PlaneGeometry + stili satellite/stylized/dark
  race-manager.js       # atleti, checkpoint, splits, localStorage
  settings-manager.js   # tema, font, terreno, NDI config
  elevation-profile.js  # profilo altimetrico SVG
  impostazioni.js       # logica pagina /impostazioni
  style.css / impostazioni.css
server/ndi-service.js   # bridge WS → NDI
public/data/  terrain-premana.json, giir-di-mont-32-km.gpx
public/textures/ premana-satellite.jpg
data/  N46E009.hgt.gz + part-* (sorgente DEM, non necessaria a runtime)
```

---

## Git workflow (già inizializzato)

```bash
git status
git log --oneline --graph --all -10
git diff
git add -A && git commit -m "feat: descrizione"
git checkout -b fix/nome-feature   # per esperimenti
# per tornare a versione stabile:
git checkout master
# branch corrente con fix NDI:
git checkout fix/ndi-quality
```

- `master` = snapshot stabile `e4fdc68` + merge fix NDI
- `fix/ndi-quality` = lavoro NDI in corso (MSAA, colorSpace, riquadro, renderer dedicato)
- Screenshots locali (`Screenshot*.png`, `screenshot*.png`, `test_screen*.png`) sono in `.gitignore:5` e non vengono pushati.

---

## TODO — Prossime modifiche ancora da fare

### Priorità alta — NDI (in corso su `fix/ndi-quality`)
- [ ] **#1 Risoluzione NDI sgranata** — fixato con `renderTarget.samples=4` + `texture.colorSpace=SRGB` (`src/ndi-streamer.js:44`, `src/main.js:37`) e renderer NDI dedicato (`src/ndi-streamer.js:34`). **Da verificare** con screenshot browser vs NDI Studio Monitor affiancati.
- [ ] **#2 NDI troppo scuro** — fixato con `renderer.outputColorSpace = SRGBColorSpace` (`src/main.js:37`). Da verificare.
- [ ] **#2b Riquadro NDI non coincidente** — aggiunto overlay `#ndi-frame` 16:9 centrato (`index.html:12`, `src/style.css:674`, `src/main.js:698`). Ora NDI usa `programCamera.copy(camera)` (`src/main.js:686`) per centro identico. Da verificare (prima era crop in basso a sx).
- [ ] **#3 Nomi checkpoint in NDI** — attualmente solo HTML `.label` (`src/main.js:232`) visibili in browser, non in NDI (che legge solo WebGL). **Prossimo step:** sostituire/aggiungere `THREE.Sprite` con `CanvasTexture` nel `checkpointGroup` (`src/main.js:173`) così sia browser che NDI li vedono senza compositing 2D (che aveva rotto i colori).

### Roadmap (da SPECIFICHE_PROGRAMMA.md:99 e STATO_PROGETTO_E_LOG.md:68)
- [ ] Transizioni camera cinematiche (Bezier / lerp tra scene)
- [ ] Lower-thirds broadcast animati (bandiera, foto atleta, gap, passo)
- [ ] Meteo / nuvole volumetriche / God Rays
- [ ] Mini-mappa 2D PIP con posizioni atleti
- [ ] Controller hardware (Stream Deck / MIDI / Gamepad)
- [ ] Import CSV / webhook cronometraggio live

---

## Debug NDI

- HUD in alto a destra mostra `NDI: GIIR-3D-PROGRAM`, connessioni e FPS (`src/main.js:571`).
- Riquadro tratteggiato giallo = area Program 16:9 dentro il viewport browser. Toggle con `N`.
- Se NDI resta nero: controlla `http://localhost:9998/status` e i log del bridge (`[NDI-WS]`).

---

## Licenza

Privato — Giir di Mont. Non distribuire texture satellitare / DEM senza permessi.
