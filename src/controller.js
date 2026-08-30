const statusEl = document.querySelector('#status');
const hostInfo = document.querySelector('#host-info');
const wsInfo = document.querySelector('#ws-info');
const btnActivate = document.querySelector('#btn-activate');
const timelineSlider = document.querySelector('#timeline-slider');
const timelineVal = document.querySelector('#timeline-val');
const btnPlay = document.querySelector('#btn-play');

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
  if (!active || !wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;
  try { ws.send(JSON.stringify({ type: 'controller', ...payload })); } catch {}
}

btnActivate?.addEventListener('click', () => {
  active = !active;
  btnActivate.textContent = active ? '⏹️ Disattiva Controllo' : '▶️ Attiva Controllo';
  btnActivate.classList.toggle('active', active);
  setStatus(active ? (wsReady ? 'connesso + attivo' : 'attivo (in attesa WS)') : (wsReady ? 'connesso (pausa)' : 'disconnesso'), wsReady && active);
  if (active) {
    // also notify main via BroadcastChannel for same-device testing (controller aperto su stesso PC)
    try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'activate', active: true }); } catch {}
  }
});

// Scene buttons
document.querySelectorAll('[data-scene]').forEach(btn => {
  btn.addEventListener('click', () => {
    const scene = btn.dataset.scene;
    send({ action: 'scene', scene });
    try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'scene', scene }); } catch {}
  });
});

// Timeline
timelineSlider?.addEventListener('input', (e) => {
  const km = parseFloat(e.target.value);
  if (timelineVal) timelineVal.textContent = `${km.toFixed(1)} km`;
  send({ action: 'timeline', km });
  try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'timeline', km }); } catch {}
});
btnPlay?.addEventListener('click', () => {
  send({ action: 'playpause' });
  try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'playpause' }); } catch {}
});

// Joystick helper
function makeJoystick(baseEl, stickEl, onMove) {
  const baseRect = () => baseEl.getBoundingClientRect();
  const maxDist = 60; // max stick travel
  let dragging = false;
  let activeTouchId = null;
  let raf = null;
  let lastX = 0, lastY = 0;

  function setStick(dx, dy) {
    const dist = Math.hypot(dx, dy);
    let nx = dx, ny = dy;
    if (dist > maxDist) {
      const a = Math.atan2(dy, dx);
      nx = Math.cos(a) * maxDist;
      ny = Math.sin(a) * maxDist;
    }
    stickEl.style.transform = `translate(${nx}px, ${ny}px)`;
    // normalize -1..1
    lastX = nx / maxDist;
    lastY = -ny / maxDist; // invert Y so up is +1
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => onMove(lastX, lastY));
  }
  function resetStick() {
    stickEl.style.transform = 'translate(0, 0)';
    lastX = 0; lastY = 0;
    onMove(0, 0);
  }
  function getPos(e) {
    const t = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    const r = baseRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { dx: t.clientX - cx, dy: t.clientY - cy };
  }
  function onDown(e) {
    if (!active) return;
    dragging = true;
    if (e.touches) activeTouchId = e.touches[0].identifier;
    baseEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    const { dx, dy } = getPos(e);
    setStick(dx, dy);
  }
  function onMoveRaw(e) {
    if (!dragging) return;
    if (e.touches && activeTouchId !== null) {
      let found = null;
      for (let i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === activeTouchId) found = e.touches[i];
      if (!found) return;
      const r = baseRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = found.clientX - cx, dy = found.clientY - cy;
      setStick(dx, dy);
    } else {
      const { dx, dy } = getPos(e);
      setStick(dx, dy);
    }
    e.preventDefault();
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    activeTouchId = null;
    resetStick();
  }
  // mouse + touch + pointer
  baseEl.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMoveRaw);
  window.addEventListener('pointerup', onUp);
  baseEl.addEventListener('touchstart', onDown, { passive: false });
  baseEl.addEventListener('touchmove', onMoveRaw, { passive: false });
  baseEl.addEventListener('touchend', onUp);
  baseEl.addEventListener('touchcancel', onUp);
}

const joyLeft = document.querySelector('#joy-left');
const stickLeft = document.querySelector('#stick-left');
const joyRight = document.querySelector('#joy-right');
const stickRight = document.querySelector('#stick-right');

if (joyLeft && stickLeft) {
  makeJoystick(joyLeft, stickLeft, (x, y) => {
    // left: orbit
    send({ action: 'orbit', x, y });
    try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'orbit', x, y }); } catch {}
  });
}
if (joyRight && stickRight) {
  makeJoystick(joyRight, stickRight, (x, y) => {
    // right: x=pan, y=zoom
    send({ action: 'zoompan', x, y });
    try { new BroadcastChannel('giir_controller_channel').postMessage({ type: 'controller', action: 'zoompan', x, y }); } catch {}
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
