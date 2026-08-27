# BASELINE STABILE — Giir di Mont 3D

**Data:** 27 Agosto 2026 — 18:55  
**Commit:** `0089373` `feat(branding): icona sito + colori + fix tasto 4`  
**Branch:** `dev-work` (pushato su `origin/dev-work`)  
**Tag:** `baseline-stable-20260827`  
**Stato:** ✅ Verificato `vite build` OK, NDI single source stabile

## Perché questa baseline
Dopo diversi cicli di fix (NDI doppio/triplo source, HMR, _TEOO, mondo tagliato, GPX, checkpoint, perf) ogni modifica introduceva regressioni su pezzi già sistemati. Da qui in poi si lavora **un pezzettino alla volta** partendo da questa base stabile, con commit+push e pull/merge dell'altro utente ad ogni step.

## Cosa contiene (stabile)
- **NDI:** fix doppio/triplo source `1ad4004` (`server/ndi-service.js:208` ignora WS non attivo + singleton HMR `src/ndi-streamer.js:37`), debounce `e6ef653`, normalizzazione `_TEOO` `e33468b`, `launch.command:41` fix vite
- **Perf NDI-1** di lucabert00 `26f47b3` (shadow 1024, tube 400, trees 800, preserveDrawingBuffer false, PCF) + cam tween `a0f7d42` 1.8s `src/main.js:412`
- **Master allineato:** `dev-work` contiene `master` `da932fc` + `feat/ndi-50fps` mergiati (`9271f4f`, `69fd3cb`)
- **Branding:** icona sito `https://www.giirdimont.it/wp-content/uploads/2025/09/LogoGiirDiMont.png` → `public/LogoGiirDiMont.png` + `public/favicon.png` (`index.html:6` `impostazioni.html:6`), colori sito Astra `#a4c736` primary (`src/settings-manager.js:4`), palette aggiornata, migrazione `#dff654→#a4c736`
- **Tasti:** 1-4 allineati ai bottoni Regia, rimosso `pizzo` da `src/main.js:415` (ora 4=topdown)
- **TODO assegnazioni:** `TODO.md:7-30` con `te` vs `lucabert00` (8 PRIORITÀ + GFX/CAM/NDI:41)

## Verifiche fatte su questa versione
- `npm run dev` → `vite v7.3.6 ready` + `NDI Bridge ws://localhost:9998` `GIIR-3D-PROGRAM` singolo (1 WS `lsof -i :9998`, headless killato, `_TEOO` normalizzato)
- `vite build` → 552k main-Du5XJwje.js OK, favicon in `dist/`
- `git bundle` + `tar.gz` backup in `/Users/macbookairm2/Documents/ChatGPT/Percorso 3D-backup-20260827-1840.*`

## Come ripristinare
```bash
# opzione 1 — tag
git checkout baseline-stable-20260827
# opzione 2 — cartella backup
tar -xzf "/Users/macbookairm2/Documents/ChatGPT/Percorso 3D-backup-20260827-1840.tar.gz"
# opzione 3 — bundle
git clone "/Users/macbookairm2/Documents/ChatGPT/Percorso 3D-backup-20260827-1840.bundle" restore
npm install && npm run dev
```

## Regola da qui in poi
1. Un TODO alla volta (es. P1 NDI senza km)
2. `npm run build` + test NDI/broadcast prima di commit
3. `git commit -m "..." && git push origin dev-work`
4. `git fetch --all` + `git log origin/master..dev-work` per controllare modifiche di `lucabert00` / PR #26
5. Se divergenza → `git merge origin/master` o `origin/feat/...`, test, push
6. Se incertezza → chiedi all'utente

**Prossimo TODO in coda (te):** P1 — Visualizzazione NDI e checkpoint senza km `src/main.js:222` `createCheckpointLabelSprite` (NDI solo nome, browser resta con km)
