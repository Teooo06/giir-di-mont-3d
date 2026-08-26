# Giir di Mont — Visualizzatore 3D Broadcast per Diretta

## 1. Obiettivo

Realizzare un software broadcast di grafica 3D in tempo reale per la diretta del **Giir di Mont (32 km · 3.800 m D+)** a Premana. Il programma riproduce il massiccio montano reale, il tracciato di gara, i checkpoint e gli atleti virtuali, inviando un segnale video **NDI pulito a 1080p50** direttamente alla regia video (vMix, OBS, TriCaster, ecc.) sulla rete locale.

---

## 2. Architettura del Sistema

```text
[Operatore sul Mac / PC]
       │
       ├─► Finestra 1: Visualizzazione 3D Live (`/` su porta 5173)
       │         └──► Viewport Three.js con orbita drone, scene 1-5, profilo altimetrico
       │
       ├─► Finestra 2: Dashboard Impostazioni & Gara (`/impostazioni`)
       │         └──► Tempi intermedi (ref. 3:15:00), atleti, colori, font, terreno
       │
       │ (Sincronizzazione istantanea bidirezionale via BroadcastChannel + localStorage)
       │
       ▼
Render Program 1080p50 (Buffer pulito Three.js 1920×1080 a 16:9)
       │
       ▼ (WebSocket binario raw RGBA su porta 9998)
Bridge NDI Locale (NDI SDK 6.3 nativo Apple Silicon / x64 via `grandi`)
       │
       ▼ (LAN / Gigabit Ethernet)
Sorgente Broadcast di Rete: "GIIR-3D-PROGRAM" ───► PC Regia Video
```

---

## 3. Cosa è stato implementato finora

### A. Motore Grafico 3D & Terreno Reale
- **Terreno Reale DEM (SRTM 1-arcsecond):** Generazione della mesh montuosa reale a partire dai dati satellitari della Valvarrone / Premana (quote reali da 600 m a 2.578 m del Pizzo Alto, Monte Legnone e Bocchetta di Larec).
- **Mappa Satellitare HD:** Ortofoto aerea integrata stile *Google Earth*.
- **3 Stili di Rendering:**
  - 🛰️ *Satellitare HD* (ortofoto fotorealistica)
  - 🎮 *3D Stilizzato / Videogioco* (rilievo con fasce altimetriche da fondovalle a vette rocciose)
  - 🌑 *Dark Minimal* (look da studio broadcast con tracciato neon)
- **1.400 Micro Alberelli Alpini 3D:** Foreste instanziate piantate realisticamente sui versanti boschivi sotto i 1.600m.
- **Tracciato GPX Sottile e Scalabile:** Curva centripeta Catmull-Rom adagiata perfettamente sopra il terreno montano senza aloni sfocati o dominanti gialle.

### B. Regia Scene Rapide & Telecamera Drone
- `1` **Panoramica 3D Valle Premana** (inquadratura d'insieme)
- `2` **Inseguimento Leader Drone** (camera dinamica che segue l'atleta in corsa)
- `3` **Bocchetta di Larec** (GPM Cima Coppi a 2.070m)
- `4` **Vetta Pizzo Alto / Alpe Deleguaggio**
- `5` **Vista Satellitare Zenith** (dall'alto a 90°)
- `Spazio` **Play / Pausa** simulazione atleti
- `C` **Clean View** (nasconde tutti i pannelli per la visione pulita)

### C. Checkpoint Geografici Ufficiali & Partenza/Arrivo Smart
- Waypoint ufficiali agganciati alle coordinate reali del GPX:
  1. *Partenza · Premana* (0.0 km, 960m)
  2. *Alpe Chiarino* (4.8 km, 1542m)
  3. *Alpe Vegessa / Cancello 1* (9.0 km, 1196m)
  4. *Bocchetta di Larec / GPM* (14.5 km, 2070m)
  5. *Alpe Fraina* (16.8 km, 1395m)
  6. *Alpe Rasga / Intermedio 4* (19.0 km, 1090m)
  7. *Alpe Premaniga* (23.0 km, 1400m)
  8. *Alpe Solino / Cancello 2* (25.0 km, 1601m)
  9. *Alpe Deleguaggio / Intermedio 5* (27.5 km, 1658m)
  10. *Arrivo · Premana* (32.0 km, 958m)
- **Separazione Smart Partenza/Arrivo:** a inizio gara (<16 km) si vede solo il cartello *Partenza*, verso il finale (≥16 km) si vede solo *Arrivo*, eliminando sovrapposizioni visive su Premana.

### D. Seconda Pagina di Controllo: `/impostazioni`
- **Dashboard Tempi di Passaggio:**
  - Tabella tempi intermedi basata sul record di **3:15:00** dei top runner sul tracciato 32 km +3800m D+.
  - Pulsante *"Usa Riferimento"* e inserimento manuale da [classifiche ufficiali Giir di Mont](https://www.giirdimont.it/it/classifiche/).
- **Gestione Completa Atleti:** Pettorale, nome, squadra, nazionalità, colore marcatore 3D, stato gara.
- **Personalizzazione Grafica:** Palette colori brand, scelta font (*Barlow Condensed*, *DM Sans*, *Montserrat*, *Oswald*), esagerazione 3D rilievo montano.
- **Sincronizzazione Live Multi-Scheda:** Tramite `BroadcastChannel`, qualsiasi modifica si riflette istantaneamente nella vista 3D.

### E. Uscita Broadcast NDI 1080p50 Nativa
- **Zero OBS sul Mac dell'operatore:** trasmissione diretta via NDI SDK 6.
- **Buffer 1080p50 Indipendente:** La trasmissione invia sempre un video pulito 1920×1080 a 16:9, indipendentemente dalla grandezza della finestra del browser.
- **Standby Frame Automatico:** La sorgente `GIIR-3D-PROGRAM` è visibile immediatamente su NDI Studio Monitor / vMix anche prima di aprire il browser.
- **Telemetria & Tally in tempo reale:** Contatore ricevitori connessi, FPS misurati e indicatore On-Program / On-Preview.

---

## 4. Come Avviare

1. Eseguire nel Terminale:
   ```bash
   npm run dev
   ```
2. Aprire:
   - **Vista 3D Live:** `http://localhost:5173`
   - **Pannello Impostazioni & Gara:** `http://localhost:5173/impostazioni`
3. Sul PC di regia (o su NDI Studio Monitor) selezionare la sorgente **`GIIR-3D-PROGRAM`**.

---

## 5. Idee e Sviluppi Futuri per Renderlo Ancora Più Spettacolare

1. **Transizioni Cinematografiche di Telecamera (Camera Splines):**
   - Transizioni morbide con curve di Bezier / LERP dinamico nel passaggio tra le scene (es. planata aerea da Panoramica a Bocchetta di Larec).
2. **Effetti Atmosferici Dinamici & Nuvole Volumetriche:**
   - Strato di banchi di nebbia / nuvole basse nelle valli alpine mattutine e luce solare volumetrica (God Rays).
3. **Grafica Broadcast Lower-Thirds Animata:**
   - Banner TV sovrimpresso con bandiera nazionale dell'atleta, foto/avatar del corridore, distacco dal leader in secondi e velocità oraria/passo.
4. **Mini-Mappa 2D PIP (Picture-in-Picture):**
   - Riquadro piccolo in alto/basso a destra con la mappa 2D del percorso e i puntini di tutti i corridori in gara.
5. **Integrazione Hardware Controller (Stream Deck / MIDI / Gamepad):**
   - Controllo della telecamera con la levetta analogica di un gamepad o cambio inquadrature tramite Stream Deck a pulsanti fisici.
6. **Importazione CSV / API Live Automatica:**
   - Possibilità di caricare il file CSV dei pettorali completi o collegarsi a un webhook di cronometraggio live.
