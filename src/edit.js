import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { TerrainManager } from './terrain-manager.js';
import { EditHistory } from './edit/history.js';
import { VersionManager } from './version-manager.js';
import { RaceManager } from './race-manager.js';
import { SettingsManager } from './settings-manager.js';
import { ElevationProfile } from './elevation-profile.js';
import { createArch, placeArchAtRoute } from './models/arch.js';
import './style.css';

// EDIT-01 scaffolding: read-only world viewer for /edit (locale only, no NDI)

// 1. SCENA
const canvas = document.querySelector('#world');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#94b5c7');
scene.fog = new THREE.FogExp2('#9dbecd', 0.00068);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 2, 9000);
camera.position.set(0, 480, 760);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 70, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 40;
controls.maxDistance = 2600;
controls.maxPolarAngle = Math.PI * 0.485;

// EDIT-05: TransformControls per arco — guard definitivo
let archGuardConfirmed = false;
const archControls = new TransformControls(camera, renderer.domElement);
archControls.addEventListener('dragging-changed', (e) => {
  controls.enabled = !e.value;
  if (e.value) {
    const isDefinitivo = archGroup && Math.abs(archGroup.rotation.y - THREE.MathUtils.degToRad(120)) < 0.01 && Math.abs(archGroup.rotation.z - THREE.MathUtils.degToRad(-25)) < 0.01;
    if (isDefinitivo && !archGuardConfirmed) {
      if (!confirm('Arco in posizione definitiva master (120°/-25°). Modificare? OK=procedi, Annulla=blocca')) {
        archControls.detach(); archControls.enabled = false; controls.enabled = true; return;
      }
      archGuardConfirmed = true;
    }
    pushHistory();
  }
});
archControls.addEventListener('change', () => {
  if (archGroup) {
    const g = terrainManager.getElevationAtWorld(archGroup.position.x, archGroup.position.z);
    if (archGroup.position.y < g + 0.5) archGroup.position.y = g + 0.5;
    const el = document.querySelector('#edit-arch-info');
    if (el) el.innerHTML = `pos: ${archGroup.position.x.toFixed(1)}, ${archGroup.position.y.toFixed(1)}, ${archGroup.position.z.toFixed(1)}<br>rot: ${THREE.MathUtils.radToDeg(archGroup.rotation.x).toFixed(1)}° / ${THREE.MathUtils.radToDeg(archGroup.rotation.y).toFixed(1)}° / ${THREE.MathUtils.radToDeg(archGroup.rotation.z).toFixed(1)}°<br><small>drag gizmo: W translate, E rotate, R scale | confermato solo su Esporta</small>`;
  }
});
scene.add(archControls);
// arch mode buttons (W/E/R) also handled via keyboard

// Luci
scene.add(new THREE.HemisphereLight('#f2f8ff', '#2d3b32', 2.2));
const sun = new THREE.DirectionalLight('#ffffff', 3.2);
sun.position.set(-560, 920, 460);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -950;
sun.shadow.camera.right = sun.shadow.camera.top = 950;
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 2800;
sun.shadow.bias = -0.0001;
scene.add(sun);

// 2. GESTORI
const settingsManager = new SettingsManager();
const terrainManager = new TerrainManager({ scene, style: settingsManager.settings.terrainStyle, verticalExaggeration: settingsManager.settings.verticalExaggeration });
const elevationProfile = new ElevationProfile('#elevation-profile-container', { accentColor: settingsManager.settings.themeColor });
const raceManager = new RaceManager({ onStateChange: () => {} });
const editHistory = new EditHistory(100);
const versionManager = new VersionManager();
let autoVersionDebounce = null;

// EDIT-07: snapshot helpers
function captureEditState() {
  const arch = archGroup ? { pos: archGroup.position.toArray(), rot: [archGroup.rotation.x, archGroup.rotation.y, archGroup.rotation.z], scale: archGroup.scale.toArray(), params: { height: 7, width: 8, tubeRadius: 1.6 } } : null;
  let trees = [];
  if (treesMesh) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < treesMesh.count; i++) { treesMesh.getMatrixAt(i, m); trees.push(m.toArray()); }
  }
  return { rawTrackPoints: JSON.parse(JSON.stringify(rawTrackPoints)), checkpoints: JSON.parse(JSON.stringify(raceManager.checkpoints)), arch, trees };
}
function isValidTrackForVersion(points) {
  if (!points || points.length < 500) return false;
  const toRad = (d) => d * Math.PI / 180;
  const hav = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  let total = 0, maxJump = 0;
  for (let i = 1; i < points.length; i++) {
    const d = hav(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    total += d;
    if (d > maxJump) maxJump = d;
    if (d > 800) return false;
  }
  if (total < 20000 || total > 50000) return false;
  if (maxJump > 500) return false;
  return true;
}
function correctTrackDirection(points, checkpoints) {
  if (!points || points.length < 2 || !checkpoints || checkpoints.length < 2) return points;
  const toRad = (d) => d * Math.PI / 180;
  const hav = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  const cps = [...checkpoints].sort((a, b) => a.km - b.km);
  const findIdx = (track, lat, lon) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < track.length; i++) {
      const d = hav(lat, lon, track[i].lat, track[i].lon);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };
  const scoreFor = (track) => {
    const idxs = cps.map(cp => findIdx(track, cp.lat, cp.lon));
    const startIdx = idxs[0];
    const rotated = idxs.map(idx => (idx - startIdx + track.length) % track.length);
    let score = 0;
    for (let i = 1; i < rotated.length; i++) if (rotated[i] > rotated[i - 1]) score++;
    return score;
  };
  const scoreOrig = scoreFor(points);
  const rev = [...points].reverse();
  const scoreRev = scoreFor(rev);
  if (scoreRev > scoreOrig) return rev;
  return points;
}
function restoreEditState(s) {
  if (!s) return;
  if (s.rawTrackPoints) {
    let cand = JSON.parse(JSON.stringify(s.rawTrackPoints));
    cand = correctTrackDirection(cand, s.checkpoints || raceManager.checkpoints);
    if (!isValidTrackForVersion(cand)) {
      console.warn('[Edit] snapshot corrotto, ignoro rawTrackPoints');
    } else {
      rawTrackPoints = cand;
    }
  }
  if (s.checkpoints) { raceManager.checkpoints = JSON.parse(JSON.stringify(s.checkpoints)); raceManager.checkpoints.sort((a,b)=>a.km-b.km); }
  // arch will be reapplied after rebuildTrack3D
  const archSnap = s.arch;
  if (s.trees && s.trees.length) {
    const count = s.trees.length;
    const treeGeo = new THREE.ConeGeometry(2.4, 11, 5); treeGeo.translate(0, 5.5, 0);
    const treeMat = new THREE.MeshStandardMaterial({ color: '#1a3826', roughness: 0.9, metalness: 0.0 });
    const newMesh = new THREE.InstancedMesh(treeGeo, treeMat, count);
    const m = new THREE.Matrix4();
    s.trees.forEach((arr, i) => { m.fromArray(arr); newMesh.setMatrixAt(i, m); });
    newMesh.instanceMatrix.needsUpdate = true; newMesh.castShadow = true; newMesh.receiveShadow = true;
    if (treesMesh) { scene.remove(treesMesh); treesMesh.geometry.dispose(); }
    treesMesh = newMesh; scene.add(treesMesh);
  }
  rebuildTrack3D();
  // reapply arch pos/rot after rebuild (which resets to definitivo)
  if (archSnap && archGroup) {
    archGroup.position.fromArray(archSnap.pos);
    archGroup.rotation.set(archSnap.rot[0], archSnap.rot[1], archSnap.rot[2]);
    archGroup.scale.fromArray(archSnap.scale);
    if (document.querySelector('#tab-arch')?.classList.contains('active')) archControls.attach(archGroup);
  }
  renderTreesInfo();
  renderGpxTable();
  renderCheckpointTable();
  const st = document.querySelector('#edit-status');
  if (st) st.textContent = 'stato ripristinato';
}
function pushHistory() {
  try {
    const snap = captureEditState();
    if (!isValidTrackForVersion(snap.rawTrackPoints)) {
      console.warn('[Edit] track non valido, non creo versione');
      updateHistoryUI();
      return;
    }
    editHistory.push(snap);
    updateHistoryUI();
    clearTimeout(autoVersionDebounce);
    autoVersionDebounce = setTimeout(() => {
      try {
        if (!isValidTrackForVersion(snap.rawTrackPoints)) return;
        versionManager.createVersion(snap, `auto ${new Date().toLocaleTimeString('it-IT')}`);
        try { new BroadcastChannel('giir_version_channel').postMessage({ type: 'VERSION_UPDATED' }); } catch {}
        updateHistoryUI();
      } catch {}
    }, 2000);
  } catch {}
}
function updateHistoryUI() {
  const u = document.querySelector('#btn-undo'); const u2 = document.querySelector('#btn-undo2');
  const r = document.querySelector('#btn-redo'); const r2 = document.querySelector('#btn-redo2');
  const canU = editHistory.canUndo(); const canR = editHistory.canRedo();
  [u, u2].forEach(b => { if (b) { b.disabled = !canU; b.style.opacity = canU ? '1' : '0.4'; }});
  [r, r2].forEach(b => { if (b) { b.disabled = !canR; b.style.opacity = canR ? '1' : '0.4'; }});
  const st = document.querySelector('#edit-status');
  const verCount = versionManager.list().length;
  if (st) st.textContent = `undo:${editHistory.undoStack.length} redo:${editHistory.redoStack.length} · versioni:${verCount} · auto-save`;
}
function saveEditLocal() {
  try {
    const snap = captureEditState();
    if (!isValidTrackForVersion(snap.rawTrackPoints)) { alert('Track non valido (salto >800m o lunghezza anomala) — non salvo. Correggi i punti prima.'); return; }
    localStorage.setItem('giir_edit_v1', JSON.stringify(snap));
    versionManager.createVersion(snap, `salvataggio manuale ${new Date().toLocaleTimeString('it-IT')}`);
    try { new BroadcastChannel('giir_version_channel').postMessage({ type: 'VERSION_UPDATED' }); } catch {}
    const st = document.querySelector('#edit-status');
    if (st) st.textContent = 'salvato versione ' + new Date().toLocaleTimeString();
    updateHistoryUI();
  } catch (e) { console.warn('save fail', e); }
}
function loadEditLocal() {
  try {
    const latest = versionManager.getLatest();
    if (latest && latest.snapshot) return latest.snapshot;
    const raw = localStorage.getItem('giir_edit_v1');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function doUndo() { const cur = captureEditState(); const prev = editHistory.undo(cur); if (prev) { restoreEditState(prev); updateHistoryUI(); } }
function doRedo() { const cur = captureEditState(); const nxt = editHistory.redo(cur); if (nxt) { restoreEditState(nxt); updateHistoryUI(); } }
function exportEdit() {
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?><gpx creator="Giir Editor" version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Giir di Mont 32km Edited</name><trkseg>`;
  const gpxFooter = `</trkseg></trk></gpx>`;
  const gpxBody = rawTrackPoints.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele></trkpt>`).join('');
  const gpxText = gpxHeader + gpxBody + gpxFooter;
  const blobGpx = new Blob([gpxText], { type: 'application/gpx+xml' });
  const aGpx = document.createElement('a'); aGpx.href = URL.createObjectURL(blobGpx); aGpx.download = 'giir-di-mont-32-km.gpx'; aGpx.click();
  const cpBlob = new Blob([JSON.stringify(raceManager.checkpoints, null, 2)], { type: 'application/json' });
  const aCp = document.createElement('a'); aCp.href = URL.createObjectURL(cpBlob); aCp.download = 'checkpoints.json'; setTimeout(()=>aCp.click(), 300);
  const archData = archGroup ? { position: archGroup.position.toArray(), rotation: [archGroup.rotation.x, archGroup.rotation.y, archGroup.rotation.z], scale: archGroup.scale.toArray() } : null;
  const archBlob = new Blob([JSON.stringify(archData, null, 2)], { type: 'application/json' });
  const aArch = document.createElement('a'); aArch.href = URL.createObjectURL(archBlob); aArch.download = 'arch.json'; setTimeout(()=>aArch.click(), 600);
  const snap = captureEditState();
  const tBlob = new Blob([JSON.stringify(snap.trees)], { type: 'application/json' });
  const aT = document.createElement('a'); aT.href = URL.createObjectURL(tBlob); aT.download = 'trees.json'; setTimeout(()=>aT.click(), 900);
  const st = document.querySelector('#edit-status'); if (st) st.textContent = 'esportato GPX + checkpoints + arch + trees (copia in public/data/ + git commit)';
}

// 3. FORESTA
let treesMesh = null;
function generateAlpineForest() {
  if (treesMesh) { scene.remove(treesMesh); treesMesh.geometry.dispose(); }
  const count = 600;
  const treeGeo = new THREE.ConeGeometry(2.4, 11, 5);
  treeGeo.translate(0, 5.5, 0);
  const treeMat = new THREE.MeshStandardMaterial({ color: '#1a3826', roughness: 0.9, metalness: 0.0 });
  treesMesh = new THREE.InstancedMesh(treeGeo, treeMat, count);
  const dummy = new THREE.Object3D();
  let planted = 0;
  const minX = -480, maxX = 480, minZ = -400, maxZ = 400;
  for (let i = 0; i < count * 3 && planted < count; i++) {
    const x = minX + Math.random() * (maxX - minX);
    const z = minZ + Math.random() * (maxZ - minZ);
    const y = terrainManager.getElevationAtWorld(x, z);
    const realEle = (y / (0.1 * settingsManager.settings.verticalExaggeration)) + terrainManager.baseElevation;
    if (realEle > 650 && realEle < 1650) {
      const scale = 0.55 + Math.random() * 0.75;
      dummy.position.set(x, y - 0.2, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      treesMesh.setMatrixAt(planted, dummy.matrix);
      planted++;
    }
  }
  treesMesh.instanceMatrix.needsUpdate = true;
  treesMesh.castShadow = true;
  treesMesh.receiveShadow = true;
  scene.add(treesMesh);
  renderTreesInfo();
}

// 4. TRACCIATO + CHECKPOINT + ARCO
let rawTrackPoints = [];
let routeCurve = null;
let routeLine = null;
let cachedWorldPoints = [];
let labels = [];
const checkpointGroup = new THREE.Group();
scene.add(checkpointGroup);
let archGroup = null;

// EDIT-02: GPX handles
const gpxHandlesGroup = new THREE.Group();
scene.add(gpxHandlesGroup);
let gpxHandles = [];
let selectedGpx = new Set();
let isDraggingGpx = false;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragOffset = new THREE.Vector3();
const dragStartPositions = new Map(); // index -> Vector3 start pos
let activeHandle = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let rebuildDebounce = null;
const gpxHandleGeo = new THREE.SphereGeometry(1.0, 8, 6);
const gpxHandleMat = new THREE.MeshBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.85 });
const gpxHandleMatSelected = new THREE.MeshBasicMaterial({ color: '#ffea00', transparent: true, opacity: 1.0 });
// EDIT-04: checkpoint drag
let selectedCpIdx = null;
let isDraggingCp = false;
let activeCpMesh = null;
const cpDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cpDragOffset = new THREE.Vector3();
const cpPickMat = new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.9 });
// EDIT-06: trees
let selectedTrees = new Set();
let isDraggingTree = false;
let activeTreeId = null;
const treeDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const treeDragOffset = new THREE.Vector3();
const treeDragStarts = new Map(); // instanceId -> Vector3
let treeAddMode = false;

function createCheckpointLabelSprite(name, km, themeColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const boxH = 110;
  ctx.fillStyle = 'rgba(14,20,23,0.92)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, boxH, 10); ctx.fill();
  ctx.fillStyle = themeColor; ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 34px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), w / 2, 38);
  ctx.fillStyle = '#f6f4e9'; ctx.font = '700 20px DM Sans, sans-serif';
  ctx.fillText(`${km} km · checkpoint`, w / 2, 76);
  ctx.strokeStyle = themeColor; ctx.lineWidth = 6; ctx.shadowColor = themeColor; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(w / 2, boxH); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(80, 25, 1);
  return sprite;
}
function clearCheckpoints() {
  labels.forEach(({ sprite, marker, dot }) => {
    if (sprite) { if (sprite.material.map) sprite.material.map.dispose(); sprite.material.dispose(); }
    if (marker) { if (marker.geometry) marker.geometry.dispose(); if (marker.material) marker.material.dispose(); }
    if (dot) { if (dot.geometry) dot.geometry.dispose(); if (dot.material) dot.material.dispose(); }
  });
  checkpointGroup.clear(); labels = [];
}
function add3DCheckpoint(id, name, km, worldPos, isStart = false, isFinish = false) {
  const cpIdx = raceManager.checkpoints.findIndex(c => c.id === id);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshBasicMaterial({ color: isStart || isFinish ? '#ffffff' : settingsManager.settings.themeColor }));
  marker.position.copy(worldPos); marker.position.y += 3.5; marker.userData.cpIdx = cpIdx; marker.userData.isCp = true; checkpointGroup.add(marker);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: settingsManager.settings.themeColor }));
  dot.position.copy(worldPos); dot.position.y += 1.2; dot.userData.cpIdx = cpIdx; dot.userData.isCp = true; checkpointGroup.add(dot);
  const sprite = createCheckpointLabelSprite(name, km, settingsManager.settings.themeColor);
  sprite.position.copy(worldPos).add(new THREE.Vector3(0, 18, 0)); checkpointGroup.add(sprite);
  labels.push({ sprite, marker, dot, point: worldPos.clone().add(new THREE.Vector3(0, 10, 0)), cpIdx });
}
function updateGpxHandles() {
  if (isDraggingGpx) return;
  gpxHandles.forEach(h => gpxHandlesGroup.remove(h));
  gpxHandles = [];
  if (!rawTrackPoints.length) return;
  // Decimate for performance: if >800 points show every 2nd, >1500 every 3rd
  let step = 1;
  if (rawTrackPoints.length > 1500) step = 3;
  else if (rawTrackPoints.length > 800) step = 2;
  for (let i = 0; i < rawTrackPoints.length; i += step) {
    const p = rawTrackPoints[i];
    const w = terrainManager.coordToWorld(p.lat, p.lon, p.ele);
    const ground = terrainManager.getElevationAtWorld(w.x, w.z);
    w.y = Math.max(w.y, ground + 1.8);
    const isSel = selectedGpx.has(i);
    const h = new THREE.Mesh(gpxHandleGeo, isSel ? gpxHandleMatSelected : gpxHandleMat);
    h.position.copy(w);
    h.userData.index = i;
    h.userData.step = step;
    h.visible = document.querySelector('#tab-gpx')?.classList.contains('active') ?? true;
    gpxHandlesGroup.add(h);
    gpxHandles.push(h);
  }
  gpxHandles.forEach(h => {
    h.material = selectedGpx.has(h.userData.index) ? gpxHandleMatSelected : gpxHandleMat;
  });
}
function scheduleRebuild() {
  clearTimeout(rebuildDebounce);
  rebuildDebounce = setTimeout(() => rebuildTrack3D(), 80);
}
function findNearestKmForWorld(worldPos) {
  if (!routeCurve) return 0;
  let bestRatio = 0, bestDist = Infinity;
  const samples = 1000;
  for (let i = 0; i <= samples; i++) {
    const r = i / samples;
    const pt = routeCurve.getPointAt(r);
    const d = pt.distanceTo(worldPos);
    if (d < bestDist) { bestDist = d; bestRatio = r; }
  }
  return bestRatio * raceManager.totalKm;
}
function renderCheckpointTable() {
  const c = document.querySelector('#edit-cp-list');
  if (!c) return;
  let html = `<div style="font:11px monospace; opacity:0.7; margin-bottom:6px;">${raceManager.checkpoints.length} checkpoint · click riga per selezionare · drag sfera verde in 3D</div>`;
  html += `<div style="max-height:360px; overflow:auto; border:1px solid #333;"><table style="width:100%; font:11px monospace; border-collapse:collapse;"><thead><tr style="position:sticky; top:0; background:#1a1a1a;"><th style="padding:2px; border:1px solid #333;">#</th><th style="padding:2px; border:1px solid #333;">nome</th><th style="padding:2px; border:1px solid #333;">km</th><th style="padding:2px; border:1px solid #333;">lat</th><th style="padding:2px; border:1px solid #333;">lon</th><th style="padding:2px; border:1px solid #333;">ele</th></tr></thead><tbody>`;
  raceManager.checkpoints.forEach((cp, idx) => {
    const sel = selectedCpIdx === idx ? ' style="background:#332a00;"' : '';
    html += `<tr${sel} data-cp-idx="${idx}" style="cursor:pointer;"><td style="padding:2px; border:1px solid #222; text-align:right;">${idx}</td><td style="padding:1px; border:1px solid #222;"><input data-cp-field="name" data-cp-idx="${idx}" value="${cp.name}" style="width:120px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td><td style="padding:1px; border:1px solid #222;"><input data-cp-field="km" data-cp-idx="${idx}" value="${cp.km}" style="width:56px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td><td style="padding:1px; border:1px solid #222;"><input data-cp-field="lat" data-cp-idx="${idx}" value="${cp.lat.toFixed(6)}" style="width:84px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td><td style="padding:1px; border:1px solid #222;"><input data-cp-field="lon" data-cp-idx="${idx}" value="${cp.lon.toFixed(6)}" style="width:84px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td><td style="padding:1px; border:1px solid #222;"><input data-cp-field="ele" data-cp-idx="${idx}" value="${cp.ele}" style="width:64px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td></tr>`;
  });
  html += `</tbody></table></div>`;
  c.innerHTML = html;
  c.querySelectorAll('input[data-cp-field]').forEach(inp => {
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.cpIdx);
      const field = e.target.dataset.cpField;
      const cp = raceManager.checkpoints[idx];
      if (!cp) return;
      pushHistory();
      if (field === 'name') cp.name = e.target.value;
      else if (field === 'km') { const v = Number(e.target.value); if (Number.isFinite(v)) cp.km = v; }
      else if (field === 'lat' || field === 'lon' || field === 'ele') { const v = Number(e.target.value); if (Number.isFinite(v)) cp[field] = v; }
      scheduleRebuild();
    });
  });
  c.querySelectorAll('tr[data-cp-idx]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      const idx = Number(tr.dataset.cpIdx);
      selectedCpIdx = idx;
      // highlight checkpoint marker
      labels.forEach((l, i) => {
        if (l.marker) l.marker.material.color.set(selectedCpIdx === l.cpIdx ? '#ffea00' : (raceManager.checkpoints[l.cpIdx]?.isStart || raceManager.checkpoints[l.cpIdx]?.isFinish ? '#ffffff' : settingsManager.settings.themeColor));
      });
      renderCheckpointTable();
      // focus camera on checkpoint if routeCurve exists
      if (routeCurve) {
        const cp = raceManager.checkpoints[idx];
        const ratio = Math.min(0.999, Math.max(0.001, cp.km / raceManager.totalKm));
        const pt = routeCurve.getPointAt(ratio);
        controls.target.copy(pt);
      }
    });
  });
}
function getTreePos(idx, target = new THREE.Vector3()) {
  if (!treesMesh) return target;
  const m = new THREE.Matrix4();
  treesMesh.getMatrixAt(idx, m);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  m.decompose(pos, quat, scl);
  return target.copy(pos);
}
function setTreePos(idx, pos) {
  if (!treesMesh) return;
  const m = new THREE.Matrix4();
  treesMesh.getMatrixAt(idx, m);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  m.decompose(p, q, s);
  p.copy(pos);
  const nm = new THREE.Matrix4();
  nm.compose(p, q, s);
  treesMesh.setMatrixAt(idx, nm);
  treesMesh.instanceMatrix.needsUpdate = true;
}
function renderTreesInfo() {
  const el = document.querySelector('#edit-trees-info');
  if (!el) return;
  const total = treesMesh ? treesMesh.count : 0;
  let html = `<div style="font:11px monospace; opacity:0.7;">${total} alberi · ${selectedTrees.size} selezionati</div>`;
  html += `<div style="display:flex; gap:6px; margin:6px 0;"><button id="btn-tree-delete" style="flex:1; background:#441; color:#fff; border:1px solid #633; padding:4px; font:11px monospace;">🗑️ Elimina selezionati</button><button id="btn-tree-add" style="flex:1; background:${treeAddMode?'#344':'#222'}; color:#ddd; border:1px solid #333; padding:4px; font:11px monospace;">${treeAddMode?'✖ Esci add':'➕ Modalità aggiunta'}</button></div>`;
  html += `<div style="font:11px monospace; opacity:0.6;">Shift+click multi · drag gruppo · click terreno per aggiungere (in modalità add) · Del cancella</div>`;
  if (selectedTrees.size) {
    const first = selectedTrees.values().next().value;
    const pos = getTreePos(first);
    const realEle = (pos.y / (0.1 * settingsManager.settings.verticalExaggeration)) + terrainManager.baseElevation;
    html += `<div style="margin-top:6px; font:11px monospace; background:#111; padding:4px; border:1px solid #333;">sel #${first}: x ${pos.x.toFixed(1)} z ${pos.z.toFixed(1)} y ${pos.y.toFixed(1)} ele ${realEle.toFixed(0)}m</div>`;
  }
  el.innerHTML = html;
  el.querySelector('#btn-tree-delete')?.addEventListener('click', deleteSelectedTrees);
  el.querySelector('#btn-tree-add')?.addEventListener('click', () => { treeAddMode = !treeAddMode; renderTreesInfo(); });
}
function deleteSelectedTrees() {
  if (!treesMesh || !selectedTrees.size) return;
  pushHistory();
  const keep = [];
  const dummy = new THREE.Object3D();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < treesMesh.count; i++) {
    if (selectedTrees.has(i)) continue;
    treesMesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    keep.push({ p: p.clone(), q: q.clone(), s: s.clone() });
  }
  // rebuild mesh with keep
  const count = keep.length;
  const treeGeo = new THREE.ConeGeometry(2.4, 11, 5);
  treeGeo.translate(0, 5.5, 0);
  const treeMat = new THREE.MeshStandardMaterial({ color: '#1a3826', roughness: 0.9, metalness: 0.0 });
  const newMesh = new THREE.InstancedMesh(treeGeo, treeMat, Math.max(count, 1));
  keep.forEach((k, i) => { dummy.position.copy(k.p); dummy.quaternion.copy(k.q); dummy.scale.copy(k.s); dummy.updateMatrix(); newMesh.setMatrixAt(i, dummy.matrix); });
  newMesh.instanceMatrix.needsUpdate = true;
  newMesh.castShadow = true; newMesh.receiveShadow = true;
  scene.remove(treesMesh); treesMesh.geometry.dispose();
  treesMesh = newMesh;
  if (count) scene.add(treesMesh);
  selectedTrees.clear();
  renderTreesInfo();
}
function addTreeAt(worldPos) {
  if (!treesMesh) return;
  pushHistory();
  const ground = terrainManager.getElevationAtWorld(worldPos.x, worldPos.z);
  const realEle = (ground / (0.1 * settingsManager.settings.verticalExaggeration)) + terrainManager.baseElevation;
  if (realEle < 650 || realEle > 1650) { alert('Fuori fascia bosco 650-1650m (ele '+realEle.toFixed(0)+'m)'); return; }
  const count = treesMesh.count;
  const newCount = count + 1;
  const treeGeo = new THREE.ConeGeometry(2.4, 11, 5);
  treeGeo.translate(0, 5.5, 0);
  const treeMat = new THREE.MeshStandardMaterial({ color: '#1a3826', roughness: 0.9, metalness: 0.0 });
  const newMesh = new THREE.InstancedMesh(treeGeo, treeMat, newCount);
  const dummy = new THREE.Object3D();
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) { treesMesh.getMatrixAt(i, m); newMesh.setMatrixAt(i, m); }
  const scale = 0.55 + Math.random() * 0.75;
  dummy.position.set(worldPos.x, ground - 0.2, worldPos.z);
  dummy.scale.set(scale, scale, scale);
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.updateMatrix();
  newMesh.setMatrixAt(count, dummy.matrix);
  newMesh.instanceMatrix.needsUpdate = true;
  newMesh.castShadow = true; newMesh.receiveShadow = true;
  scene.remove(treesMesh); treesMesh.geometry.dispose();
  treesMesh = newMesh;
  scene.add(treesMesh);
  selectedTrees.clear(); selectedTrees.add(count);
  renderTreesInfo();
}
function rebuildTrack3D() {
  if (rawTrackPoints.length < 2) return;
  function chaikinSmooth(points, iterations = 2) {
    if (iterations <= 0 || points.length < 2) return points.map(v => v.clone());
    let result = points.map(v => v.clone());
    for (let iter = 0; iter < iterations; iter++) {
      const next = [];
      for (let i = 0; i < result.length - 1; i++) {
        const p0 = result[i], p1 = result[i + 1];
        next.push(new THREE.Vector3(0.75 * p0.x + 0.25 * p1.x, 0.75 * p0.y + 0.25 * p1.y, 0.75 * p0.z + 0.25 * p1.z), new THREE.Vector3(0.25 * p0.x + 0.75 * p1.x, 0.25 * p0.y + 0.75 * p1.y, 0.25 * p0.z + 0.75 * p1.z));
      }
      result = next;
    }
    return result;
  }
  const rawWorldPoints = rawTrackPoints.map(p => {
    const v = terrainManager.coordToWorld(p.lat, p.lon, p.ele);
    const ground = terrainManager.getElevationAtWorld(v.x, v.z);
    v.y = Math.max(v.y, ground + 1.8);
    return v;
  });
  const useSmooth = settingsManager.settings.pathSmoothing !== false;
  const worldPoints = useSmooth ? chaikinSmooth(rawWorldPoints, 2) : rawWorldPoints;
  cachedWorldPoints = worldPoints.map(v => v.clone());
  if (routeLine) { scene.remove(routeLine); routeLine.geometry.dispose(); routeLine.material.dispose(); }
  const roughCurve = new THREE.CatmullRomCurve3(worldPoints, false, 'centripetal');
  const smoothPoints = roughCurve.getPoints(2000);
  routeCurve = new THREE.CatmullRomCurve3(smoothPoints, false, 'centripetal');
  const tubeGeo = new THREE.TubeGeometry(routeCurve, 1000, 1.1, 8, false);
  const posAttr = tubeGeo.attributes.position;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const trackStyle = settingsManager.settings.trackStyle || 'rainbow';
  const tHead = performance.now() * 0.0003;
  for (let i = 0; i < count; i++) {
    const ratio = i / count;
    let r, g, b;
    if (trackStyle === 'solid') {
      const tc = new THREE.Color(settingsManager.settings.trackTravelColor);
      r = tc.r; g = tc.g; b = tc.b;
    } else {
      const hue = ((ratio * 4 + tHead * 0.0001) % 1.0);
      const col = new THREE.Color().setHSL(hue, 1.0, 0.55);
      r = col.r; g = col.g; b = col.b;
    }
    // per EDIT-01: mostra tutto come "traveled" (nessun leader ratio)
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  routeLine = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }));
  scene.add(routeLine);
  clearCheckpoints();
  raceManager.checkpoints.forEach(cp => {
    const ratio = Math.min(0.999, Math.max(0.001, cp.km / raceManager.totalKm));
    const pt = routeCurve.getPointAt(ratio);
    add3DCheckpoint(cp.id, cp.name, cp.km.toFixed(1), pt, cp.isStart, cp.isFinish);
  });
  if (archGroup) { scene.remove(archGroup); archGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  archGroup = createArch({ height: 7, width: 8, tubeRadius: 1.6, color: '#ff1a1a' });
  const archRatio = Math.min(0.999, Math.max(0.001, 14.5 / raceManager.totalKm));
  placeArchAtRoute(archGroup, routeCurve, archRatio, terrainManager);
  archGroup.rotation.y += THREE.MathUtils.degToRad(120);
  archGroup.rotation.z += THREE.MathUtils.degToRad(-25);
  archGroup.rotation.x = THREE.MathUtils.degToRad(0);
  archGroup.position.y -= 5.0;
  archGroup.position.x -= 6.0;
  archGroup.position.z += 4.0;
  scene.add(archGroup);
  if (document.querySelector('#tab-arch')?.classList.contains('active')) archControls.attach(archGroup);
  if (elevationProfile && typeof elevationProfile.setTrackData === 'function') elevationProfile.setTrackData(rawTrackPoints, raceManager.checkpoints);
  updateGpxHandles();
  renderGpxTable();
  // update edit panels
  const gpxExtra = document.querySelector('#edit-gpx-list');
  // header info now inside renderGpxTable, keep extra info separate if needed
  void gpxExtra;
  const archInfo = document.querySelector('#edit-arch-info');
  if (archInfo && archGroup) archInfo.innerHTML = `pos: ${archGroup.position.x.toFixed(1)}, ${archGroup.position.y.toFixed(1)}, ${archGroup.position.z.toFixed(1)}<br>rot: y 120° z -25° x 0° (definitivo master)`;
  renderCheckpointTable();
  // highlight selected checkpoint marker
  labels.forEach(l => {
    if (l.marker && l.cpIdx === selectedCpIdx) l.marker.material.color.set('#ffea00');
  });
  renderTreesInfo();
}
function parseGpxAndBuild(xmlText, filename = 'giir-di-mont-32-km.gpx') {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('File GPX non valido.');
  rawTrackPoints = [...xml.querySelectorAll('trkpt')].map(node => ({ lat: Number(node.getAttribute('lat')), lon: Number(node.getAttribute('lon')), ele: Number(node.querySelector('ele')?.textContent || 960) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (rawTrackPoints.length < 2) throw new Error('Nessun punto traccia valido trovato.');
  rebuildTrack3D();
  generateAlpineForest();
  const trackStatus = document.querySelector('#track-status');
  if (trackStatus) trackStatus.textContent = `${filename} (${rawTrackPoints.length} punti)`;
}
async function initWorld() {
  const trackStatus = document.querySelector('#track-status');
  try {
    if (trackStatus) trackStatus.textContent = 'Caricamento terreno 3D di Premana...';
    await terrainManager.loadTerrain('/data/terrain-premana.json');
    if (trackStatus) trackStatus.textContent = 'Caricamento tracciato GPX...';
    const res = await fetch('/data/giir-di-mont-32-km.gpx');
    if (res.ok) {
      const gpxText = await res.text();
      parseGpxAndBuild(gpxText, 'Giir di Mont 32 km (Ufficiale)');
    }
  } catch (err) {
    console.error('Errore caricamento mondo 3D:', err);
    if (trackStatus) trackStatus.textContent = `Errore: ${err.message}`;
  }
}
initWorld();

document.querySelector('#gpx-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  try { parseGpxAndBuild(await file.text(), file.name); } catch (err) { alert(err.message); }
});

// Tabs — also toggle gpx handles / arch gizmo
document.querySelectorAll('.nav-tab').forEach(tab => {
  if (!tab.dataset.tab) return;
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.querySelector(`#${tab.dataset.tab}`);
    if (panel) panel.classList.add('active');
    const showGpx = tab.dataset.tab === 'tab-gpx';
    gpxHandles.forEach(h => h.visible = showGpx);
    gpxHandlesGroup.visible = showGpx;
    const showArch = tab.dataset.tab === 'tab-arch';
    if (showArch && archGroup) archControls.attach(archGroup); else archControls.detach();
    archControls.visible = showArch;
    archControls.enabled = showArch;
  });
});
// arch gizmo keyboard W/E/R + trees Delete
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (document.querySelector('#tab-arch')?.classList.contains('active')) {
    if (e.key.toLowerCase() === 'w') archControls.setMode('translate');
    if (e.key.toLowerCase() === 'e') archControls.setMode('rotate');
    if (e.key.toLowerCase() === 'r') archControls.setMode('scale');
  }
  if (document.querySelector('#tab-trees')?.classList.contains('active') && (e.key === 'Delete' || e.key === 'Backspace')) {
    deleteSelectedTrees();
  }
});

// EDIT-02: GPX drag — raycaster + plane
function getMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}
// EDIT-03 multi-select helpers
function getGpxHandleByIdx(idx) { return gpxHandles.find(h => h.userData.index === idx); }
function updateGpxSelectionUI() {
  gpxHandles.forEach(h => h.material = selectedGpx.has(h.userData.index) ? gpxHandleMatSelected : gpxHandleMat);
  renderGpxTable();
}
function renderGpxTable() {
  const c = document.querySelector('#edit-gpx-list');
  if (!c) return;
  // header + filter
  let html = `<div style="font:11px monospace; opacity:0.7; margin-bottom:6px;">${rawTrackPoints.length} punti · ${selectedGpx.size} selezionati · Shift+click multi, drag gruppo</div>`;
  html += `<div style="max-height:360px; overflow:auto; border:1px solid #333;"><table style="width:100%; font:11px monospace; border-collapse:collapse;"><thead><tr style="position:sticky; top:0; background:#1a1a1a;"><th style="padding:2px; border:1px solid #333;"><input type="checkbox" id="gpx-sel-all"></th><th style="padding:2px; border:1px solid #333;">#</th><th style="padding:2px; border:1px solid #333;">lat</th><th style="padding:2px; border:1px solid #333;">lon</th><th style="padding:2px; border:1px solid #333;">ele</th></tr></thead><tbody>`;
  // render all or paginated? For EDIT-03 show all (decimated view would mismatch). Show up to 2000 rows with scroll.
  for (let i = 0; i < rawTrackPoints.length; i++) {
    const p = rawTrackPoints[i];
    const sel = selectedGpx.has(i) ? ' style="background:#333;"' : '';
    html += `<tr${sel}><td style="padding:1px; border:1px solid #222; text-align:center;"><input type="checkbox" data-idx="${i}" ${selectedGpx.has(i)?'checked':''}></td><td style="padding:2px; border:1px solid #222; text-align:right;">${i}</td><td style="padding:1px; border:1px solid #222;"><input data-field="lat" data-idx="${i}" value="${p.lat.toFixed(6)}" style="width:86px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td><td style="padding:1px; border:1px solid #222;"><input data-field="lon" data-idx="${i}" value="${p.lon.toFixed(6)}" style="width:86px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td><td style="padding:1px; border:1px solid #222;"><input data-field="ele" data-idx="${i}" value="${p.ele.toFixed(1)}" style="width:64px; background:#111; color:#ddd; border:1px solid #333; font:11px monospace;"></td></tr>`;
  }
  html += `</tbody></table></div>`;
  c.innerHTML = html;
  // bind events
  c.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const val = Number(e.target.value);
      if (!Number.isFinite(val)) return;
      pushHistory();
      rawTrackPoints[idx][field] = val;
      const h = getGpxHandleByIdx(idx);
      if (h) {
        const w = terrainManager.coordToWorld(rawTrackPoints[idx].lat, rawTrackPoints[idx].lon, rawTrackPoints[idx].ele);
        const g = terrainManager.getElevationAtWorld(w.x, w.z);
        w.y = Math.max(w.y, g + 1.8);
        h.position.copy(w);
      }
      scheduleRebuild();
    });
  });
  c.querySelectorAll('input[type="checkbox"][data-idx]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      if (e.target.checked) selectedGpx.add(idx); else selectedGpx.delete(idx);
      updateGpxSelectionUI();
    });
  });
  const selAll = c.querySelector('#gpx-sel-all');
  if (selAll) selAll.addEventListener('change', (e) => {
    if (e.target.checked) { for (let i = 0; i < rawTrackPoints.length; i++) selectedGpx.add(i); } else selectedGpx.clear();
    updateGpxSelectionUI();
  });
}
canvas.addEventListener('pointerdown', (e) => {
  const isGpxTab = document.querySelector('#tab-gpx')?.classList.contains('active');
  const isCpTab = document.querySelector('#tab-cp')?.classList.contains('active');
  getMouse(e);
  raycaster.setFromCamera(mouse, camera);
  if (isGpxTab) {
    const intersects = raycaster.intersectObjects(gpxHandles, false);
    if (intersects.length) {
      activeHandle = intersects[0].object;
      const hitIdx = activeHandle.userData.index;
      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
      if (isMulti) {
        if (selectedGpx.has(hitIdx)) selectedGpx.delete(hitIdx); else selectedGpx.add(hitIdx);
        if (!selectedGpx.has(hitIdx)) {
          const first = selectedGpx.values().next().value;
          activeHandle = first !== undefined ? getGpxHandleByIdx(first) : null;
        }
      } else {
        if (!selectedGpx.has(hitIdx)) { selectedGpx.clear(); selectedGpx.add(hitIdx); }
      }
      if (selectedGpx.size === 0) { activeHandle = null; updateGpxSelectionUI(); return; }
      if (!activeHandle) { updateGpxSelectionUI(); return; }
      pushHistory();
      isDraggingGpx = true;
      controls.enabled = false;
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), activeHandle.position);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane, intersectPoint);
      dragOffset.copy(intersectPoint).sub(activeHandle.position);
      dragStartPositions.clear();
      selectedGpx.forEach(idx => {
        const p = rawTrackPoints[idx];
        const w = terrainManager.coordToWorld(p.lat, p.lon, p.ele);
        const g = terrainManager.getElevationAtWorld(w.x, w.z);
        w.y = Math.max(w.y, g + 1.8);
        dragStartPositions.set(idx, w.clone());
      });
      dragStartPositions.set('active', activeHandle.position.clone());
      updateGpxSelectionUI();
      e.preventDefault();
      return;
    } else {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) { selectedGpx.clear(); updateGpxSelectionUI(); }
    }
  }
  if (isCpTab) {
    const cpMeshes = checkpointGroup.children.filter(ch => ch.userData.isCp);
    const intersects = raycaster.intersectObjects(cpMeshes, false);
    if (intersects.length) {
      activeCpMesh = intersects[0].object;
      const hitIdx = activeCpMesh.userData.cpIdx;
      selectedCpIdx = hitIdx;
      pushHistory();
      isDraggingCp = true;
      controls.enabled = false;
      cpDragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), activeCpMesh.position);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(cpDragPlane, intersectPoint);
      cpDragOffset.copy(intersectPoint).sub(activeCpMesh.position);
      // highlight
      labels.forEach(l => { if (l.marker) l.marker.material.color.set(l.cpIdx === hitIdx ? '#ffea00' : (raceManager.checkpoints[l.cpIdx]?.isStart || raceManager.checkpoints[l.cpIdx]?.isFinish ? '#ffffff' : settingsManager.settings.themeColor)); });
      renderCheckpointTable();
      e.preventDefault();
      return;
    } else {
      // click empty deselect?
    }
  }
  const isTreesTab = document.querySelector('#tab-trees')?.classList.contains('active');
  if (isTreesTab) {
    // add mode: click terrain to plant
    if (treeAddMode && terrainManager.terrainMesh) {
      const tHits = raycaster.intersectObject(terrainManager.terrainMesh, false);
      if (tHits.length) { addTreeAt(tHits[0].point); return; }
    }
    if (treesMesh) {
      const tIntersects = raycaster.intersectObject(treesMesh, false);
      if (tIntersects.length) {
        const hit = tIntersects[0];
        const hitId = hit.instanceId;
        if (hitId === undefined || hitId === null) return;
        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
        if (isMulti) { if (selectedTrees.has(hitId)) selectedTrees.delete(hitId); else selectedTrees.add(hitId); }
        else { if (!selectedTrees.has(hitId)) { selectedTrees.clear(); selectedTrees.add(hitId); } }
        if (!selectedTrees.size) { renderTreesInfo(); return; }
        pushHistory();
        activeTreeId = hitId;
        isDraggingTree = true;
        controls.enabled = false;
        const startPos = getTreePos(hitId);
        treeDragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), startPos);
        const ip = new THREE.Vector3();
        raycaster.ray.intersectPlane(treeDragPlane, ip);
        treeDragOffset.copy(ip).sub(startPos);
        treeDragStarts.clear();
        selectedTrees.forEach(id => treeDragStarts.set(id, getTreePos(id).clone()));
        treeDragStarts.set('active', startPos.clone());
        renderTreesInfo();
        e.preventDefault();
        return;
      } else {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !treeAddMode) { selectedTrees.clear(); renderTreesInfo(); }
      }
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  getMouse(e);
  raycaster.setFromCamera(mouse, camera);
  if (isDraggingGpx && activeHandle) {
    const intersectPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
      const newPosActive = intersectPoint.sub(dragOffset);
      const startActive = dragStartPositions.get('active');
      if (!startActive) return;
      const delta = newPosActive.clone().sub(startActive);
      selectedGpx.forEach(idx => {
        const start = dragStartPositions.get(idx);
        if (!start) return;
        const np = start.clone().add(delta);
        const ground = terrainManager.getElevationAtWorld(np.x, np.z);
        np.y = Math.max(np.y, ground + 1.8);
        const h = getGpxHandleByIdx(idx);
        if (h) { h.position.copy(np); }
        const coord = terrainManager.worldToCoord(np.x, np.z, np.y);
        const bbox = terrainManager.terrainData?.bbox;
        if (bbox && (coord.lon < bbox.minLon || coord.lon > bbox.maxLon || coord.lat < bbox.minLat || coord.lat > bbox.maxLat)) return;
        rawTrackPoints[idx].lat = coord.lat;
        rawTrackPoints[idx].lon = coord.lon;
        rawTrackPoints[idx].ele = coord.ele;
      });
      scheduleRebuild();
    }
    return;
  }
  if (isDraggingCp && activeCpMesh && selectedCpIdx !== null) {
    const intersectPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(cpDragPlane, intersectPoint)) {
      const newPos = intersectPoint.sub(cpDragOffset);
      const ground = terrainManager.getElevationAtWorld(newPos.x, newPos.z);
      newPos.y = ground + 3.5;
      activeCpMesh.position.copy(newPos);
      // also move dot and sprite preview
      const lab = labels.find(l => l.cpIdx === selectedCpIdx);
      if (lab) {
        if (lab.dot) lab.dot.position.copy(newPos).add(new THREE.Vector3(0, -2.3, 0));
        if (lab.sprite) lab.sprite.position.copy(newPos).add(new THREE.Vector3(0, 18, 0));
      }
      const coord = terrainManager.worldToCoord(newPos.x, newPos.z, newPos.y);
      const cp = raceManager.checkpoints[selectedCpIdx];
      if (cp) {
        cp.lat = coord.lat; cp.lon = coord.lon; cp.ele = coord.ele;
        cp.km = findNearestKmForWorld(newPos);
      }
      scheduleRebuild();
    }
    return;
  }
  if (isDraggingTree && activeTreeId !== null) {
    const ip = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(treeDragPlane, ip)) {
      const newActive = ip.sub(treeDragOffset);
      const startActive = treeDragStarts.get('active');
      if (!startActive) return;
      const delta = newActive.clone().sub(startActive);
      selectedTrees.forEach(id => {
        const start = treeDragStarts.get(id);
        if (!start) return;
        const np = start.clone().add(delta);
        const g = terrainManager.getElevationAtWorld(np.x, np.z);
        np.y = g - 0.2;
        setTreePos(id, np);
      });
      renderTreesInfo();
    }
  }
});
canvas.addEventListener('pointerup', () => {
  if (isDraggingGpx) {
    isDraggingGpx = false;
    activeHandle = null;
    dragStartPositions.clear();
    controls.enabled = true;
    clearTimeout(rebuildDebounce);
    rebuildTrack3D();
    renderGpxTable();
  }
  if (isDraggingCp) {
    isDraggingCp = false;
    activeCpMesh = null;
    controls.enabled = true;
    clearTimeout(rebuildDebounce);
    rebuildTrack3D();
  }
  if (isDraggingTree) {
    isDraggingTree = false;
    activeTreeId = null;
    treeDragStarts.clear();
    controls.enabled = true;
    renderTreesInfo();
  }
});

// Render loop
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  controls.update(dt);
  // simple labels visibility (no km filter needed in edit)
  renderer.render(scene, camera);
}
frame();

// Resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// EDIT-07 wiring: undo/redo/save/export + auto-save + load
document.querySelectorAll('#btn-undo, #btn-undo2').forEach(b => b?.addEventListener('click', doUndo));
document.querySelectorAll('#btn-redo, #btn-redo2').forEach(b => b?.addEventListener('click', doRedo));
document.querySelectorAll('#btn-save-edit, #btn-save-edit2').forEach(b => b?.addEventListener('click', () => { saveEditLocal(); updateHistoryUI(); }));
document.querySelectorAll('#btn-export, #btn-export2').forEach(b => b?.addEventListener('click', exportEdit));
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) doRedo(); else doUndo();
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault(); doRedo();
  }
});
setInterval(() => {
  try { localStorage.setItem('giir_edit_v1', JSON.stringify(captureEditState())); } catch {}
  updateHistoryUI();
}, 3000);
updateHistoryUI();
// load local if exists after world ready — hook into initWorld tail
const _origInitWorld = initWorld;
const _origRebuild = rebuildTrack3D;
let _hasTriedLoad = false;
async function tryLoadEdit() {
  if (_hasTriedLoad) return; _hasTriedLoad = true;
  const saved = loadEditLocal();
  if (saved && saved.rawTrackPoints && saved.rawTrackPoints.length) {
    if (!isValidTrackForVersion(saved.rawTrackPoints)) {
      console.warn('[Edit] salvataggio corrotto, lo ignoro e pulisco versioni');
      versionManager.clearAll();
      try { localStorage.removeItem('giir_edit_v1'); } catch {}
      return;
    }
    if (confirm('Trovato salvataggio locale. Ripristinare ultima versione? OK=ripristina, Annulla=usa originale')) {
      restoreEditState(saved);
    } else {
      // utente ha scelto originale: pulisci versioni corrotte?
      // mantieni per storia, non pulire
    }
  }
}
const _checkLoadInterval = setInterval(() => {
  if (terrainManager.terrainData && rawTrackPoints.length) { clearInterval(_checkLoadInterval); tryLoadEdit(); }
}, 500);
