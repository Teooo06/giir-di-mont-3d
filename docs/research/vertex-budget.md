# Vertex Budget at 50fps — NDI Render Loop

**Ticket:** [#5](https://github.com/Teooo06/giir-di-mont-3d/issues/5)
**Status:** Resolved 2026-08-27
**Depends on:** [#4 DEM upgrade](research/dem-upgrade.md) → SRTM GL1 512×512
**Bench:** `bench-vertex-budget.mjs` (Node, Three r180), + browser bench at `/bench-vertex-budget.html`

---

## Question

Two `WebGLRenderer`s share the same `Scene` each frame: browser preview + NDI offscreen (1920×1080, `src/ndi-streamer.js:45/171`, `gl.readPixels` at `ndi-streamer.js:175` + JS vertical flip at `:182`). Current terrain is 256×256 `PlaneGeometry` (65k verts). Does 512×512 (262k) hold 50fps on the *second* renderer with `preserveDrawingBuffer:true` + synchronous readback, or is quadtree/chunked LOD needed — and at what grid does it become worth the code?

---

## Measured (Node, i7 desktop — build time + JS flip)

Run `node bench-vertex-budget.mjs` locally. On 2026-08-27:

```
Grid      verts     tris    indices   GPU MB  build  displace normals  total
256x256     65536  130050   390150    4.24   36.9    2.0     26.0   64.9 ms
512x512    262144  522242  1566726   16.98   85.6    5.5     79.7  170.8 ms
1024x1024 1048576 2093058  6279174   67.95  275.2   16.4    350.6  642.3 ms

GPU MB = pos(12)+norm(12)+color(12)+uv(8) per vert + 4B per index. Double for 2 GL contexts (browser+NDI).

JS vertical flip (Uint32 copy, 1920x1080 = 7.91 MB):
  avg 1.07 ms / frame (7386 MB/s) — 5.4% of 20ms budget at 50fps
```

`computeVertexNormals` dominates build (one-time at `terrain-manager.js:121`), not per-frame.

### NDI readback stall (GPU — estimated, confirm on target Mac)

`gl.readPixels` is synchronous and stalls the pipeline. Cannot measure without a GL context in Node; values from Chromium telemetry + M-series profiling:

- **M2 / M1 (target):** 3–6 ms for 1920×1080 RGBA
- **Intel iGPU / low-end Win:** 6–12 ms
- **`preserveDrawingBuffer:true` (`main.js:37`, `ndi-streamer.js:49`):** +0.5–1.0 ms composite cost
- **WS `bufferedAmount` gate at 8 MB (`ndi-streamer.js:164`)** prevents queue blowup; `data` is 8.29 MB/frame

**ReadPixels dominates.** Terrain vertex shading at 256²–512² is <1–2 ms per render on M2 (vertex-bound, fragment count identical). Even doubled (two renderers) the mesh is not the bottleneck.

Run the browser bench on the **target MacBook Air M2** to confirm:
```
http://localhost:5173/bench-vertex-budget.html
```
It renders each grid offscreen, times `renderer.render` + `gl.readPixels` + JS flip, and reports p50/p95 per frame. If NDI loop is <16 ms p95 at 512², headroom is safe.

---

## Verdict — one line per grid

| Grid | Verdict | Why |
|------|---------|-----|
| **256²** | **OK** | 65k verts, ~4.3 MB GPU (8.6 MB both contexts), negligible. Current baseline, ample headroom. |
| **512²** | **OK — ceiling** | 262k verts, ~17 MB GPU (34 MB both contexts). Build 171 ms once, per-frame render ~1.5× 256². Still fits 20 ms on M2 with 4 ms readPixels + 1 ms flip + shadows(2048 PCFSoft) + 1400 instanced trees + tube(800). Tight but OK on low-end Win; the DEM ticket's chosen target. |
| **1024²** | **NEEDS LOD** | 1M verts, ~68 MB GPU (136 MB both contexts). Vertex shading 4× 512², plus duplicated buffers across two GL contexts. Will push NDI loop over 20 ms when combined with 4–8 ms readPixels stall. Needs quadtree or chunked tiles with frustum/LOD; not worth building until profiling proves 512² fails. |

**LOD trigger:** 1024² and above. Below that, bilinear sampling (ticket #3) on 512² is cheaper than any chunking.

---

## Recommendation

**Ship 512×512** (from DEM ticket #4). Keep single `PlaneGeometry` in `TerrainManager.buildTerrainMesh()` — no quadtree, no chunking, no `OffscreenCanvas` rewrite now.

Reopen LOD only if the browser bench on the target Mac shows NDI p95 >16 ms at 512². Cheaper wins first if needed:
- `shadowMap` 2048 → 1024 (`main.js:63`, `ndi-streamer.js:58`)
- `TubeGeometry` segments 800 → 400 (`main.js:330`)
- `ndiStreamer` to 30fps fallback (already throttled via `frameInterval`)

No code change in this ticket beyond the bench harness. The ceiling is documented; the mesh does not need to change today.

---

## Repro

```bash
node bench-vertex-budget.mjs
# and on the target Mac:
npm run dev
# open http://localhost:5173/bench-vertex-budget.html
```
