# TODO — Giir di Mont 3D — Simulatore 3D Gara / Flusso NDI

> **Aggiornata il 28/08/2026** — Grilling Session completata. Nuova mappa Wayfinder in `.wayfinder/map.md`.
> Branch di lavoro `dev-work`, merge su `master` solo quando verificato.
> Ogni punto = commit + test + push. Verificare dopo ogni modifica: rendering stabile, NDI 1080p50 OK, track visibile, simulazione sincronizzata, camere funzionanti.

---

## 📋 Riepilogo Grilling Session (28/08/2026)

Sessione di requirements discovery completata. Requisiti confermati e organizzati in 6 fasi nella mappa Wayfinder `.wayfinder/map.md`.

### Requisiti Chiave Confermati

| Area | Requisito | Priorità |
|------|-----------|----------|
| **Performance NDI** | Raggiungere 50fps o 25fps (no 30fps) | Critica |
| **Interfaccia** | Rimuovere brand, spostare tabs, ridurre NDI bar | Alta |
| **Checkpoint Labels** | Rimuovere HTML .label duplicati, tenere solo sprite | Alta |
| **Simulazione Gara** | Velocità variabile basata su splits storici2025 | Alta |
| **Camera Follow** | Dinamica con collision detection, look-ahead | Alta |
| **Progresso Gara** | Traccia bicolore (percorsa/rimanente) | Alta |
| **Transizioni** | Solo NDI, coda transizioni, indicatore browser | Media |
| **Mappa** | Evitare bordi blu, texture extra per NDI | Media-Bassa |
| **Configurazione** | Persistenza + export/import JSON | Media |

### Dati Storici2025 (per simulazione)

- **Winner:** Davide Magnini — 03:14:04
- **Secondo:** Stian Angermund — 03:15:36
- **Terzo:** Mattia Tanara — 03:18:34
- **Checkpoint timing:** Chiarino, Vegessa, Larec, Rasga, Deleguaggio
- **Cut-off:** Vegessa 2h15, Solino 5h15, Max 7h00

---

## 🎫 Ticket Attivi (dalla mappa Wayfinder v2)

### FASE 0 — PERFORMANCE NDI (CRITICA)
- [ ] **PERF-01** — Profilare frame budget NDI
- [ ] **PERF-02** — Ottimizzare readPixels
- [ ] **PERF-03** — Verificare shadow map 512
- [ ] **PERF-04** — Verificare tube segments 300
- [ ] **PERF-05** — Verificare trees 600
- [ ] **PERF-06** — Test MSAA 2x su NDI renderer
- [ ] **PERF-07** — Modalità qualità NDI configurabile
- [ ] **PERF-08** — Target FPS selezionabile (25/50)

### FASE 1 — INTERFACCIA BROWSER
- [ ] **UI-01** — Rimuovere brand "GIIR DI MONT"
- [ ] **UI-02** — Spostare nav tabs a sinistra
- [ ] **UI-03** — Ridurre NDI status bar
- [ ] **UI-04** — Rimuovere HTML .label checkpoint
- [ ] **UI-05** — Aggiustare zoomScale per sprite
- [ ] **UI-06** — Aggiungere legenda shortcut in impostazioni
- [ ] **UI-07** — Clean View trasparenza graduata

### FASE 2 — SISTEMA GARA E SIMULAZIONE
- [ ] **RACE-01** — Dati splits storici2025
- [ ] **RACE-02** — Selettore velocità in impostazioni
- [ ] **RACE-03** — Interpolazione basata sugli splits
- [ ] **RACE-04** — Velocità variabile (salita/discesa)
- [ ] **RACE-05** — Pausa e Riavvolgimento
- [ ] **RACE-06** — Aggiornamento UI tempi

### FASE 3 — CAMERA "INSEGUI LEADER"
- [ ] **CAM-01** — Camera follow con offset tangente
- [ ] **CAM-02** — Raycast collision detection
- [ ] **CAM-03** — Look-ahead (anticipazione curve)
- [ ] **CAM-04** — Altezza adattiva a pendenza
- [ ] **CAM-05** — Preset inquadratura
- [ ] **CAM-06** — Transizione fluida presets

### FASE 4 — PROGRESSO GARA SULLA TRACCIA
- [ ] **PROG-01** — TubeGeometry bicolore
- [ ] **PROG-02** — Aggiornamento dinamico progresso
- [ ] **PROG-03** — Rimuovere indicatore leader grande
- [ ] **PROG-04** — Checkpoint marker lungo traccia

### FASE 5 — TRANSIZIONI SCENE
- [ ] **TRANS-01** — Transizione solo NDI
- [ ] **TRANS-02** — Coda transizioni
- [ ] **TRANS-03** — Durata variabile
- [ ] **TRANS-04** — Indicatore visivo browser
- [ ] **TRANS-05** — Tally durante transizione

### FASE 6 — MAPPA E CONFIGURAZIONE
- [ ] **MAP-01** — Estendere DEM evitare bordi blu
- [ ] **MAP-02** — Texture satellite higher-res per NDI
- [ ] **MAP-03** — Persistenza configurazione
- [ ] **MAP-04** — Export/Import configurazione (JSON)

---

## ✅ Ticket Completati (pre-grilling)

| Ticket | Titolo | Commit | Data |
|--------|--------|--------|------|
| NDI-1 | 50 FPS sustained (shadow/tube/trees) | `26f47b3` | 27/08 |
| CAM-1 | Cinematic transitions (easeInOutCubic) | `a0f7d42` | 27/08 |
| FIX | Doppio NDI source (singleton HMR) | `1ad4004`+`e6ef653` | 27/08 |
| P8 | Arco gonfiabile rosso Bocchetta 14.5km | `b8ebc3e` | 27/08 |
| P5 | Sfere checkpoint 4.8→1.5 | `0ca31e1` | 27/08 |
| P2 | GPX allineamento dinamico al terreno | `26dc9a8` | 27/08 |
| GFX-2 | Mini-map PIP ortho + renderTarget | `0e4f782` | 27/08 |
| P7 | Gamepad API per controllo camera | `3948b8e` | 27/08 |

---

## 📌 Note Importanti

- **Branch:** `dev-work` (ex `DevTeooo`)
- **Sync:** Allineato a `master` + `feat/ndi-50fps` + fix doppio NDI
- **Build:** `vite build` OK
- **Wayfinder map:** `.wayfinder/map.md` (fonte di verità per nuovi ticket)
- **Wayfinder old:** `.wayfinder/map.closed.md` (ticket precedenti completati)

---

## 🔗 Riferimenti

- `.wayfinder/map.md` — **Mappa Wayfinder v2** (questi requisiti)
- `.wayfinder/map.closed.md` — Mappa precedente (ticket chiusi)
- `SPECIFICHE_PROGRAMMA.md` — Specifica completa del programma
- `CURRENT_STATE.md` — Stato attuale del development
- `README.md` — Architettura e quick start

---

*Ultimo aggiornamento: 28/08/2026 — Grilling Session completata*
