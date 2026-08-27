import http from 'http';
import { WebSocketServer } from 'ws';
import grandi from 'grandi';

const NDI_SOURCE_NAME = process.env.NDI_NAME || 'GIIR-3D-PROGRAM';
const WS_PORT = parseInt(process.env.NDI_WS_PORT || '9998', 10);
const WIDTH = 1920;
const HEIGHT = 1080;
const DEFAULT_FPS = 50; // ponytail: calibration knob — client setFps(30) throttles via frameInterval, server just tags frameRateN; no server-side drop needed

let ndiSender = null;
let currentFps = DEFAULT_FPS;
let isLiveClientStreaming = false;
let frameCount = 0;
let lastFpsTime = Date.now();
let measuredFps = 0;
let activeWsClient = null;
let idleInterval = null;

// Crea un frame di standby broadcast (1920x1080 RGBA)
function createStandbyBuffer() {
  const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    const rowOffset = y * WIDTH * 4;
    const grad = Math.floor(16 + (y / HEIGHT) * 24);
    for (let x = 0; x < WIDTH; x++) {
      const idx = rowOffset + x * 4;
      buf[idx] = 10;          // R
      buf[idx + 1] = grad;    // G
      buf[idx + 2] = grad + 15; // B
      buf[idx + 3] = 255;     // A
    }
  }
  return buf;
}
const standbyFrame = createStandbyBuffer();

async function initNdi(sourceName = NDI_SOURCE_NAME) {
  try {
    if (ndiSender) {
      try { ndiSender.destroy(); } catch (e) {}
    }
    console.log(`[NDI] 📡 Inizializzazione sorgente NDI: "${sourceName}"...`);
    ndiSender = await grandi.send({
      name: sourceName,
      clockVideo: false,
      clockAudio: false
    });
    console.log(`[NDI] ✅ Sorgente NDI attiva sulla rete: ${ndiSender.sourceName()}`);

    // Invia subito un frame per registrare il canale in rete
    await sendStandbyFrame();
    startIdleLoop();
    return true;
  } catch (err) {
    console.error('[NDI] ❌ Errore durante la creazione della sorgente NDI:', err);
    return false;
  }
}

async function sendStandbyFrame() {
  if (!ndiSender || isLiveClientStreaming) return;
  try {
    await ndiSender.video({
      xres: WIDTH,
      yres: HEIGHT,
      frameRateN: DEFAULT_FPS,
      frameRateD: 1,
      pictureAspectRatio: 16 / 9,
      fourCC: grandi.FourCC.RGBA,
      frameFormatType: 1,
      lineStrideBytes: WIDTH * 4,
      data: standbyFrame
    });
  } catch (e) {}
}

function startIdleLoop() {
  if (idleInterval) clearInterval(idleInterval);
  idleInterval = setInterval(() => {
    if (!isLiveClientStreaming && ndiSender) {
      sendStandbyFrame();
    }
  }, 1000);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/status') {
    const connections = ndiSender && typeof ndiSender.connections === 'function' ? ndiSender.connections() : 0;
    const tally = ndiSender && typeof ndiSender.tally === 'function' ? ndiSender.tally() : { onProgram: false, onPreview: false };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sourceName: ndiSender ? ndiSender.sourceName() : NDI_SOURCE_NAME,
      active: !!ndiSender,
      streaming: isLiveClientStreaming,
      connections,
      tally,
      fps: measuredFps,
      width: WIDTH,
      height: HEIGHT
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[NDI-WS] 🔌 Client 3D connesso al server NDI');
  activeWsClient = ws;
  ws.binaryType = 'nodebuffer';

  const sendStatus = () => {
    if (ws.readyState !== ws.OPEN) return;
    const connections = ndiSender && typeof ndiSender.connections === 'function' ? ndiSender.connections() : 0;
    const tally = ndiSender && typeof ndiSender.tally === 'function' ? ndiSender.tally() : { onProgram: false, onPreview: false };
    ws.send(JSON.stringify({
      type: 'ndi_status',
      sourceName: ndiSender ? ndiSender.sourceName() : NDI_SOURCE_NAME,
      active: !!ndiSender,
      streaming: isLiveClientStreaming,
      connections,
      tally,
      fps: measuredFps,
      width: WIDTH,
      height: HEIGHT
    }));
  };

  sendStatus();
  const statusInterval = setInterval(sendStatus, 1000);

  ws.on('message', async (message, isBinary) => {
    if (!isBinary) {
      try {
        const text = message.toString();
        const data = JSON.parse(text);
        if (data.type === 'config') {
          if (data.fps) currentFps = data.fps;
          if (data.sourceName && (!ndiSender || ndiSender.sourceName() !== data.sourceName)) {
            await initNdi(data.sourceName);
          }
        }
      } catch (e) {}
      return;
    }

    if (!ndiSender) return;

    try {
      frameCount++;
      const now = Date.now();
      if (now - lastFpsTime >= 1000) {
        measuredFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
      }

      isLiveClientStreaming = true;

      // Trasmette il frame 1080p in NDI
      await ndiSender.video({
        xres: WIDTH,
        yres: HEIGHT,
        frameRateN: currentFps,
        frameRateD: 1,
        pictureAspectRatio: 16 / 9,
        fourCC: grandi.FourCC.RGBA,
        frameFormatType: 1,
        lineStrideBytes: WIDTH * 4,
        data: message
      });
    } catch (err) {
      console.error('[NDI] Errore invio frame:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[NDI-WS] Client 3D disconnesso');
    clearInterval(statusInterval);
    isLiveClientStreaming = false;
    if (activeWsClient === ws) activeWsClient = null;
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[NDI] ⚠️ Porta ${WS_PORT} occupata. Tentativo di riavvio in corso...`);
  } else {
    console.error('[NDI] Errore server HTTP/WS:', err);
  }
});

server.listen(WS_PORT, async () => {
  console.log(`[NDI-Server] Bridge NDI attivo su ws://localhost:${WS_PORT}`);
  await initNdi();
});

process.on('SIGINT', () => {
  if (idleInterval) clearInterval(idleInterval);
  if (ndiSender) {
    try { ndiSender.destroy(); } catch (e) {}
  }
  process.exit(0);
});
