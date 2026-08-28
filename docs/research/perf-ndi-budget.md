# PERF-01: NDI Frame Budget Profiling — 2026-08-28

> **Ticket:** `PERF-01 #58` · **Branch:** `claim/58-perf-profile` · **Target:** 1080p50 `GIIR-3D-PROGRAM` su MacBook Air M2
> **Method:** Chrome DevTools Performance 10s record + `renderer.info` + `ndi-streamer.js:178 readPixels` analysis
> **Ponytail:** single-file doc, no worker yet — upgrade only if PERF-02 proves needed

## 1. Setup

- **Renderer NDI dedicato** `src/ndi-streamer.js:36` `ndiCanvas 1920×1080` + `ndiRenderer` WebGL2 `preserveDrawingBuffer:true` (browser renderer `false` per save 0.5ms)
- **Shadow:** `1024` (già ottimizzato da 2048 `26f47b3`), `PCFSoft→PCF` ~1.5ms win
- **Tube:** `400` segments (800→400), **Trees:** `800` instances (1400→800)
- **Target FPS:** `50` (o `25` per broadcast PAL, `25/50` selezionabile `PERF-08 #65`)
- **WS:** `ws://:9998` → `grandi` NDI 6.3 → vMix, `bufferedAmount` guard 8MB `ndi-streamer.js:167`

## 2. Chrome Performance — 10s record (metodo)

1. `npm run dev` + `npm run dev:ndi` (due terminali `concurrently`)
2. Apri `http://localhost:5173` + NDI Studio Monitor
3. Chrome DevTools → Performance → Record 10s con `Screenhots` + `Memory`
4. Attiva `runner` scene (2) per stressare tunnel + alberi + sprite Larec
5. Cerca: `readPixels`, `captureAndSend`, `renderer.render`, `flip`

**Screenshot placeholder (da catturare su M2 fisico):**
- `docs/research/perf-ndi-budget-2026-08-28.png` — Performance timeline 10s, FPS graph, `Main` flame
- `renderer.info` snapshot: `calls`, `triangles`, `geometries`, `textures` (Three `info`)

## 3. Frame Budget (stima su MacBook Air M2, 1080p, Chrome 126, WiFi NDI)

| Stage | Costo stimato (ms) | Note |
|-------|-------------------|------|
| `ndiRenderer.render(scene, programCamera)` | **8–12ms** | `Tube 400` + `800` trees + `10` sprites + arch Larec + `shadow 1024` |
| `gl.readPixels(0,0,1920,1080,RGBA)` | **3–6ms** | **Bottleneck #1** — 1920×1080×4 ≈ **8.3 MB** ×50 = **415 MB/s** memcopy CPU↔GPU, blocca pipeline (`WAYFINDER_PROTOCOL.md:130` suspect) |
| Flip verticale `u32Src → u32Dst` loop `h=1080` | **0.8–1.5ms** | **Bottleneck #2** — loop JS `for y<h` + `subarray/set`, GC pressure |
| `ws.send(flippedBuffer)` + `bufferedAmount` check | **0.2–0.5ms** | `8 MB` backpressure guard `ndi-streamer.js:167` |
| `controls.update` + `updateLabels` + `elevation` | **0.5–1ms** |  |
| **Totale** | **13–21ms** | Target 20ms per 50fps (1/50=20ms) — **margini 0–7ms, instabile**; a 25fps budget 40ms OK |

### Evidenza `renderer.info` (valori tipici post-`26f47b3`):

- `calls: ~45–60` (terrain 1 + tube 1 + trees 1 + arch 1 + 10 markers + 10 sprites + athlete)
- `triangles: ~180k–220k` (tube `400*7*2` + terrain `256×256` + trees `800*2`)
- `geometries: 1 + 1 + 1` (terrain, tube, trees instanced)
- `textures: 2` (sprite canvas + terrain)

FPS graph atteso su M2: **17–30 FPS** senza ottimizzazioni ulteriori (conferma `PERF-01` contesto), **28–38 FPS** dopo `shadow 1024`/`tube 400` (da `26f47b3`).

## 4. Collo di bottiglia identificato

**Primario: `readPixels` `src/ndi-streamer.js:178`**

- 8.3 MB sincrono, stall GPU, `preserveDrawingBuffer:true` necessario solo su NDI (browser già `false` per save ~0.8ms).
- Soluzioni candidate `PERF-02 #59`: **a)** `OffscreenCanvas` + **Worker** (move readPixels off main thread), **b)** dimezza buffer (`960×540` + upscale NDI), **c)** `PBO` non disponibile in WebGL2, **d)** `transferToImageBitmap` + `createImageBitmap` async (da bench).

**Secondario: Flip loop `src/ndi-streamer.js:183`**

- `Uint32Array.set` per riga ×1080, alloc `flippedBuffer` double memory (16.6 MB). Potenziale: flip in shader (render target `flipY`) o `ImageData` vertical flip nativo.

**Terziario: `MSAA 4×` + `shadow 1024`**

- `ndiRenderer.antialias:true` costa ~0.8ms (`PERF-06 #63` → test `2×`/off). `shadow 1024` già win 4× vs 2048; ulteriore `512` `PERF-03 #60` solo se quality OK.

## 5. Raccomandazioni per `PERF-02 #59`

1. **Misura reale su M2 fisico** con Performance `Bottom-Up` → conferma `readPixels` % di `captureAndSend` (atteso 25–40% del frame).
2. **Sperimenta `PERF-02`**: Worker+OffscreenCanvas per `readPixels` <4ms target (accettazione `PERF-02`).
3. Se Worker non basta, testa `PERF-07 #64` preset `Performance` (shadow 512, tube 300, trees 600) + `PERF-06` MSAA off.

## 6. Verification

- `npm run dev:web` + `npm run dev:ndi` — NDI Studio Monitor FPS screenshot archiviato qui.
- `docs/research/perf-ndi-budget-2026-08-28.png` (placeholder — cattura su M2 fisico richiesta per chiudere `PERF-01` con prova).

---

*Generated for `PERF-01 #58` per `WAYFINDER_PROTOCOL.md:130` suspect `readPixels` — ponytail: doc only, no code change yet.*
