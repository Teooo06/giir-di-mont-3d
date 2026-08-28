import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { NdiStreamer } from './ndi-streamer.js';
import { TerrainManager } from './terrain-manager.js';
import { RaceManager } from './race-manager.js';
import { SettingsManager } from './settings-manager.js';
import { ElevationProfile } from './elevation-profile.js';
import { createArch, placeArchAtRoute } from './models/arch.js';
import './style.css';

// ----------------------------------------------------
// 1. SCENA THREE.JS & TELECAMERE
// ----------------------------------------------------
const canvas = document.querySelector('#world');
const scene = new THREE.Scene();

// Sfondo cielo alpino pulito e naturale (senza tinte gialle)
scene.background = new THREE.Color('#94b5c7');
scene.fog = new THREE.FogExp2('#9dbecd', 0.00045);

// Telecamera Operatore (Viewport)
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 2, 9000);
camera.position.set(0, 480, 760);

// Telecamera Program per NDI (1920x1080 16:9 fisso)
const programCamera = new THREE.PerspectiveCamera(40, 16 / 9, 2, 9000);
programCamera.position.copy(camera.position);
// Layer 1 = label NDI-only (sprite), layer 0 = tutto il resto. Browser vede solo 0, NDI vede 0+1
camera.layers.set(0);
programCamera.layers.set(0);
programCamera.layers.enable(1);

// Renderer WebGL — ponytail: preserveDrawingBuffer false on browser (only NDI renderer needs it for readPixels), saves ~0.5-1ms composite
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

// Orbit Controls per Drone Camera
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 70, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 40;
controls.maxDistance = 2600;
controls.maxPolarAngle = Math.PI * 0.485;

// YOU-24: gamepad edge state — ponytail: 4 bools for D-pad, no lib
let gamepadPrevDpad = [false, false, false, false];

// Illuminazione Montana Naturale e Chiara (luce bianca pulita, niente dominante gialla)
const hemiLight = new THREE.HemisphereLight('#f2f8ff', '#2d3b32', 2.2);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight('#ffffff', 3.2);
sun.position.set(-560, 920, 460);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); // ponytail: 2048→1024, 4x memory/BW win, visual diff negligible at 760m dist; revert to 2048 if shadows look soft on close-ups
sun.shadow.camera.left = sun.shadow.camera.bottom = -950;
sun.shadow.camera.right = sun.shadow.camera.top = 950;
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 2800;
sun.shadow.bias = -0.0001;
scene.add(sun);

// ----------------------------------------------------
// 2. GESTORI MODULARI (Ordinamento sicuro di inizializzazione)
// ----------------------------------------------------
const settingsManager = new SettingsManager({
  onChange: (settings) => {
    if (terrainManager) {
      terrainManager.applyStyle(settings.terrainStyle);
      terrainManager.setVerticalExaggeration(settings.verticalExaggeration);
      if (rawTrackPoints.length > 0) rebuildTrack3D();
    }
  }
});

const terrainManager = new TerrainManager({
  scene,
  style: settingsManager.settings.terrainStyle,
  verticalExaggeration: settingsManager.settings.verticalExaggeration
});

const elevationProfile = new ElevationProfile('#elevation-profile-container', {
  accentColor: settingsManager.settings.themeColor
});

const raceManager = new RaceManager({
  onStateChange: () => {
    renderAthletesList();
    renderSplitsEditor();
    updateRiderCard();
  }
});

const ndiStreamer = new NdiStreamer({
  sourceName: settingsManager.settings.ndiSourceName,
  fps: settingsManager.settings.ndiFps,
  width: 1920,
  height: 1080,
  onStatusChange: updateNdiHud,
  // YOU-27: live timing → apply to raceManager instantly (same logic as impostazioni.js)
  onTimingUpdate: (updates) => {
    updates.forEach(u => {
      const bib = String(u.bib ?? '').trim(); if (!bib) return;
      let ath = raceManager.athletes.find(a => a.bib === bib);
      if (!ath && u.name) { ath = raceManager.addAthlete({ bib, name: u.name, country: u.country || 'ITA', team: u.team || 'Skyrunner', color: u.color || '#dff654' }); }
      if (!ath) return;
      if (u.km !== undefined && u.km !== null && u.km !== '') raceManager.updateAthleteKm(ath.id, u.km);
      if (u.gap !== undefined) raceManager.updateAthleteDetails(ath.id, { gap: String(u.gap) });
      if (u.status !== undefined) raceManager.updateAthleteDetails(ath.id, { status: String(u.status) });
      if (u.splits && typeof u.splits === 'object') Object.entries(u.splits).forEach(([cp, t]) => raceManager.updateSplitTime(ath.id, cp, String(t)));
      // also support flat cp* fields: {cp3:"01:29:40"}
      Object.keys(u).forEach(k => { if (k.startsWith('cp')) raceManager.updateSplitTime(ath.id, k, String(u[k])); });
    });
  }
});

// Canale di sincronizzazione istantanea con /impostazioni
try {
  const syncChannel = new BroadcastChannel('giir_sync_channel');
  syncChannel.onmessage = (e) => {
    if (e.data?.type === 'SETTINGS_UPDATED') {
      settingsManager.loadSettings();
    } else if (e.data?.type === 'RACE_STATE_UPDATED') {
      raceManager.loadFromStorage(false);
    }
  };
} catch (e) {}

// ----------------------------------------------------
// 3. GENERAZIONE ALBERELLI 3D STILIZZATI (MICRO FORESTE ALPINE)
// ----------------------------------------------------
let treesMesh = null;
function generateAlpineForest() {
  if (treesMesh) {
    scene.remove(treesMesh);
    treesMesh.geometry.dispose();
  }

  const count = 800; // ponytail: 1400→800, single InstancedMesh draw call unchanged, 43% fewer instance updates; add LOD billboard if still tight
  const treeGeo = new THREE.ConeGeometry(2.4, 11, 5);
  treeGeo.translate(0, 5.5, 0); // Base a Y=0
  const treeMat = new THREE.MeshStandardMaterial({
    color: '#1a3826',
    roughness: 0.9,
    metalness: 0.0
  });

  treesMesh = new THREE.InstancedMesh(treeGeo, treeMat, count);
  const dummy = new THREE.Object3D();
  let planted = 0;

  const minX = -480, maxX = 480;
  const minZ = -400, maxZ = 400;

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
}

// ----------------------------------------------------
// 4. TRACCIATO GPX & CHECKPOINT ACCURATI
// ----------------------------------------------------
let rawTrackPoints = [];
let routeCurve = null;
let routeLine = null; // kept for compat — ponytail: alias to traveled
let routeLineTraveled = null;
let routeLineRemaining = null;
let labels = [];
const checkpointGroup = new THREE.Group();
scene.add(checkpointGroup);
let archGroup = null; // P8 arco gonfiabile rosso Bocchetta Larec 14.5km — must stay

const athleteMeshes = new Map();

function markerTexture(number, color = '#dff654') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(64, 64, 48, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(64, 64, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#111815';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 48px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(number, 64, 68);
  return new THREE.CanvasTexture(c);
}

// PROG-03: Rimuovere indicatore leader grande — ponytail: kept only small 28×28 sprite+bib, no large sphere; large sphere+bib deleted, keeps InstancedMesh batch cheap
function getOrCreateAthleteMesh(athlete) {
  if (athleteMeshes.has(athlete.id)) {
    return athleteMeshes.get(athlete.id);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: markerTexture(athlete.bib, athlete.color),
    depthTest: false
  }));
  sprite.scale.set(28, 28, 1); // ponytail: calibration knob — 28 world units, match UI-05 checkpoint sprite scale logic
  scene.add(sprite);

  const light = new THREE.PointLight(athlete.color, 3.5, 75);
  scene.add(light);

  const entry = { sprite, light };
  athleteMeshes.set(athlete.id, entry);
  return entry;
}

function createCheckpointLabelSprite(name, km, themeColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const boxH = 110;
  const boxY = 0;
  // Background box with rounded corners
  ctx.fillStyle = 'rgba(14, 20, 23, 0.92)';
  const r = 10;
  ctx.beginPath();
  ctx.roundRect(0, boxY, w, boxH, r);
  ctx.fill();
  // Top accent
  ctx.fillStyle = themeColor;
  ctx.fillRect(0, boxY, w, 6);
  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), w / 2, boxY + 38);
  // Subtext
  ctx.fillStyle = '#f6f4e9';
  ctx.font = '700 20px DM Sans, sans-serif';
  ctx.fillText(`${km} km · checkpoint`, w / 2, boxY + 76);
  // Stem line
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 6;
  ctx.shadowColor = themeColor;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(w / 2, boxH);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.layers.set(0); // UI-04: unified sprite visible browser+NDI (was 1 NDI-only, HTML .label removed) — ponytail shortest diff
  sprite.scale.set(80, 25, 1); // UI-05: 512:160=3.2:1, 80×25 world units — larger for broadcast readability
  return sprite;
}

function clearCheckpoints() {
  labels.forEach(({ el, sprite }) => {
    if (el) el.remove();
    if (sprite) {
      if (sprite.material.map) sprite.material.map.dispose();
      sprite.material.dispose();
      // rimosso da checkpointGroup via clear()
    }
  });
  checkpointGroup.clear();
  labels = [];
}

function add3DCheckpoint(id, name, km, worldPos, isStart = false, isFinish = false) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(4.8, 16, 12),
    new THREE.MeshBasicMaterial({ color: isStart || isFinish ? '#ffffff' : settingsManager.settings.themeColor })
  );
  marker.position.copy(worldPos);
  marker.position.y += 3.5;
  checkpointGroup.add(marker);

  // UI-04: HTML .label removed — sprite unificato browser+NDI (layers 0)
  const el = null;

  // Sprite unificato (layer 0) — visibile sia browser che Program 16:9
  const sprite = createCheckpointLabelSprite(name, km, settingsManager.settings.themeColor);
  sprite.position.copy(worldPos).add(new THREE.Vector3(0, 18, 0));
  checkpointGroup.add(sprite);

  labels.push({
    el,
    sprite,
    id,
    isStart,
    isFinish,
    marker,
    point: worldPos.clone().add(new THREE.Vector3(0, 10, 0))
  });
}

function rebuildTrack3D() {
  if (rawTrackPoints.length < 2) return;

  const worldPoints = rawTrackPoints.map(p => {
    const v = terrainManager.coordToWorld(p.lat, p.lon, p.ele);
    // YOU-22: terrain adherence — ponytail: max(track ele, DEM+offset) prevents sinking; one line, no raycast
    const ground = terrainManager.getElevationAtWorld(v.x, v.z);
    v.y = Math.max(v.y, ground + 1.8); // calibration knob: 1.8 world units (~14m real), bump to 2.5 if steep faces still clip
    return v;
  });

  // PROG-01: bicolore — ponytail: 2 TubeGeometry split at leader ratio, stdlib THREE only
  if (routeLineTraveled) { scene.remove(routeLineTraveled); routeLineTraveled.geometry.dispose(); }
  if (routeLineRemaining) { scene.remove(routeLineRemaining); routeLineRemaining.geometry.dispose(); }
  if (routeLine) { scene.remove(routeLine); if (routeLine.geometry) routeLine.geometry.dispose(); routeLine = null; }

  routeCurve = new THREE.CatmullRomCurve3(worldPoints, false, 'centripetal');

  // split at leader progress
  const leader = raceManager.getSelectedAthlete();
  const leaderRatio = leader ? Math.min(0.999, Math.max(0.001, leader.km / raceManager.totalKm)) : 0;
  // find split index in worldPoints proportional to ratio
  const splitIdx = Math.max(1, Math.min(worldPoints.length - 2, Math.round(worldPoints.length * leaderRatio)));
  const traveledPts = worldPoints.slice(0, splitIdx + 1);
  // ensure continuity: add interpolated point at exact ratio on curve if not aligned
  try {
    const exactPt = routeCurve.getPointAt(leaderRatio);
    if (traveledPts.length) traveledPts[traveledPts.length - 1] = exactPt.clone();
  } catch {}
  const remainingPts = worldPoints.slice(splitIdx);
  try {
    const exactPt2 = routeCurve.getPointAt(leaderRatio);
    if (remainingPts.length) remainingPts[0] = exactPt2.clone();
  } catch {}
  // ensure at least 2 points per segment
  if (traveledPts.length < 2) traveledPts.push(traveledPts[0].clone().add(new THREE.Vector3(0.1,0,0)));
  if (remainingPts.length < 2) remainingPts.push(remainingPts[0].clone().add(new THREE.Vector3(0.1,0,0)));

  const traveledCurve = new THREE.CatmullRomCurve3(traveledPts, false, 'centripetal');
  const remainingCurve = new THREE.CatmullRomCurve3(remainingPts, false, 'centripetal');
  const traveledSegs = Math.max(8, Math.round(400 * leaderRatio));
  const remainingSegs = Math.max(8, 400 - traveledSegs);

  const traveledGeo = new THREE.TubeGeometry(traveledCurve, traveledSegs, 1.1, 7, false);
  const remainingGeo = new THREE.TubeGeometry(remainingCurve, remainingSegs, 1.1, 7, false);

  routeLineTraveled = new THREE.Mesh(
    traveledGeo,
    new THREE.MeshStandardMaterial({
      color: '#fff5c0',
      emissive: settingsManager.settings.themeColor,
      emissiveIntensity: 0.65,
      roughness: 0.3
    })
  );
  routeLineRemaining = new THREE.Mesh(
    remainingGeo,
    new THREE.MeshStandardMaterial({
      color: '#8a8a8a',
      transparent: true,
      opacity: 0.5,
      roughness: 0.8,
      emissive: '#000000'
    })
  );
  scene.add(routeLineTraveled);
  scene.add(routeLineRemaining);
  routeLine = routeLineTraveled; // compat alias

  clearCheckpoints();
  raceManager.checkpoints.forEach(cp => {
    const ratio = Math.min(0.999, Math.max(0.001, cp.km / raceManager.totalKm));
    const pt = routeCurve.getPointAt(ratio);
    add3DCheckpoint(cp.id, cp.name, cp.km.toFixed(1), pt, cp.isStart, cp.isFinish);
  });

  // P8 — Arco gonfiabile rosso a Bocchetta di Larec (14.5km, GPM) — MUST stay, restored 2026-08-28
  if (archGroup) {
    scene.remove(archGroup);
    archGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  archGroup = createArch({ height: 7, width: 8, tubeRadius: 1.6, color: '#ff1a1a' });
  const archRatio = Math.min(0.999, Math.max(0.001, 14.5 / raceManager.totalKm));
  placeArchAtRoute(archGroup, routeCurve, archRatio, terrainManager);
  archGroup.rotation.y += Math.PI; // perpendicolare segue costa
  archGroup.rotation.z += THREE.MathUtils.degToRad(-18); // antiorario 18° vista frontale — rialza da montagna incastrata
  archGroup.position.y += 1.0; // rialza base
  scene.add(archGroup);

  if (elevationProfile && typeof elevationProfile.setTrackData === 'function') {
    elevationProfile.setTrackData(rawTrackPoints, raceManager.checkpoints);
  }
}

function parseGpxAndBuild(xmlText, filename = 'giir-di-mont-32-km.gpx') {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('File GPX non valido.');

  rawTrackPoints = [...xml.querySelectorAll('trkpt')].map(node => ({
    lat: Number(node.getAttribute('lat')),
    lon: Number(node.getAttribute('lon')),
    ele: Number(node.querySelector('ele')?.textContent || 960)
  })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (rawTrackPoints.length < 2) throw new Error('Nessun punto traccia valido trovato.');

  rebuildTrack3D();
  generateAlpineForest();

  const trackStatus = document.querySelector('#track-status');
  if (trackStatus) trackStatus.textContent = `${filename} (${rawTrackPoints.length} punti)`;
  
  setScene('overview', { instant: true });
}

// Inizializza Terreno e GPX all'avvio
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

// Input file GPX alternativo
document.querySelector('#gpx-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    parseGpxAndBuild(await file.text(), file.name);
  } catch (err) {
    alert(err.message);
  }
});

// ----------------------------------------------------
// 5. REGIA SCENE & TELECAMERA
// ----------------------------------------------------
let activeScene = 'overview';
let isAutoPlaying = true;
const targetPos = new THREE.Vector3();

// ponytail: native lerp + easeInOutCubic instead of GSAP — stdlib Math, ~40 lines, no new dep; upgrade to GSAP/Bezier if director wants spline easing
let camTween = null; // { startPos, endPos, startTarget, endTarget, elapsed, duration }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function getSceneParams(name) {
  const selectedAthlete = raceManager.getSelectedAthlete();
  const ratio = selectedAthlete ? (selectedAthlete.km / raceManager.totalKm) : 0.45;
  if (name === 'overview') return { pos: new THREE.Vector3(0, 480, 760), target: new THREE.Vector3(0, 70, 0), label: 'PANORAMICA 3D VALLE PREMANA' };
  if (name === 'runner' && routeCurve) { const p = routeCurve.getPointAt(ratio); return { pos: p.clone().add(new THREE.Vector3(95, 55, 115)), target: p.clone(), label: `INSEGUIMENTO DRONE: ${selectedAthlete?.name || 'Leader'}` }; }
  if (name === 'checkpoint' && routeCurve) { const p = routeCurve.getPointAt(14.5 / 32.0); return { pos: p.clone().add(new THREE.Vector3(-80, 50, 95)), target: p.clone(), label: 'INQUADRATURA: BOCCHETTA DI LAREC (2070m)' }; }
  if (name === 'pizzo' && routeCurve) { const p = routeCurve.getPointAt(27.5 / 32.0); return { pos: p.clone().add(new THREE.Vector3(85, 65, -75)), target: p.clone(), label: 'INQUADRATURA: ALPE DELEGUAGGIO' }; }
  if (name === 'topdown') return { pos: new THREE.Vector3(0, 900, 10), target: new THREE.Vector3(0, 40, 0), label: 'VISTA SATELLITARE ZENITH' };
  return null;
}
function setScene(sceneName, opts = {}) {
  const { instant = false, duration = 1.8 } = opts; // ponytail: calibration knob — duration 1.8s, tweak per scene if needed
  activeScene = sceneName;
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === sceneName));
  const params = getSceneParams(sceneName);
  if (!params) return;
  const modeEl = document.querySelector('#mode');
  if (modeEl) modeEl.textContent = params.label;
  if (instant || !routeCurve) { camera.position.copy(params.pos); controls.target.copy(params.target); targetPos.copy(params.target); camTween = null; return; }
  // start tween from current (mid-flight safe) to target — 3d-games: smooth following via lerp, camera feel
  camTween = { startPos: camera.position.clone(), endPos: params.pos.clone(), startTarget: controls.target.clone(), endTarget: params.target.clone(), elapsed: 0, duration };
}

document.querySelectorAll('[data-scene]').forEach(b => {
  b.addEventListener('click', () => setScene(b.dataset.scene));
});

// Tastiera
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '1') setScene('overview');
  if (e.key === '2') setScene('runner');
  if (e.key === '3') setScene('checkpoint');
  if (e.key === '4') setScene('pizzo');
  if (e.key === '5') setScene('topdown');
  if (e.key === ' ') {
    isAutoPlaying = !isAutoPlaying;
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'c') {
    document.body.classList.toggle('clean');
  }
});

// ----------------------------------------------------
// 6. GESTIONE TAB & INTERFACCIA OPERATORE
// ----------------------------------------------------
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const targetId = tab.dataset.tab;
    const panel = document.querySelector(`#${targetId}`);
    if (panel) panel.classList.add('active');
  });
});

function renderAthletesList() {
  const container = document.querySelector('#athletes-list');
  if (!container) return;
  const state = raceManager.getState();

  container.innerHTML = state.athletes.map(ath => `
    <div class="athlete-row ${ath.id === state.selectedAthlete?.id ? 'active' : ''}" data-ath-id="${ath.id}">
      <div class="bib-badge" style="background:${ath.color};">${ath.bib}</div>
      <div class="athlete-info">
        <strong>${ath.name}</strong>
        <small>${ath.country} · ${ath.team}</small>
      </div>
      <div class="athlete-stats">
        <span>${ath.km.toFixed(1)} km</span>
        <small>${ath.gap}</small>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.athlete-row').forEach(row => {
    row.addEventListener('click', () => {
      raceManager.selectAthlete(row.dataset.athId);
    });
  });
}

function renderSplitsEditor() {
  const athlete = raceManager.getSelectedAthlete();
  const titleEl = document.querySelector('#splits-athlete-name');
  const tableEl = document.querySelector('#splits-table');
  if (!tableEl || !athlete) return;

  if (titleEl) titleEl.textContent = `${athlete.name} (#${athlete.bib})`;

  tableEl.innerHTML = raceManager.checkpoints.map(cp => {
    const val = athlete.splits?.[cp.id] || '';
    return `
      <div class="split-row">
        <div class="split-name" title="${cp.name}">
          <strong>${cp.km.toFixed(1)} km</strong> · ${cp.name}
        </div>
        <input 
          class="split-input" 
          type="text" 
          placeholder="00:00:00" 
          value="${val}" 
          data-cp-id="${cp.id}" 
        />
      </div>
    `;
  }).join('');

  tableEl.querySelectorAll('.split-input').forEach(input => {
    input.addEventListener('change', (e) => {
      raceManager.updateSplitTime(athlete.id, e.target.dataset.cpId, e.target.value);
    });
  });
}

function updateRiderCard() {
  const athlete = raceManager.getSelectedAthlete();
  if (!athlete) return;

  const opBib = document.querySelector('#op-bib');
  const opName = document.querySelector('#op-name');
  const opGap = document.querySelector('#op-gap');
  const progressEl = document.querySelector('#progress');
  const sliderEl = document.querySelector('#athlete-km-slider');

  if (opBib) {
    opBib.textContent = athlete.bib;
    opBib.style.background = athlete.color;
  }
  if (opName) opName.textContent = athlete.name;
  if (opGap) opGap.textContent = `${athlete.gap} · ${athlete.team}`;
  if (progressEl) progressEl.textContent = `${athlete.km.toFixed(1)} km`;
  if (sliderEl && document.activeElement !== sliderEl) {
    sliderEl.value = athlete.km;
  }

  let currentEle = 960;
  if (routeCurve) {
    const ratio = Math.min(0.999, Math.max(0.001, athlete.km / raceManager.totalKm));
    const p = routeCurve.getPointAt(ratio);
    currentEle = (p.y / (0.1 * settingsManager.settings.verticalExaggeration)) + terrainManager.baseElevation;
  }
  if (elevationProfile && typeof elevationProfile.updateProgress === 'function') {
    elevationProfile.updateProgress(athlete.km, currentEle);
  }
}

const kmSlider = document.querySelector('#athlete-km-slider');
if (kmSlider) {
  kmSlider.addEventListener('input', (e) => {
    const athlete = raceManager.getSelectedAthlete();
    if (athlete) {
      raceManager.updateAthleteKm(athlete.id, parseFloat(e.target.value));
    }
  });
}

document.querySelector('#btn-add-athlete')?.addEventListener('click', () => {
  const bib = prompt('Numero di pettorale:', '10');
  if (!bib) return;
  const name = prompt('Nome e Cognome atleta:', 'Nuovo Corridore');
  if (!name) return;
  raceManager.addAthlete({ bib, name, country: 'ITA', team: 'Skyrunning Team', color: '#ff3b30' });
});

document.querySelector('#btn-reset-race')?.addEventListener('click', () => {
  if (confirm('Vuoi ripristinare i tempi e gli atleti ai valori predefiniti?')) {
    raceManager.resetToDefault();
  }
});

// ----------------------------------------------------
// 7. IMPOSTAZIONI STILE
// ----------------------------------------------------
document.querySelectorAll('#terrain-style-selector .choice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#terrain-style-selector .choice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settingsManager.update({ terrainStyle: btn.dataset.val });
  });
});

document.querySelectorAll('#color-palette .color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('#color-palette .color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    settingsManager.update({ themeColor: dot.dataset.color });
  });
});

document.querySelector('#font-selector')?.addEventListener('change', (e) => {
  settingsManager.update({ fontFamily: e.target.value });
});

const exagSlider = document.querySelector('#exaggeration-slider');
const exagVal = document.querySelector('#exaggeration-val');
if (exagSlider) {
  exagSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (exagVal) exagVal.textContent = `${v.toFixed(2)}x`;
    settingsManager.update({ verticalExaggeration: v });
  });
}

document.querySelector('#chk-profile')?.addEventListener('change', (e) => {
  settingsManager.update({ showElevationProfile: e.target.checked });
});

// ----------------------------------------------------
// 8. INTEGRAZIONE NDI & HUD
// ----------------------------------------------------
function updateNdiHud(status) {
  const badge = document.querySelector('#ndi-badge');
  const name = document.querySelector('#ndi-name');
  const conns = document.querySelector('#ndi-conns');
  const fps = document.querySelector('#ndi-fps');
  const tally = document.querySelector('#tally-indicator');

  if (name) name.textContent = status.sourceName || 'GIIR-3D-PROGRAM';

  if (status.active) {
    if (status.tally && status.tally.onProgram) {
      badge.className = 'ndi-badge on-program';
      if (tally) { tally.className = 'tally-tag program'; tally.textContent = 'ON-PROGRAM (LIVE)'; }
    } else {
      badge.className = 'ndi-badge live';
      if (tally) {
        tally.className = status.tally && status.tally.onPreview ? 'tally-tag preview' : 'tally-tag';
        tally.textContent = status.tally && status.tally.onPreview ? 'ON-PREVIEW' : 'NDI TRASMETTE';
      }
    }
  } else {
    badge.className = 'ndi-badge offline';
    if (tally) { tally.className = 'tally-tag'; tally.textContent = 'NDI STANDBY'; }
  }

  if (conns) {
    const n = status.connections || 0;
    conns.textContent = `👥 ${n} ${n === 1 ? 'connessione' : 'connessioni'}`;
  }

  if (fps) {
    fps.textContent = status.streaming && status.fps ? `⏱️ ${status.fps} FPS` : '⏱️ 50 FPS';
  }
}

document.querySelector('#ndi-toggle')?.addEventListener('click', (e) => {
  const active = ndiStreamer.toggle();
  e.target.textContent = active ? 'Disattiva NDI' : 'Attiva NDI';
  e.target.classList.toggle('disabled', !active);
});

// Gestione intelligente visibilità Partenza vs Arrivo
const tempVec = new THREE.Vector3();
function updateLabels() {
  const selectedAthlete = raceManager.getSelectedAthlete();
  const currentKm = selectedAthlete ? selectedAthlete.km : 0;
  const showStart = currentKm < 16.0;
  const showFinish = currentKm >= 16.0;

  labels.forEach(({ el, sprite, point, isStart, isFinish, marker }) => {
    if (isStart && !showStart) {
      if (el) el.style.display = 'none';
      if (marker) marker.visible = false;
      if (sprite) sprite.visible = false;
      return;
    }
    if (isFinish && !showFinish) {
      if (el) el.style.display = 'none';
      if (marker) marker.visible = false;
      if (sprite) sprite.visible = false;
      return;
    }
    if (marker) marker.visible = true;
    if (sprite) sprite.visible = true;

    // UI-04: HTML label removed — keep projection guard for el=null
    if (el) {
      tempVec.copy(point).project(camera);
      const visible = tempVec.z < 1 && tempVec.x > -1.15 && tempVec.x < 1.15 && tempVec.y > -1.2 && tempVec.y < 1.2;
      el.style.display = visible ? 'block' : 'none';
      el.style.left = `${(tempVec.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-tempVec.y * 0.5 + 0.5) * innerHeight}px`;
    }
  });
}

// Inizializza UI
renderAthletesList();
renderSplitsEditor();
updateRiderCard();

// ----------------------------------------------------
// 9. RENDER LOOP PRINCIPALE
// ----------------------------------------------------
// RACE-03: interpolazione basata sugli splits — ponytail: parseTime stdlib, single simElapsedSec, native lerp, no lib
function parseTimeToSec(str) {
  if (!str || typeof str !== 'string') return null;
  const p = str.trim().split(':').map(Number);
  if (p.some(n => !Number.isFinite(n))) return null;
  if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
  if (p.length === 2) return p[0]*60 + p[1];
  if (p.length === 1) return p[0];
  return null;
}
let simElapsedSec = 0;
function getDurationSec() {
  const ds = raceManager.defaultSplits2025?.splits || {};
  const t = parseTimeToSec(ds.cp9 || raceManager.winnerReferenceTime);
  return t || 11644; // fallback Magnini 03:14:04
}
function interpolateKmForAthlete(ath, elapsedSec) {
  const cps = raceManager.checkpoints;
  const pts = [];
  for (const cp of cps) {
    let tStr = ath.splits?.[cp.id];
    if (!tStr || tStr.trim() === '') tStr = raceManager.defaultSplits2025?.splits?.[cp.id];
    if (!tStr) tStr = cp.refSplit;
    const sec = parseTimeToSec(tStr);
    if (sec != null) pts.push({ km: cp.km, sec, ele: cp.ele });
  }
  pts.sort((a,b)=>a.sec-b.sec);
  if (!pts.length) return ath.km;
  const dur = pts[pts.length-1].sec || getDurationSec();
  const e = elapsedSec % (dur || 1);
  for (let i=0;i<pts.length-1;i++) {
    const a = pts[i], b = pts[i+1];
    if (e >= a.sec && e <= b.sec) {
      const span = b.sec - a.sec;
      let r = span === 0 ? 0 : (e - a.sec)/span;
      // RACE-04: velocità variabile salita/discesa — ponytail: exponent factor on r, calibration knobs below
      const eleDelta = (b.ele ?? 0) - (a.ele ?? 0);
      // factor >1 = salita più lenta (r^factor < r), factor <1 = discesa più veloce
      // ponytail: 1.25 salita >80m dislivello, 0.85 discesa <-80m, altrimenti 1.0 lineare; tweak 80m/1.25/0.85 if feels off
      let factor = 1.0;
      if (eleDelta > 80) factor = 1.25;
      else if (eleDelta < -80) factor = 0.85;
      if (factor !== 1.0) r = Math.pow(r, factor);
      return a.km + r * (b.km - a.km);
    }
  }
  if (e < pts[0].sec) return pts[0].km;
  return pts[pts.length-1].km;
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();

  if (routeCurve) {
    // advance global elapsed — RACE-02 simSpeed (1=real, 10-100 accelerated)
    if (isAutoPlaying) {
      const speed = settingsManager.settings.simulationSpeed ?? 1;
      simElapsedSec = (simElapsedSec + dt * speed) % getDurationSec();
    }
    const state = raceManager.getState();
    const athletes = state.athletes;

    athletes.forEach(ath => {
      if (isAutoPlaying && ath.status === 'running') {
        // RACE-03: replace linear ath.km += dt*0.08 with split interpolation
        ath.km = interpolateKmForAthlete(ath, simElapsedSec);
      }
      const ratio = Math.min(0.999, Math.max(0.001, ath.km / raceManager.totalKm));
      const pt = routeCurve.getPointAt(ratio);

      const entry = getOrCreateAthleteMesh(ath);
      entry.sprite.position.copy(pt).add(new THREE.Vector3(0, 14 + Math.sin(performance.now() * 0.005) * 1.2, 0));
      entry.light.position.copy(pt).add(new THREE.Vector3(0, 10, 0));
    });

    const selectedAthlete = raceManager.getSelectedAthlete();
    if (selectedAthlete) {
      updateRiderCard();
      if (activeScene === 'runner' && !camTween) {
        // CAM-2: dead-zone + look-ahead — 3d-games: smooth lerp + look-ahead for movement
        const leadKm = 0.018; // ponytail: calibration knob — 18m ahead on track; bump to 0.03 for stronger anticipation
        const deadZone = 1.0; // world units ≈10m — ponytail: dead-zone threshold, prevents jitter when athlete paused/nudged
        const ratioAhead = Math.min(0.999, Math.max(0.001, (selectedAthlete.km + leadKm) / raceManager.totalKm));
        const ptAhead = routeCurve.getPointAt(ratioAhead);
        if (targetPos.distanceTo(ptAhead) > deadZone) {
          targetPos.lerp(ptAhead, 0.04);
        }
        controls.target.copy(targetPos);
      }
    }
  }

  // cinematic tween — 3d-games camera feel: smooth lerp + easeInOutCubic, no external lib
  if (camTween) {
    camTween.elapsed += dt;
    let t = Math.min(1, camTween.elapsed / camTween.duration);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(camTween.startPos, camTween.endPos, e);
    controls.target.lerpVectors(camTween.startTarget, camTween.endTarget, e);
    // YOU-11: ease damping 0.08→0.02 during flight — ponytail: one lerp, snap back to 0.08 on complete
    controls.dampingFactor = THREE.MathUtils.lerp(0.08, 0.02, e);
    if (t >= 1) { camTween = null; targetPos.copy(controls.target); controls.dampingFactor = 0.08; }
  }

  // YOU-24: gamepad poll — ponytail: native navigator.getGamepads(), left stick orbit / right stick zoom / D-pad scenes, dead-zone 0.15 calibration knob
  try {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp && gp.connected) {
      const dz = 0.15;
      const lx = Math.abs(gp.axes[0] || 0) > dz ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1] || 0) > dz ? gp.axes[1] : 0;
      if ((lx || ly) && !camTween) {
        const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
        sph.theta -= lx * 0.03;
        sph.phi = THREE.MathUtils.clamp(sph.phi + ly * 0.03, 0.1, Math.PI * 0.48);
        camera.position.setFromSpherical(sph).add(controls.target);
      }
      const ry = Math.abs(gp.axes[3] || 0) > dz ? gp.axes[3] : 0;
      if (ry && !camTween) {
        const dir = camera.position.clone().sub(controls.target);
        const dist = dir.length();
        const nd = THREE.MathUtils.clamp(dist + ry * dist * 0.04, controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(nd));
      }
      // D-pad → scenes (edge trigger, no repeat while held)
      const dpadBtns = [12, 15, 13, 14]; // up,right,down,left → overview,runner,checkpoint,pizzo
      const dpadScenes = ['overview', 'runner', 'checkpoint', 'pizzo'];
      dpadBtns.forEach((b, i) => {
        const pressed = !!(gp.buttons[b] && gp.buttons[b].pressed);
        if (pressed && !gamepadPrevDpad[i]) setScene(dpadScenes[i]);
        gamepadPrevDpad[i] = pressed;
      });
    }
  } catch (_) {}

  controls.update();

  // Scala elementi 3D inversamente allo zoom (più vicino = più piccoli) — solo scala locale, mai posizione
  const camDist = camera.position.distanceTo(controls.target);
  const zoomScale = THREE.MathUtils.clamp(camDist / 750, 0.45, 1.0);
  labels.forEach(({ marker, sprite }) => {
    if (marker) marker.scale.setScalar(zoomScale);
    if (sprite) sprite.scale.set(80 * zoomScale, 25 * zoomScale, 1); // UI-05 match 80×25
  });
  athleteMeshes.forEach(({ sprite }) => {
    if (sprite) sprite.scale.set(28 * zoomScale, 28 * zoomScale, 1);
  });
  // NON scalare routeLine e treesMesh come mesh intera (sposterebbe la geometria sotto la montagna)
  // Per tracciato e alberi lo scaling va fatto su geometria/instanza, per ora lasciato a 1 per stabilità

  // Sincronizza Program camera al 100% con la camera browser, poi forza 16:9
  programCamera.copy(camera);
  programCamera.aspect = 16 / 9;
  programCamera.updateProjectionMatrix();

  renderer.render(scene, camera);
  updateLabels();

  ndiStreamer.captureAndSend(renderer, scene, programCamera);
}

frame();

// Riquadro NDI 16:9 — mostra esattamente il crop del Program
function updateNdiFrameBox() {
  const el = document.querySelector('#ndi-frame');
  if (!el) return;
  const vw = innerWidth, vh = innerHeight;
  const targetAspect = 16 / 9;
  const viewAspect = vw / vh;
  let w, h;
  if (viewAspect > targetAspect) {
    h = vh;
    w = vh * targetAspect;
  } else {
    w = vw;
    h = vw / targetAspect;
  }
  // Leggero inset per non coprire i bordi HUD (8px)
  const inset = 0;
  el.style.width = `${Math.max(0, w - inset * 2)}px`;
  el.style.height = `${Math.max(0, h - inset * 2)}px`;
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  updateNdiFrameBox();
});
updateNdiFrameBox();
// Toggle riquadro con tasto N
addEventListener('keydown', (e) => {
  if ((e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.key.toLowerCase() === 'n') {
    document.querySelector('#ndi-frame')?.classList.toggle('hidden');
  }
});
