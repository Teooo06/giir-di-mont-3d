const statusEl = document.querySelector('#status');
const hostInfo = document.querySelector('#host-mini') || document.querySelector('#host-info');
const wsInfo = document.querySelector('#ws-info');
const btnActivate = document.querySelector('#btn-activate');
const timelineSlider = document.querySelector('#timeline-slider');
const timelineVal = document.querySelector('#timeline-val');
const btnPlay = document.querySelector('#btn-play');
const zoomSlider = document.querySelector('#zoom-slider');
const zoomVal = document.querySelector('#zoom-val');
const speedSlider = document.querySelector('#speed-slider');
const speedVal = document.querySelector('#speed-val');
let speedMult = 1.0;

let ws = null;
let active = false;
let wsReady = false;

function getWsUrl() {
  const host = location.hostname || 'localhost';
  const port = 9998;
  return `ws://${host}:${port}`;
}

function setStatus(msg, ok = false) {
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.style.color = ok ? '#8f8' : '#f88';
  }
}

function connectWs() {
  const url = getWsUrl();
  if (wsInfo) wsInfo.textContent = url;
  if (hostInfo) hostInfo.textContent = `${location.protocol}//${location.hostname || 'localhost'}:${location.port || '5173'}/controller.html`;
  setStatus('connessione...');
  try {
    ws = new WebSocket(url);
    ws.onopen = () => {
      wsReady = true;
      setStatus(active ? 'connesso + attivo' : 'connesso (premi Attiva)', true);
    };
    ws.onclose = () => {
      wsReady = false;
      setStatus('disconnesso');
      setTimeout(connectWs, 1500);
    };
    ws.onerror = () => setStatus('errore WS');
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'ndi_status' && data.sourceName) {
          // ignore
        }
      } catch {}
    };
  } catch (e) {
    setStatus('errore');
  }
}
connectWs();

function send(payload) {
  if (!active || !wsReady || !ws || ws.readyState !== WebSocket.OPEN) {
    // still try BroadcastChannel for same-device
    try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', ...payload }); } catch {}
    if (!active) return;
    if (!wsReady) {
      // still allow BroadcastChannel even if WS not ready
      return;
    }
    return;
  }
  try { ws.send(JSON.stringify({ type: 'controller', ...payload })); } catch {}
  // also broadcast locally for same-device testing
  try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', ...payload }); } catch {}
}

btnActivate?.addEventListener('click', () => {
  active = !active;
  btnActivate.textContent = active ? '⏹️ Disattiva Controllo' : '▶️ Attiva Controllo';
  btnActivate.classList.toggle('active', active);
  setStatus(active ? (wsReady ? 'connesso + attivo' : 'attivo (in attesa WS)') : (wsReady ? 'connesso (pausa)' : 'disconnesso'), wsReady && active);
  try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'activate', active }); } catch {}
  // also send via WS
  if (wsReady) {
    try { ws.send(JSON.stringify({ type: 'controller', action: 'activate', active })); } catch {}
  }
});

// Scene buttons
document.querySelectorAll('[data-scene]').forEach(btn => {
  btn.addEventListener('click', () => {
    const scene = btn.dataset.scene;
    send({ action: 'scene', scene });
  });
});

// Timeline
timelineSlider?.addEventListener('input', (e) => {
  const km = parseFloat(e.target.value);
  if (timelineVal) timelineVal.textContent = `${km.toFixed(1)} km`;
  send({ action: 'timeline', km });
});
btnPlay?.addEventListener('click', () => {
  send({ action: 'playpause' });
});
// ZOOM slider — invertito (dx = zoom in) + range 40-1200
zoomSlider?.addEventListener('input', (e) => {
  const raw = parseFloat(e.target.value);
  const dist = 1240 - raw + 40; // inverti: slider dx (1200) -> dist 40 (vicino)
  if (zoomVal) zoomVal.textContent = dist.toFixed(0);
  send({ action: 'zoom', dist });
});
// init zoom display invertito
if (zoomSlider && zoomVal) {
  const raw = parseFloat(zoomSlider.value);
  zoomVal.textContent = (1240 - raw + 40).toFixed(0);
}
speedSlider?.addEventListener('input', (e) => {
  speedMult = parseFloat(e.target.value);
  if (speedVal) speedVal.textContent = speedMult.toFixed(1) + '×';
  send({ action: 'speed', value: speedMult });
});

// Joystick helper — multi-touch safe via Pointer Events + pointerId per joystick
function makeJoystick(baseEl, stickEl, onMove) {
  const maxDist = 60;
  let dragging = false;
  let activePointerId = null;
  let raf = null;

  function setStick(clientX, clientY) {
    const rect = baseEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      const a = Math.atan2(dy, dx);
      dx = Math.cos(a) * maxDist;
      dy = Math.sin(a) * maxDist;
    }
    stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / maxDist;
    const ny = -dy / maxDist;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => onMove(nx, ny));
  }
  function resetStick() {
    stickEl.style.transform = 'translate(0, 0)';
    onMove(0, 0);
  }

  baseEl.addEventListener('pointerdown', (e) => {
    if (!active) {
      // hint: need to activate first
      setStatus('premi Attiva prima', false);
      return;
    }
    if (dragging) return; // already dragging this stick
    dragging = true;
    activePointerId = e.pointerId;
    try { baseEl.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    setStick(e.clientX, e.clientY);
  });
  // Use window for move/up so we track even outside base
  window.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    setStick(e.clientX, e.clientY);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('pointerup', (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    try { baseEl.releasePointerCapture(e.pointerId); } catch {}
    resetStick();
  });
  window.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    resetStick();
  });
  // Prevent scrolling/zooming on the joystick area
  baseEl.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  baseEl.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

const joyLeft = document.querySelector('#joy-left');
const stickLeft = document.querySelector('#stick-left');
const joyRight = document.querySelector('#joy-right');
const stickRight = document.querySelector('#stick-right');

if (joyLeft && stickLeft) {
  makeJoystick(joyLeft, stickLeft, (x, y) => {
    send({ action: 'orbit', x: x * speedMult, y: y * speedMult });
  });
}
if (joyRight && stickRight) {
  makeJoystick(joyRight, stickRight, (x, y) => {
    send({ action: 'pan', x: x * speedMult, y: y * speedMult });
  });
}

// Keep timeline in sync if main broadcasts via controller channel (optional)
try {
  const ch = new BroadcastChannel('giir_controller_channel');
  ch.onmessage = (e) => {
    const d = e.data;
    if (!d || d.type !== 'controller_sync') return;
    if (d.timeline !== undefined && timelineSlider) {
      timelineSlider.value = d.timeline;
      if (timelineVal) timelineVal.textContent = `${Number(d.timeline).toFixed(1)} km`;
    }
  };
} catch {}
