# TODO — Giir di Mont 3D — Simulatore 3D Gara / Flusso NDI

> Lista aggiornata il 27/08/2026 — sostituisce la TODO del 26/08/2026. Branch di lavoro `dev-work` (ex `DevTeooo`), merge su `master` solo quando verificato. Ogni punto = commit + test + push. Verificare dopo ogni modifica: rendering stabile, NDI 1080p50 OK, track visibile, simulazione sincronizzata, camere funzionanti.

## Ordine consigliato di implementazione

L'ordine di esecuzione segue la priorità funzionale indicata sotto (1 → 9). Non modificare funzionalità già corrette senza necessità specifica.

---

### PRIORITÀ 1 — Visualizzazione NDI e checkpoint — [ ] DA FARE
**Obiettivo:** il flusso NDI deve mostrare l'intera schermata `1920×1080 a 50 FPS` (`src/ndi-streamer.js:5`, `server/ndi-service.js:7`). Mantenere sfondo 3D e traccia GPX attuali (verificati: funzionano). Nel flusso NDI devono essere visibili:
- mondo 3D;
- traccia GPX;
- checkpoint come sfere (`src/main.js:285` `SphereGeometry`);
- nome di ogni checkpoint (solo nome, **senza km** per ora — i valori km attuali non sono precisi).

**Stato attuale (verificato 27/08 live):** terreno e track OK in browser; HTML `.label` (`src/style.css:639`) visibili solo in browser; sprite NDI esistente `createCheckpointLabelSprite()` (`src/main.js:222`) mostra `name + km` su layer 1 — viola il requisito "senza km". Va modificato per mostrare solo nome (o rigenerato). Browser deve continuare a mostrare HTML label (con km ok), NDI solo nome. `camera.layers 0` / `programCamera 0+1` (`src/main.js:28`) già corretto. `captureAndSend` (`src/ndi-streamer.js:136`) usa renderer dedicato 1920×1080 isolato.

**Fix:**
- Modificare `createCheckpointLabelSprite(name, themeColor)` per generare canvas senza riga `km` (o parametro `showKm=false` per NDI).
- Verificare `ndiStreamer.captureAndSend(renderer, scene, programCamera)` (`src/main.js:776`) e `programCamera.copy(camera)` + `aspect 16/9` (`src/main.js:769`) per centratura 1:1 (già fix fec9325).
- Mantenere `preserveDrawingBuffer` solo su ndiRenderer, non su renderer principale se non necessario.

**Test:** NDI Studio Monitor / vMix sorgente `GIIR-3D-PROGRAM` a 1080p50 deve mostrare sfere + cartello nome sopra ogni check; confronto browser vs NDI screenshot affiancati; verificare no trunc dietro pannello laterale (`#ndi-frame`).

### PRIORITÀ 2 — Correzione e allineamento traccia GPX al terreno 3D — [ ] DA FARE
**Obiettivo:** traccia fisicamente appoggiata al terreno; correggere tutti i punti dove entra nella montagna, attraversa, è sospesa o disallineata. Segue fedelmente superficie `terrain-premana.json`.

**Stato attuale:** `rawTrackPoints` da `public/data/giir-di-mont-32-km.gpx` (2056 punti verificati via `/data` fetch), convertiti in `worldPoints` con `terrainManager.coordToWorld(p.lat,p.lon,p.ele) + v.y+=1.8` (`src/main.js:321`) e `CatmullRomCurve3` + `TubeGeometry 800×1.1×7` (`src/main.js:330`). Offset fisso 1.8 insufficiente — in screenshot `scene-runner` e `scene-larec` si vedono tratti in ombra o sospesi; verifica via `terrainManager.getElevationAtWorld(x,z)` (`src/terrain-manager.js:62`) non usata per GPX.

**Analisi richiesta:**
- Confrontare `ele` GPX vs `getElevationAtWorld` vs `terrainData.elevations` (`terrain-premana.json` 256×256, bbox 9.385-9.52/46.015-46.095).
- Valutare correzione alla fonte: rigenerare `public/data/giir-di-mont-32-km.gpx` o creare `gpx-corrected.json` con `ele` ricalibrate da DEM + offset dinamico minimo (es. +1.2–2.0) invece di solo `v.y+=1.8`.

**Fix previsto:**
- Opzione preferita: script `scripts/correct-gpx.js` che per ogni `trkpt` ricalcola `ele = terrain.ele + margin` e riscrive GPX, mantenendo lat/lon invariati.
- Alternativa: `rebuildTrack3D()` che per ogni punto usa `Math.max(eleGPX, terrainEle+offset)` con `raycast` opzionale.
- Rigenerare `TubeGeometry` dopo correzione.

**Test:** ispezione 3D a bassa quota sui 4 scenari (soprattutto Bocchetta 14.5km e Pizzo/Deleguaggio 27.5km) — track mai sotto terreno, mai floating >3m; screenshot comparativi prima/dopo.

### PRIORITÀ 3 — Sistema cronologico della simulazione — [ ] DA FARE
**Obiettivo:** velocità calcolata per segmento da tempi configurati tra checkpoint consecutivi (es. A→B 20min, B→C 10min). Il corridore impiega esattamente il tempo assegnato per ogni segmento. Verificare tempo totale, trascorso, rimanente, sincronizzazione posizione↔tempo. Mantenere UI tempi già presente (`src/race-manager.js:79`, `src/impostazioni.js:71`) ma farla influenzare realmente la simulazione.

**Stato attuale:** `frame()` (`src/main.js:725`) avanza con `ath.km = (ath.km + dt * 0.08) % totalKm` — velocità globale fissa `0.08 km/s` (~4.8 km/min), indipendente da `ath.splits` / `cp.refSplit`. `race-manager.js:171` `updateSplitTime` aggiorna `km` ma non ricalcola velocità. `elevationProfile.updateProgress` (`src/elevation-profile.js:131`) solo visivo. Nessun calcolo gap/pace dinamico.

**Fix:**
- In `RaceManager` aggiungere `computeSegmentTimes(athlete)` che da `splits` (o `refSplit` se vuoto) ricava `segmentDurationSec` per ogni cp e `totalDuration`.
- In `main.js` `frame()` interpolare `ath.km` in base a `elapsedSec` globale e `segmentDistance` (da `routeCurve.getPointAt` o distanza GPX cumulativa), non `dt*0.08`. Usare `clock.getElapsedTime()` o tempo simulato scalabile.
- Aggiornare `updateRiderCard` e profilo per mostrare tempo reale vs rimanente.

**Test:** configurare 00:20:00 e 00:10:00 su due segmenti, verificare runner attraversa CP2 esattamente dopo 20min simulati (con timescale se necessario); verificare `totalKm 32.0` e `winnerReferenceTime 03:15:00` coerenti.

### PRIORITÀ 4 — Estensione del mondo 3D — [ ] DA FARE
**Obiettivo:** territorio ~2× più grande, non tagliato ai bordi; mantenere gara in posizione relativa. Base satellitare non singola immagine zoomata ma mosaico di immagini ad alta risoluzione unite senza giunzioni visibili; dettaglio conservato in zoom/closeup; coerenza con DEM.

**Stato attuale:** `PlaneGeometry(worldWidth, worldHeight, width-1, 251)` (`src/terrain-manager.js:91`) derivato da `bbox` DEM SRTM 46.015-46.095×9.385-9.52 (~15.5×9.2 km). In panorama 1920×1080 il bordo sud mostra cielo (terrain edge) — confermato in screenshot `scene-pizzo` con gap azzurro. Texture singola `public/textures/premana-satellite.jpg` 1108639 byte (~sat singola). In `scene-overview` il mondo riempie ma con NDI crop appena visibile; su 1280x800 ancora più crop.

**Fix:**
- Estendere `terrain-premana.json`: rigenerare da `data/N46E009.hgt.gz` + adiacenti tile (N46E008, N47E009 ecc.) o estendere BBOX + interpolare; target ~2× area (es. 30×18 km), mantenere centerLat/Lon.
- Generare mosaico satellitare: scaricare 4–6 tile Sentinel/ESRI ad alta ris., stitch in `premirana-sat-large.jpg` (~4096px) con blending; aggiornare `TerrainManager` per supportare texture >2048 o tiled material.
- Aggiornare `controls.maxDistance 2600` e `camera.position 0,480,760` per nuova scala; verificare `worldWidth/Height` con padding.

**Test:** panorama non mostra più bordo netto; zoom a Bocchetta non sgrana; confronto before/after screenshot; FPS invariato.

### PRIORITÀ 5 — Correzione checkpoint nel profilo altimetrico + riduzione sfere — [ ] DA FARE
**Obiettivo:**
- Correggere posizione checkpoint nel profilo `src/elevation-profile.js` — alcuni non sono su percorso.
- Ridurre notevolmente diametro sfere (`SphereGeometry 4.8` attuale `src/main.js:286`) mantenendole identificabili e in scala mondo.
- Riposizionare con precisione dopo fix GPX: checkpoint esattamente sul percorso, mai sospesi/interrati/lateralmente offset; coerenza GPX ↔ mondo 3D ↔ profilo ↔ NDI.

**Stato attuale:** checkpoint creati via `ratio = cp.km / totalKm` e `routeCurve.getPointAt(ratio)` (`src/main.js:344`) — approssimato su curva, non su vero `trkpt` GPX corrispondente. `ElevationProfile.setTrackData` usa `trackPoints` + `checkpoints` ma calcola distanza via `dLat/dLon*111150/77211` approssimata, non distanza curva; `getY` usa `cp.ele` diretto, non elevazione terreno. Sfere `r=4.8` ~9.6m mondo (scala 0.1 + exaggeration 1.25 → ~96m reali) — sproporzionate (visibili in zenith a 900m altezza). Duplicati lat/lon in `race-manager.js:14-18` (Fraina/Rasga stesso, Premaniga/Solino/Deleguaggio stesso) — imprecisione.

**Fix:**
- Ricalcolare `cp` posizione reale: cercare `trkpt` più vicino a `cp.km` cumulativa o a coordinate ref; usare quel `worldPos` per marker + sprite; aggiornare `cp.ele` da `getElevationAtWorld` o GPX corretto.
- Ridurre `SphereGeometry` a ~1.2–1.8 (testare 1.5) e `MeshBasicMaterial` con outline; scalabile con `zoomScale`.
- In `elevation-profile.js` mappare checkpoint a `dist` reale cumulativa, non `cp.km` teorico; `renderSVG` circle pos aggiornata.

**Test:** profilo altimetrico scurvato correttamente; marker piccolo ma visibile in NDI e browser; verifica 10 checkpoint allineati su track in 4 scene.

### PRIORITÀ 6 — Modalità "Insegue Leader" — [ ] DA FARE
**Obiettivo:** camera mantiene distanza relativa costante dal leader, non semplice `lerp` verso posizione. Leader sempre inquadrato. Valutare inquadratura intelligente: mantenere leader visibile, mostrare porzione davanti, evitare occlusione da montagna, inquadratura TV-ready. Prima deterministico, poi eventuale AI.

**Stato attuale:** `setScene('runner')` (`src/main.js:428`) posiziona camera statica `p + (95,55,115)` una tantum; in `frame()` se `activeScene==='runner'` fa `targetPos.lerp(pt,0.04)` + `controls.target.copy(targetPos)` (`src/main.js:747`) ma `camera.position` non segue dinamicamente (rimane fissa fino a prossimo setScene). Quindi non insegue realmente — leader esce di campo se avanza. In `scene-runner` screenshot leader a 5.7km con camera molto vicina a terreno, parzialmente occluso.

**Fix (deterministico prima):**
- In `frame()` per `runner`: `idealCamPos = pt + offsetInTrackDirection * dist` + `controls.target.lerp(pt, 0.08)` e `camera.position.lerp(idealCamPos, 0.06)` con offset basato su tangente `routeCurve.getTangentAt(ratio)` + `up` e altezza adattiva a pendenza.
- Aggiungere `raycast` per evitare interpenetrazione terreno (alzare y se vicino).
- Opzionale: two preset `ChaseClose` / `ChaseFar` selezionabili.

**Test:** leader rimane centrato per 60s di simulazione continua; nessuna occlusione prolungata; switching 1→2→1 fluido.

### PRIORITÀ 7 — Controllo remoto della telecamera — [ ] DA FARE
**Obiettivo:** controllare camera da dispositivo esterno (smartphone/tablet/gamepad/altro) per creare inquadrature senza mouse/tastiera; controllo posizione, orientamento, zoom, altezza; fluido real-time.

**Stato attuale:** solo `OrbitControls` mouse + tastiera `1,2,3,4,5,Space,C,N` (`src/main.js:453`). Nessun supporto Gamepad né remote. `vite --host` già espone in LAN (192.168.1.111), esistente `BroadcastChannel` per impostazioni ma non per camera.

**Opzioni da valutare (research):**
- Gamepad API (`navigator.getGamepads()`) diretta in `frame()` — più semplice, no rete.
- WebSocket bridge per smartphone: nuova pagina `controllo-telecamera.html` + `server/camera-ws.js` (simile a `ndi-service.js`) che inoltra `camera pos/target` via WS/BroadcastChannel.
- Valutare librerie: `nipplejs` per joystick mobile.

**Fix previsto:** implementare una delle due (gamepad come base + stub WS per mobile) e documentare; fluido 60fps, deadzone configurabile.

**Test:** controllo da iPad su stessa LAN muove camera con <100ms latenza; gamepad analogico left/right orbita, trigger zoom.

### PRIORITÀ 8 — Modellino 3D arco gonfiabile — [ ] DA FARE
**Obiettivo:** creare modellino rosso semplificato da riferimento `Arco Gonfiabile.png` (nel root) — dimensione simile a checkpoint (non sproporzionato). Posizionare a Bocchetta di Larec/Laregia (GPM 2070m, `cp3` 14.5km `46.044809,9.492315` ma verificare toponimo corretto "Bocchetta di Larec" vs "La Reggia"), sostituire/affiancare checkpoint, orientato perpendicolare al percorso, inclinato con terreno, corridore passa sotto.

**Stato attuale:** nessuna geometria arco; checkpoint `cp3` è sfera `4.8` gialla (`src/main.js:287`). Foresta è `InstancedMesh` cono; nessun loader GLTF. Immagine arco rossa a U rovesciata, 8 lati.

**Fix:**
- Creare `src/models/arch.js` che costruisce `ExtrudeGeometry` o `TubeGeometry` a forma di arco (es. `Shape` U + `Extrude` con curva, `MeshStandardMaterial #ff1a1a`).
- In `rebuildTrack3D()` dopo creazione checkpoint, istanziare arco a `pt = routeCurve.getPointAt(14.5/32)`; orientamento via `tangent = routeCurve.getTangentAt(ratio)`, `quaternion` per pendicolare, `normal` da terreno (`getElevationAtWorld` sui due piedi per inclinazione), `scale` ~8–10 world units altezza.
- Aggiungere gap per passaggio atleta (`athleteMesh` sprite passa a `y+14`).

**Test:** arco visibile in `scene-checkpoint` e NDI (layer 0+1), rosso, stabile, non flottante, corridore animato attraversa sotto senza collisioni.

---

## Note generali e verifiche

- Non modificare funzionalità già corrette senza necessità.
- Dopo ogni modifica verificare: rendering stabile, NDI 1080p50 ( `curl http://localhost:9998/status` ), track visibile, simulazione sincronizzata, camere (1-5) funzionanti.
- Preferire soluzioni semplici/deterministiche prima di AI complessa.
- Workflow: `git checkout dev-work` → fix singolo → `npm run dev` + NDI Studio Monitor → commit → push. Merge su `master` solo quando verificato.
- Tracker locale: questa TODO è la mappa; ogni PRIORITÀ diventerà ticket Wayfinder se necessario.

## Vecchi TODO archiviati (pre-27/08)

- [x] [NDI] Nomi checkpoint in NDI (07d54f0) — ora riveduto per Priorità 1 (senza km)
- [~] [3D] Mondo tagliato — confluito in Priorità 4
- [~] [Dati] GPX entra in montagna — confluito in Priorità 2+5
- [ ] [3D] Modellini oltre alberi — parzialmente Priorità 8
- [ ] [UX] Zoom rimpicciolisci elementi — da valutare dentro Priorità 5/6
- [ ] [Perf] 50fps — trasversale, verificare dopo Priorità 4

## Commit già fatti (base)

- `5f0d73b` MSAA + colorSpace NDI
- `186b0c7` riquadro 16:9
- `bd2ed9e` renderer NDI dedicato
- `fec9325` baseline working
- `5789fc3` NDI centering restore
