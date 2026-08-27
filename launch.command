#!/bin/bash
# Giir di Mont 3D Launcher - Avvia tutto in una volta
# - Server NDI
# - Vite dev server (http://localhost:5173)
# - Apre browser alla pagina 3D

echo "=== Giir di Mont 3D Launcher ==="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Chiudi processi precedenti se presenti
pkill -f "node server/ndi-service.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
echo -e "${YELLOW}✓ Processi precedenti fermati${NC}"

# Avvia server NDI in background
echo -e "${GREEN}Avvio server NDI...${NC}"
cd "/Users/macbookairm2/Documents/ChatGPT/Percorso 3D"
node server/ndi-service.js &
NDI_PID=$!
echo "   PID NDI: $NDI_PID"
sleep 2

# Verifica NDI attivo
if curl -s --head http://localhost:9998 2>/dev/null | head -1 | grep -q "200"; then
    echo -e "${GREEN}✓ Server NDI attivo su ws://localhost:9998${NC}"
else
    echo -e "${RED}✗ Errore avvio server NDI${NC}"
    echo "   Il server NDI potrebbe richiedere tempo per inizializzarsi."
fi

echo ""

# Avvia Vite dev server in background (fix: prima lanciava solo `cd` in bg, vite mai partito → doppio NDI se poi si fa npm run dev)
echo -e "${GREEN}Avvio Vite dev server...${NC}"
cd "/Users/macbookairm2/Documents/ChatGPT/Percorso 3D"
npm run dev:web -- --host &
VITE_PID=$!
echo "   PID Vite: $VITE_PID"
sleep 3

# Apri browser alla pagina 3D
echo -e "${GREEN}Apertura browser alla pagina 3D...${NC}"
open -a "Google Chrome" "http://localhost:5173" 2>/dev/null || \
open -a "Safari" "http://localhost:5173" 2>/dev/null || \
open "http://localhost:5173"

echo ""
echo "=== Tutto avviato! ==="
echo "📍 Browser: http://localhost:5173"
echo "📡 NDI: ws://localhost:9998 (sorgente: GIIR-3D-PROGRAM)"
echo "   - Apri NDI Monitor e cerca 'GIIR-3D-PROGRAM' sulla rete locale"
echo "   - Oppure usa: open -a 'NDI Monitor' dopo aver avviato il programma"
echo ""
echo "Premi Ctrl+C per terminare tutti i processi..."
echo ""

# Mantieni il terminale aperto e mostra lo stato
while true; do
    # Verifica che i processi siano ancora in esecuzione
    if ! kill -0 $NDI_PID 2>/dev/null || ! kill -0 $VITE_PID 2>/dev/null; then
        echo -e "${RED}⚠ Uno o più processi sono terminati${NC}"
        break
    fi
    sleep 10
done

# Pulizia al termine
echo ""
echo -e "${YELLOW}Terminazione pulizia processi...${NC}"
pkill -f "node server/ndi-service.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
echo -e "${GREEN}✓ Processi terminati${NC}"