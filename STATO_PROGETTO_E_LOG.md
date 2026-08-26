# 🏔️ Giir di Mont 3D — Stato del Progetto & Log di Sviluppo

**Data ultimo aggiornamento:** 26 Agosto 2026  
**Stato:** ✅ Funzionante, testato e pronto per la ripresa dei lavori.

---

## 🚀 1. Riepilogo di Quanto Realizzato Oggi

### A. Uscita Broadcast NDI Nativa Diretta (1080p50)
- **Zero OBS sul computer operatore:** Il Mac trasmette direttamente sulla rete locale come sorgente **`GIIR-3D-PROGRAM`** tramite **NDI SDK 6.3** (`grandi` nativo Apple Silicon).
- **Risoluzione Broadcast Garantita:** Buffer di rendering a **1920×1080 (16:9)** costante a **50 FPS**, indipendente dalla dimensione della finestra del browser.
- **Standby Frame Automatico:** Il canale NDI è visibile e agganciabile da vMix / OBS / NDI Studio Monitor istantaneamente all'avvio.
- **Telemetria & Tally Live:** Contatore ricevitori connessi in rete, FPS reali e indicatore Tally On-Program / On-Preview.

### B. Terreno 3D Reale da Modello DEM Satellitare (SRTM)
- **Massiccio Montuoso di Premana & Valvarrone:** Costruito sui dati altimetrici satellitari reali da 600m fino a 2.578m (Pizzo Alto, Monte Legnone, Bocchetta di Larec).
- **Mappa Satellitare HD:** Ortofoto aerea ad alta risoluzione integrata stile *Google Earth*.
- **3 Stili Visivi:**
  1. 🛰️ *Satellitare HD* (ortofoto fotorealistica)
  2. 🎮 *3D Stilizzato / Videogioco* (tinteggiatura altimetrica da fondovalle a vette rocciose)
  3. 🌑 *Dark Minimal* (look studio broadcast con tracciato neon)
- **1.400 Micro Abeti 3D:** Foreste alpine distribuite realisticamente nelle valli sotto i 1.600m.

### C. Tracciato GPX & Checkpoint Geografici Ufficiali
- **Tracciato realistico:** Sentiero 3D sottile (raggio 1.1) adagiato sulle creste montane.
- **Rimosso l'alone giallo:** Luce solare bianca naturale (`#ffffff`) e contrasto nitido.
- **Tutti i 10 Checkpoint Ufficiali posizionati alle quote esatte:**
  1. *Partenza · Premana* (0.0 km, 960m)
  2. *Alpe Chiarino* (4.8 km, 1542m)
  3. *Alpe Vegessa / Cancello 1* (9.0 km, 1196m)
  4. *Bocchetta di Larec / GPM Cima Coppi* (14.5 km, 2070m)
  5. *Alpe Fraina* (16.8 km, 1395m)
  6. *Alpe Rasga / Intermedio 4* (19.0 km, 1090m)
  7. *Alpe Premaniga* (23.0 km, 1400m)
  8. *Alpe Solino / Cancello 2* (25.0 km, 1601m)
  9. *Alpe Deleguaggio / Intermedio 5* (27.5 km, 1658m)
  10. *Arrivo · Premana* (32.0 km, 958m)
- **Gestione Smart Partenza vs Arrivo:** Visualizzazione automatica della *Partenza* nella prima metà di gara e dell'*Arrivo* nella seconda metà per evitare sovrapposizioni su Premana.

### D. Profilo Altimetrico Dinamico Broadcast
- Grafico altimetrico 3D interattivo a fondo schermo con quota istantanea (es. *1931 m*), chilometraggio e cursore dell'atleta sincronizzato.

### E. Nuova Dashboard di Controllo: `/impostazioni`
- **Tabella Tempi Intermedi (Record di riferimento 3:15:00):**
  - Tempi di riferimento per tutti i checkpoint.
  - Inserimento manuale o tramite pulsante *"Usa Riferimento"*.
- **Gestione Completa Atleti:** Pettorale, nome, nazionalità, squadra e colore 3D.
- **Personalizzazione Grafica:** Palette colori, font (*Barlow Condensed*, *DM Sans*, *Montserrat*, *Oswald*), esagerazione rilievo 3D.
- **Sincronizzazione Live Istantanea (`BroadcastChannel`):** Modificando i dati in `/impostazioni`, la vista 3D si aggiorna in tempo reale senza ricaricare.

---

## 🛠️ 2. Come Avviare il Progetto

Da terminale nella cartella del progetto:
```bash
npm run dev
```

Pagine disponibili:
- **Visualizzazione 3D (Program):** [`http://localhost:5173`](http://localhost:5173)
- **Dashboard Impostazioni & Gara:** [`http://localhost:5173/impostazioni`](http://localhost:5173/impostazioni)
- **Sorgente NDI di rete:** `GIIR-3D-PROGRAM` (1920×1080 @ 50 FPS)

---

## 🎯 3. Roadmap & Prossimi Passi per Domani

1. **Transizioni Cinematografiche di Telecamera (Camera Splines / Tweening):**
   - Movimenti morbidi con curve di Bezier quando si passa da una scena all'altra (es. planata da Panoramica Valle a Bocchetta di Larec).
2. **Grafiche TV Lower-Thirds Animate:**
   - Banner sovrimpresso broadcast con bandiera nazione, foto/avatar atleta, distacco cronometrico live e passo medio (min/km).
3. **Meteo & Atmosfera Volumetrica:**
   - Banchi di nebbia mattutina nelle vallate e raggi di luce solare (*God Rays*).
4. **Mini-Mappa 2D PIP (Picture-in-Picture):**
   - Piccolo riquadro nell'angolo con la mappa 2D del percorso e le icone di tutti i corridori.
5. **Supporto Hardware Controller:**
   - Possibilità di pilotare la telecamera con un Gamepad o cambiare scene tramite Stream Deck con scorciatoie dedicate.
