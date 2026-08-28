# Wayfinder Map — Giir di Mont 3D Broadcast v2
**Branch:** `dev-work` | **Created:** 2026-08-28 | **Source:** Grilling Session

---

## 🎯 Current State Snapshot

| Layer | Status | Notes |
|-------|--------|-------|
| **Terrain 3D (DEM SRTM)** | ✅ Done | Satellite HD / Stylized / Dark Minimal styles |
| **GPX Track + 10 Checkpoints** | ✅ Done | Catmull-Rom spline, smart Partenza/Arrivo toggle |
| **1,400 Alpine Trees (InstancedMesh)** | ✅ Done | ConeGeometry, elevation-filtered |
| **Race Manager (athletes, splits, state)** | ✅ Done | localStorage + BroadcastChannel sync |
| **Settings Dashboard (/impostazioni)** | ✅ Done | Theme, font, exaggeration, NDI config |
| **NDI 1080p50 Output** | ⚠️ **Partial** | Dedicated renderer — ~17-30 FPS (target 50) |
| **Checkpoint Labels in NDI** | ✅ Done | THREE.Sprite + CanvasTexture on layer 1 |
| **Camera Presets (4 scenes)** | ✅ Done | Keyboard 1-4, orbit controls |
| **Elevation Profile** | ✅ Done | SVG, synced to athlete position |
| **Arco Gonfiabile 3D** | ✅ Done | Bocchetta di Larec 14.5km |
| **Mini-map PIP** | ✅ Done | Ortho camera + renderTarget |

---

## 📋 Requirements from Grilling Session (2026-08-28)

### Requisiti Funzionali Confermati

| ID | Requisito | Fonte | Priorità |
|----|-----------|-------|----------|
| **REQ-UI** | Revisione interfaccia browser | Grilling Q1-Q3 | Alta |
| **REQ-TXT** | Uniformare testi browser/NDI | Grilling Q10 | Alta |
| **REQ-RACE** | Sistema simulazione gara con velocità variabile | Grilling Q4 | Alta |
| **REQ-CAM** | Scena "Insegui Leader" dinamica | Grilling Q5 | Alta |
| **REQ-PROG** | Progresso bicolore sulla traccia | Grilling Q6 | Alta |
| **REQ-TRANS** | Transizioni fluide tra scene (solo NDI) | Grilling Q8 | Media |
| **REQ-MAP** | Allargamento mappa | Grilling Q9 | Media-Bassa |
| **REQ-PERF** | Performance NDI (50fps o 25fps) | Grilling Q7 | Critica |
| **REQ-COLL** | Raycast terreno per camera | Grilling Q11 | Alta |
| **REQ-CONF** | Persistenza configurazione | Grilling Q12 | Media |

### Requisiti Esclusi (Non in scope)

- ❌ Effetti atmosferici (nebbia volumetrica, God Rays)
- ❌ Lower-thirds broadcast (banner foto atleta, bandiera)
- ❌ Integrazione cronometraggio live (webhook, CSV)
- ❌ Supporto Stream Deck / MIDI
- ❌ Nuove scene (Vetta Pizzo Alto rimossa)
- ❌ Modellini 3D beyond arco gonfiabile
- ❌ Sistema meteo dinamico

---

## 🗺️ Wayfinder Tickets — v2

> Ogni ticket = una modifica atomiche, verificabile, con acceptance criteria.
> Branch: `dev-work`. Un ticket alla volta. Commit dopo ogni completamento.

---

### 🔴 FASE 0 — CRITICA: PERFORMANCE NDI (Blocker per tutto il resto)

> **Obiettivo:** Raggiungere 50fps o 25fps a 1080p nell'output NDI.
> **Blocca:** Tutte le altre fasi dipendono da performance accettabili.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **PERF-01** | Profilare frame budget NDI | Chrome DevTools Performance → record 10s → screenshot `renderer.info` + FPS graph. Documentare collo di bottiglia. | Nessuna |
| **PERF-02** | Ottimizzare readPixels | Ridurre dimensione buffer o usare `OffscreenCanvas` + Web Worker per readPixels. Target: <4ms per frame NDI. | PERF-01 |
| **PERF-03** | Verificare shadow map 512 | `sun.shadow.mapSize.set(512, 512)` già in place. Verificare impatto visivo. | Nessuna |
| **PERF-04** | Verificare tube segments 300 | `TubeGeometry(routeCurve, 300, ...)` già in place. Verificare smoothness. | Nessuna |
| **PERF-05** | Verificare trees 600 | `InstancedMesh` con 600 instances già in place. | Nessuna |
| **PERF-06** | Test MSAA 2x su NDI renderer | `ndi-streamer.js` — provare `antialias: true` con samples ridotto. | PERF-01 |
| **PERF-07** | Modalità qualità NDI configurabile | In `/impostazioni`, sezione "Prestazioni": presets High/Balanced/Performance che regolano shadow, trees, tube, MSAA. | PERF-01 |
| **PERF-08** | Target FPS selezionabile (25/50) | In `/impostazioni`, sezione NDI: selettore target FPS con validazione (solo 25 o 50, no 30). | Nessuna |

---

### 🟠 FASE 1 — INTERFACCIA BROWSER

> **Obiettivo:** Pulire l'interfaccia, rimuovere duplicazioni, migliorare leggibilità.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **UI-01** | Rimuovere brand "GIIR DI MONT" | Eliminare `<section class="brand hud">` da `index.html:19-22`. Verificare che non ci siano riferimenti JS. | Nessuna |
| **UI-02** | Spostare nav tabs a sinistra | Modificare CSS `.nav-tabs` da `left:50%` + `transform:translateX(-50%)` a `left:24px`. Verificare che non coprano il brand rimosso. | UI-01 |
| **UI-03** | Ridurre NDI status bar | Nascondere elementi non critici (FPS, connessioni). Mantenere solo nome sorgente + tally indicator. | Nessuna |
| **UI-04** | Rimuovere HTML .label checkpoint | Eliminare creazione `div.label` in `add3DCheckpoint()` (`main.js:318-324`). Gli sprite CanvasTexture restano visibili sia browser che NDI. | Nessuna |
| **UI-05** | Aggiustare zoomScale per sprite | In `frame()` `main.js:844-846`, aggiornare valori scala per matchare `createCheckpointLabelSprite` (80x25). | UI-04 |
| **UI-06** | Aggiungere legenda shortcut in impostazioni | In `/impostazioni`, aggiungere sezione "Scorciatoie" con elenco: 1-4 scene, C clean, N NDI frame, M minimap, D debug, Space play/pausa. | Nessuna |
| **UI-07** | Clean View trasparenza graduata | Quando `body.clean`: elementi superiori (nav, ndi-bar) opacity 0.15, elementi inferiori (operator, elevation) opacity 0.3. Profilo nascosto se `showElevationProfile=false`. | Nessuna |

---

### 🟡 FASE 2 — SISTEMA GARA E SIMULAZIONE

> **Obiettivo:** Simulazione gara realistica con velocità basata su splits storici2025.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **RACE-01** | Dati splits storici2025 | In `race-manager.js`, aggiungere `defaultSplits2025` con tempi di passaggio reali (o stimati da articoli) per i 10 checkpoint. Winner: Magnini 03:14:04. | Nessuna |
| **RACE-02** | Selettore velocità in impostazioni | In `/impostazioni`, aggiungere selettore "Velocità Simulazione": Tempo Reale / Accelerato (con slider 10x-100x). Salvataggio in localStorage. | Nessuna |
| **RACE-03** | Interpolazione basata sugli splits | In `main.js:frame()`, sostituire `ath.km += dt * 0.08` con interpolazione: calcolare `elapsedSec` globale, trovare segmento corrente (tra checkpoint A e B), interpolare `ath.km` in base a `segmentDuration` e `segmentDistance`. | RACE-01, RACE-02 |
| **RACE-04** | Velocità variabile (salita/discesa) | L'interpolazione deve tenere conto del profilo altimetrico: in salita (ele in aumento) velocità ridotta, in discesa (ele in diminuzione) velocità aumentata. Fattore da calcolare dai dati storici. | RACE-03 |
| **RACE-05** | Pausa e Riavvolgimento | Supportare pausa (`Space`) e riavvolgimento (slider `athlete-km-slider` deve funzionare anche in modalità real-time). | RACE-03 |
| **RACE-06** | Aggiornamento UI tempi | `updateRiderCard()` deve mostrare tempo trascorso, tempo rimanente, velocità attuale, progresso percentuale. | RACE-03 |

---

### 🟢 FASE 3 — CAMERA "INSEGUI LEADER"

> **Obiettivo:** Camera dinamica che segue il leader con collision detection e framing intelligente.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **CAM-01** | Camera follow con offset tangente | In `frame()`, quando `activeScene==='runner'`: calcolare `tangent = routeCurve.getTangentAt(ratio)`, `idealCamPos = pt + tangent * -dist + up * height`. Camera lerp verso `idealCamPos` con damping frame-rate indipendente (`1 - exp(-rate * dt)`). | Nessuna |
| **CAM-02** | Raycast collision detection | Quando camera si muove: raycast dall'alto verso il basso lungo direzione camera→terreno. Se interseca geometria, spostare camera lateralmente finché non trova linea di vista libera. Offset minimo 15m dal terreno. | CAM-01 |
| **CAM-03** | Look-ahead (anticipazione curve) | Il target della camera deve essere 15-20m avanti rispetto alla posizione attuale del leader, basato sulla tangente. | CAM-01 |
| **CAM-04** | Altezza adattiva a pendenza | L'altezza della camera deve aumentare in discesa (per mostrare il percorso davanti) e diminuire in salita (per mostrare il corridore). Calcolare pendenza da differenza ele tra due punti vicini sulla curva. | CAM-01 |
| **CAM-05** | Preset inquadratura | Aggiungere 3 preset: "Close" (dist 40, height 20), "Wide" (dist 100, height 60), "Helicopter" (dist 200, height 120). Selezionabili da tastiera (es. Shift+1/2/3) o da UI. | CAM-01 |
| **CAM-06** | Transizione fluida presets | Cambio preset deve transitare fluidamente (lerp 1.8s) senza salti. | CAM-05 |

---

### 🔵 FASE 4 — PROGRESSO GARA SULLA TRACCIA

> **Obiettivo:** Sostituire indicatore leader con visualizzazione bicolore del progresso.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **PROG-01** | TubeGeometry bicolore | Modificare `rebuildTrack3D()`: creare DUE TubeGeometry — una per la porzione percorsa (colore accent), una per quella rimanente (grigio 50% opacity). Posizione divisione = `ratio` del leader. | Nessuna |
| **PROG-02** | Aggiornamento dinamico progresso | In `frame()`, aggiornare geometria bicolore ogni frame (o ogni 5 frames per performance) in base alla posizione del leader. | PROG-01 |
| **PROG-03** | Rimuovere indicatore leader grande | Eliminare la sfera grande con numero pettorale che indica il leader. Mantenere solo il marker piccolo dell'atleta. | Nessuna |
| **PROG-04** | Checkpoint marker lungo traccia | I 10 checkpoint devono essere visibili come marker piccoli (sfere r=1.0) lungo il percorso, indipendentemente dalla posizione del leader. | PROG-01 |

---

### 🟣 FASE 5 — TRANSIZIONI SCENE

> **Obiettivo:** Transizioni fluide tra scene, solo nell'output NDI.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **TRANS-01** | Transizione solo NDI | Modificare `setScene()`: il tween camera deve muovere solo `programCamera` (NDI), non la camera browser. Il browser mostra la posizione fissa fino al completamento. | Nessuna |
| **TRANS-02** | Coda transizioni | Implementare coda: se una transizione è in corso e ne viene richiesta un'altra, completare quella in corso poi avviare la nuova. Non interrompere. | TRANS-01 |
| **TRANS-03** | Durata variabile | Ogni transizione può avere durata diversa (es. overview→runner: 2.5s, checkpoint→topdown: 1.5s). Configurare durate per ogni coppia di scene. | TRANS-01 |
| **TRANS-04** | Indicatore visivo browser | Quando transizione in corso: mostrare barra "Transizione in corso..." in basso nel browser (sopra elevation profile). Nascondere al completamento. | TRANS-01 |
| **TRANS-05** | Tally durante transizione | Durante transizione, tally NDI deve mostrare "TRANSIZIONE" (giallo) invece di "ON-PROGRAM" (rosso). | TRANS-01 |

---

### ⚪ FASE 6 — MAPPA E CONFIGURAZIONE

> **Obiettivo:** Allargare mappa, migliorare dettaglio, persistenza configurazione.

| Ticket | Titolo | Acceptance Criteria | Dipendenze |
|--------|--------|---------------------|------------|
| **MAP-01** | Estendere DEM evitare bordi blu | Modificare `terrain-premana.json` o offset camera per evitare bordi visibili nella panoramica. Alternativa: fog più denso ai bordi. | Nessuna |
| **MAP-02** | Texture satellite higher-res per NDI | Creare versione texture satellite 4096px per NDI renderer, mantenere 2048px per browser. | Nessuna |
| **MAP-03** | Persistenza configurazione | Tutte le impostazioni (velocità, presets camera, NDI config) salvate in localStorage e persistono tra sessioni. | Nessuna |
| **MAP-04** | Export/Import configurazione (JSON) | In `/impostazioni`, pulsanti "Esporta Config" e "Importa Config" che salvano/caricano JSON file. Per backup e ripristino rapido. | MAP-03 |

---

## ⚡ Dependency Graph

```
PERF-01 → PERF-02, PERF-06, PERF-07
PERF-07 → PERF-08
UI-01 → UI-02
UI-04 → UI-05
RACE-01 → RACE-03 → RACE-04, RACE-05, RACE-06
RACE-02 → RACE-03
CAM-01 → CAM-02, CAM-03, CAM-04, CAM-05
CAM-05 → CAM-06
PROG-01 → PROG-02, PROG-04
TRANS-01 → TRANS-02, TRANS-03, TRANS-04, TRANS-05
MAP-03 → MAP-04
```

---

## 📊 Ordine Consigliato di Implementazione

1. **FASE 0** (PERF) — Prima di tutto, senza 50fps nulla ha senso
2. **FASE 1** (UI) — Pulizia rapida, miglioramento immediato
3. **FASE 2** (RACE) — Cuote della simulazione, blocca FASE 3
4. **FASE 3** (CAM) — Depende da RACE per posizione leader
5. **FASE 4** (PROG) — Indipendente, può essere fatto in parallelo con FASE 3
6. **FASE 5** (TRANS) — Può essere fatto in parallelo con FASE 3-4
7. **FASE 6** (MAP/CONF) — Nice-to-have, fine priorità

---

## 📦 Come Usare Questa Mappa

1. **Scegli un ticket** (inizia da PERF-01)
2. **Lavora** — un commit, messaggio descrittivo
3. **Verifica** — `npm run dev` + NDI Studio Monitor / vMix
4. **Segna** — aggiorna questo file, commit
5. **Prossimo ticket**

> **Regola:** Un ticket alla volta. Completa → verifica → commit → prossimo.

---

## 🔗 References

- `README.md` — Architecture & quick start
- `SPECIFICHE_PROGRAMMA.md` — Full spec & future ideas
- `TODO.md` — Working list
- `CURRENT_STATE.md` — Current dev state
- `.wayfinder/map.closed.md` — Previous map (closed tickets)
- `.wayfinder/map.md` — **Questo file**

---

## 📝 Notes

- Dati splits storici2025: Magnini 03:14, Angermund 03:15:36, Tanara 03:18:34
- Checkpoint timing points: Chiarino, Vegessa, Larec, Rasga, Deleguaggio
- Cut-off times: Vegessa 2h15, Solino 5h15, Max 7h00
- Source: giirdimont.it, trailrunner.com, UTMB Index

---

*Generated by grilling session 2026-08-28. Requirements confirmed by user.*
