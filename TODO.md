# TODO — Giir di Mont 3D (branch DevTeooo → merge su master quando ok)

> Lista concordata il 26/08/2026. Lavoriamo su `DevTeooo`, ogni punto fixato = commit + test + push. Merge su `master` solo quando verificato.

## Ordine di lavoro

### 1. [NDI] Nomi checkpoint in NDI ✅ FATTO (07d54f0)
**Problema:** label checkpoint erano `div.label` HTML (`src/main.js:232` + `src/style.css:639`) posizionate via `project(camera)` (`src/main.js:633`). `gl.readPixels` (`src/ndi-streamer.js:147`) legge solo WebGL, quindi NDI non li vedeva.
**Fix fatto:** `createCheckpointLabelSprite()` CanvasTexture 512x160 + `THREE.Sprite` su layer 1 (`src/main.js:222`), `camera.layers 0` / `programCamera 0+1` (`src/main.js:27`), HTML resta per browser, sprite per NDI. `clearCheckpoints`/`updateLabels` gestiscono entrambi.
**Test:** verificare in NDI Studio Monitor che i cartelli checkpoint appaiano centrati sopra le sfere

### 2. [3D] Mondo troppo tagliato / da ingrandire
**Problema:** viewport appare croppata ai bordi, si perde parte del massiccio.
**Ipotesi:** `camera` FOV 40 (`src/main.js:21`), `controls.maxDistance 2600` (`src/main.js:48`), `PlaneGeometry` worldWidth/Height da bbox (`src/terrain-manager.js:88`), o `renderer.setSize` con margini HUD.
**Fix previsto:** aumentare `worldWidth/Height` con padding o allargare FOV / distanza overview (`src/main.js:356` `camera.position.set(0,480,760)`), verificare `terrainData.bbox`.
**Test:** panoramica deve mostrare Premana + creste senza tagli

### 3. [Dati] GPX entra nella montagna + checkpoint non precisi
**Problema:** in alcuni tratti il `TubeGeometry` (`src/main.js:263`) affonda nel terreno; coordinate checkpoint (`src/race-manager.js`) non perfette.
**Fix previsto:**
- Rialzare `worldPoints` (`v.y += 1.8` in `src/main.js:255`) o usare `getElevationAtWorld` + offset dinamico + `raycast` per aderenza
- Ricalibrare checkpoint: confrontare GPX `public/data/giir-di-mont-32-km.gpx` con `terrain-premana.json`, correggere lat/lon/ele in `src/race-manager.js`
- Rigenerare `terrain-premana.json` da `data/N46E009.hgt.gz` se necessario
**Test:** ispezione 3D a bassa quota, screenshot punti critici

### 4. [3D] Modellini 3D oltre alberelli
**Stato:** 1400 instanced `ConeGeometry` (`src/main.js:128`) già presenti
**Idea:** aggiungere baite, rifugi, croci di vetta, pali segnavia come `InstancedMesh` o `GLTF` leggeri
**File:** nuovo `src/models/` + loader, aggiungere a `generateAlpineForest` o nuovo `generateLandmarks()`
**Test:** impatto FPS < 2ms, LOD se necessario

### 5. [Perf] Ottimizzazione per 50fps (ora ~17fps visto in screenshot)
**Stato:** Mac non a pieno carico, NDI a 17fps invece di 50 (`src/ndi-streamer.js:50` `targetFps 50`, `server/ndi-service.js:9` `DEFAULT_FPS 50`)
**Ipotesi:** 
- Doppio renderer (browser + NDI dedicato `src/ndi-streamer.js:34`) = doppio `render` per frame
- `readPixels` + flip Uint32 (`src/ndi-streamer.js:152`) 8.3MB *50 = 400MB/s
- `InstancedMesh` 1400 alberi + `TubeGeometry` 800 segmenti + ombre 2048
- `preserveDrawingBuffer: true` (`src/main.js:33`) costoso
**Fix previsto:**
- Profilare con `renderer.info` e `performance.now`
- NDI a 30fps se 50 non sostenibile, o `requestVideoFrameCallback`
- Ridurre `shadowMap` a 1024, `tubeGeometry` a 400, alberi a 800, `samples` NDI a 2 se serve
- `powerPreference: high-performance` già ok, valutare `OffscreenCanvas` / Web Worker
**Test:** `ndi-status` FPS ≥45 stabile su MacBook Air M2

---

## Workflow DevTeooo

```bash
git checkout DevTeooo
# lavora su un punto
git add <file> && git commit -m "feat: ..."
git push -u origin DevTeooo
# verifica con npm run dev + NDI Studio Monitor
# quando ok → PR o merge su master:
git checkout master && git merge DevTeooo --no-ff && git push
```

## Commit già fatti (base)
- `5f0d73b` MSAA + colorSpace NDI
- `186b0c7` riquadro 16:9
- `bd2ed9e` renderer NDI dedicato
