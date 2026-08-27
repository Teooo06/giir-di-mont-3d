# DEM Upgrade Research — Giir di Mont 3D

**Ticket:** [#4](https://github.com/Teooo06/giir-di-mont-3d/issues/4)
**Status:** Research complete
**Date:** 2026-08-26

---

## Current state

`terrain-premana.json` is 256×256 (65,536 samples) of SRTM 1-arcsecond (~30 m/post), covering:
- **bbox:** minLon 9.385 → maxLon 9.52, minLat 46.015 → maxLat 46.095 (~12.3 km × ~8.9 km)
- **elevation range:** 600.8 m → 2578.6 m (Pizzo Alto, Monte Legnone, Bocchetta di Larec)
- **current spacing:** ~48 m/col × ~35 m/row (non-square post spacing due to latitude)

At this resolution, ridgelines, saddles, and steep couloirs are lost. The GPX track points for the 32 km course snaking through valleys and over the Bocchetta di Larec are all snapped to a 48 m grid. Camera flyovers at scene 3–5 (close-up ridge views) show staircase altitude artifacts.

---

## Sources considered

### 1. SwissALTI3D 0.5 m — ❌ out of scope

SwissALTI3D (swisstopo) covers Switzerland only. Premana is ~20 km east of the Swiss border in Lombardy, Italy. **Zero coverage for the bbox.**

### 2. Regione Lombardia DTM 20 m (DTM20_UTM32N) — ⚠️ marginal

**Availability:** Fully public, via ArcGIS REST export service.
**Resolution:** 20 m grid posts — only marginally better than SRTM 1" (30 m).
**Endpoint:**
```
https://www.cartografia.servizirl.it/arcgis5/rest/services/BaseMap/DTM20_UTM32N/MapServer
```
Layer 0 = DTM 20m bare ground. Export via `ExportImage` with bbox in UTM32N (EPSG:32632).
**License:** Regione Lombardia open data — redistribution OK for broadcast.
**Verdict:** Not worth the conversion overhead. 20 m ≈ 30 m — no visible improvement in ridge detail.

### 3. Regione Lombardia LiDAR DTM 1 m — 🏆 gold standard (restricted)

**Availability:** 1 m bare-ground DTM from multiple LiDAR campaigns (2002–2015), covering all of Lombardy.
**Resolution:** 1 m posts — 48× better than SRTM 1".
**Endpoint:**
```
http://www.pcn.minambiente.it/arcgis/rest/services/dtm/LiDAR_Lombardia/MapServer
```
Layer index: DTM(7), Grid 1x1 DTM(8), Hillshade 1x1 DTM(9).
**License:** Restricted access — public administrations, designated professionals, or request via Regione Lombardia IDT portal. Free for public bodies; commercial broadcast use needs authorization.
**Verdict:** Best available. If operator or broadcaster has public-admin access, this is the source. Otherwise: fall back to SRTM GL1 at 30 m via OpenTopography (free, immediate).

**LiDAR coverage confirmation:** metadata at INSPIRE geoportal (`r_lombar:975979a7-68e8-4524-b759-0db4d8284939`) lists "Copertura zone collinari e montane" — Premana falls within the "Valli Logistiche" campaign zones.

### 4. NASA SRTM GL1 30 m via OpenTopography — ✅ free, immediate

**Availability:** Free via OpenTopography API (requires free API key registration).
**Resolution:** 30 m posts (1 arc-second) — same as current, but allows clean 512×512 resample instead of the current downsampled 256².
**API call:**
```
https://portal.opentopography.org/API/globaldem?demtype=SRTMGL1&south=46.015&north=46.095&west=9.385&east=9.52&outputFormat=GTiff&API_Key=YOUR_KEY
```
Or bulk download tile N46E009 from NASA Earthdata (`https://urs.earthdata.nasa.gov/` — free account):
```
https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1V003/2000.02.11/N46E009.SRTMGL1.hgt.zip
```
**License:** NASA public domain — unrestricted.
**Verdict:** Best free option for immediate improvement. Register for OpenTopography API (free, instant) or use Earthdata token.

### 5. ALOS World 3D 30 m (AW3D30) — fallback

Available via OpenTopography: `demtype=AW3D30`. Same 30 m grid as SRTM GL1 but from Japanese satellite; marginally different vertical datum (JAXA ellipsoidal). **Not worth switching** from SRTM GL1 unless SRTM has voids in this bbox (it doesn't — Premana is well-imaged).

---

## Recommended path

| Priority | Source | Resolution | Access | Action |
|----------|--------|-----------|--------|--------|
| **P0 (now)** | SRTM GL1 via OpenTopography API | 30 m | Free, API key | Register, download, resample to 512×512 |
| **P1 (if possible)** | Lombardy LiDAR DTM 1 m | 1 m | Restricted | Request access via IDT portal, download, resample to 1024×1024 or keep full |

### Why 512×512 and not 1024×1024?

For SRTM 30 m data, upsampling to 1024×1024 creates false precision — the native data has 30 m posts, so a 1024 grid on a 12 km bbox would mean ~12 m spacing derived from 30 m data via resampling alone. Better to resample to 512×512 (~24 m spacing, doubling density) and let bilinear interpolation (ticket #3) smooth the remaining staircase.

For LiDAR 1 m data, 1024×1024 on a 12 km bbox = ~12 m spacing, which is already a major improvement. At full LiDAR resolution (1 m), a 1024×1024 crop would be ~1.2 km² — only useful for a small area. Keep LiDAR at 512×512 (~24 m spacing from 1 m source) or chunk it.

---

## Pipeline sketch (SRTM GL1 → 512×512 JSON)

```python
# Python — requires: rasterio, numpy
# Or use CLI: gdal_translate -of VRT/resize

import rasterio
from rasterio.enums import Resampling
import json

bbox = {"minLon": 9.385, "maxLon": 9.52, "minLat": 46.015, "maxLat": 46.095}

with rasterio.open("N46E009_SRTMGL1.tif") as src:
    # Window from bbox (SRTM is EPSG:4326)
    window = rasterio.windows.from_bounds(
        bbox["minLon"], bbox["minLat"], bbox["maxLon"], bbox["maxLat"],
        transform=src.transform
    )
    data = src.read(1, window=window, out_shape=(512, 512),
                    resampling=Resampling.bilinear)

    out = {
        "width": 512,
        "height": 512,
        "bbox": bbox,
        "minElevation": float(data.min()),
        "maxElevation": float(data.max()),
        "elevations": data.flatten().tolist()
    }

with open("public/data/terrain-premana.json", "w") as f:
    json.dump(out, f)
```

**GDAL CLI alternative (no Python needed):**
```bash
# 1. Download
curl -o N46E009.hgt.zip "https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1V003/2000.02.11/N46E009.SRTMGL1.hgt.zip"
unzip N46E009.hgt.zip

# 2. Clip + resize to 512×512 GeoTIFF
gdal_translate -of GTiff -r bilinear \
  -srcwin <col_off> <row_off> 400 300 \
  -outsize 512 512 \
  N46E009.hgt terrain-512.tif

# 3. Convert to JSON (needs small Python/gdal_read script)
```

---

## Gotchas

1. **Vertical datum:** SRTM reports heights above EGM96 geoid (orthometric). The current `terrain-premana.json` values look orthometric (600–2578 m matches real elevations). No conversion needed.
2. **Void pixels:** SRTM GL1 has been void-filled (v3); Premana area has no known voids. But verify `data.min()` after download — if any values are -32768 or negative, mask them.
3. **Coordinate system:** The JSON bbox is in WGS84 lon/lat (EPSG:4326). `terrain-manager.js` converts to world units via `metersPerDegreeLat/Lon` constants — unchanged regardless of DEM resolution.
4. **LiDAR datum:** Lombardy LiDAR DTM uses WGS84 ellipsoidal heights (EPSG:32632 / UTM32N). May need conversion to EGM96 orthometric if mixing with SRTM. GDAL can handle this: `gdalwarp -t_srs EPSG:4326 -geoid` if the geoid grid is available.
5. **File size:** 512×512 JSON with `elevations` as flat array of floats ≈ 4 MB. 1024² ≈ 16 MB. Acceptable for in-browser fetch. The current 256² JSON is 321 KB.
6. **Satellite texture alignment:** If the terrain mesh resolution changes, the satellite texture UV mapping must be regenerated or the texture re-sampled. `premana-satellite.jpg` is currently mapped to the full bbox — no change needed as long as bbox stays the same.
