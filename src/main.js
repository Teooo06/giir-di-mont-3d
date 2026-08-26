import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { NdiStreamer } from './ndi-streamer.js';
import { TerrainManager } from './terrain-manager.js';
import { RaceManager } from './race-manager.js';
import { SettingsManager } from './settings-manager.js';
import { ElevationProfile } from './elevation-profile.js';
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
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 2, 9000);
camera.position.set(0, 550, 950);

// Telecamera Program per NDI (1920x1080 16:9 fisso)
const programCamera = new THREE.PerspectiveCamera(45, 16 / 9, 2, 9000);
programCamera.position.set(0, 550, 950);
// Layer 1 = label NDI-only (sprite), layer 0 = tutto il resto. Browser vede solo 0, NDI vede 0+1
camera.layers.set(0);
programCamera.layers.set(0);
programCamera.layers.enable(1);

// Renderer WebGL
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
controls.maxDistance = 3500;
controls.maxPolarAngle = Math.PI * 0.485;

// Illuminazione Montana Naturale e Chiara (luce bianca pulita, niente dominante gialla)
const hemiLight = new THREE.HemisphereLight('#f2f8ff', '#2d3b32', 2.2);
scene.add(hemiLight);

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

// ----------------------------------------------------
// 2. GESTORI MODULARI (Ordinamento sicuro di inizializzazione)
// ----------------------------------------------------
const settingsManager = new SettingsManager({
  onChange: (settings) => {
    if (terrainManager) {
      terrainManager.applyStyle(settings.terrainStyle);
      terrainManager.setVerticalExaggeration(settings.verticalExaggeration);
      if (rawTrackPoints.length > 0) rebuildTrack3D();
      generateAlpineForest();
    }
    // Applica impostazioni grafiche
    applyGraphicsSettings(settings);
  }
});

// Applica impostazioni grafiche iniziali
applyGraphicsSettings(settingsManager.settings);

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
  msaa: settingsManager.settings.ndiMsaa,
  onStatusChange: updateNdiHud
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
// 4. IMPOSTAZIONI GRAFICHE DINAMICHE
// ----------------------------------------------------
function applyGraphicsSettings(settings) {
  // Ombre
  renderer.shadowMap.enabled = settings.shadowsEnabled;
  if (sun.shadow) {
    const res = settings.shadowResolution;
    sun.shadow.mapSize.set(res, res);
  }

  // MSAA NDI render target
  if (ndiStreamer && ndiStreamer.setMsaa) {
    ndiStreamer.setMsaa(settings.ndiMsaa);
  }

  // Preserve drawing buffer
  // Nota: richiede ricreazione renderer, per ora solo log
  // if (settings.preserveDrawingBuffer !== renderer.preserveDrawingBuffer) {
  //   console.warn('preserveDrawingBuffer change requires renderer restart');
  // }

  // FPS NDI
  ndiStreamer.setFps(settings.ndiFps);
}

// ----------------------------------------------------
// 5. GENERAZIONE ALBERELLI 3D STILIZZATI (MICRO FORESTE ALPINE)
// ----------------------------------------------------
let treesMesh = null;
function generateAlpineForest() {
  if (treesMesh) {
    scene.remove(treesMesh);
    treesMesh.geometry.dispose();
  }

  const count = settingsManager.settings.treesCount || 800;
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
let routeLine = null;
let labels = [];
const checkpointGroup = new THREE.Group();
scene.add(checkpointGroup);

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

function getOrCreateAthleteMesh(athlete) {
  if (athleteMeshes.has(athlete.id)) {
    return athleteMeshes.get(athlete.id);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: markerTexture(athlete.bib, athlete.color),
    depthTest: false
  }));
  sprite.scale.set(28, 28, 1);
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
  // DEBUG: visibile ovunque così verifichiamo in browser prima di isolare su NDI
  sprite.layers.set(0);
  sprite.layers.enable(1);
  sprite.scale.set(60, 18.75, 1);
  return sprite;
}

function clearCheckpoints() {
  labels.forEach(({ el, sprite }) => {
    el.remove();
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
    new THREE.SphereGeometry(3.0, 16, 12),
    new THREE.MeshBasicMaterial({ color: isStart || isFinish ? '#ffffff' : settingsManager.settings.themeColor })
  );
  marker.position.copy(worldPos);
  marker.position.y += 3.5;
  checkpointGroup.add(marker);

  const el = document.createElement('div');
  el.className = 'label';
  el.dataset.cpId = id;
  el.dataset.isStart = isStart ? 'true' : 'false';
  el.dataset.isFinish = isFinish ? 'true' : 'false';
  el.innerHTML = `<span>${name}</span><small>${km} km · checkpoint</small>`;
  document.querySelector('#app').append(el);

  // Sprite NDI-only (layer 1) — visibile solo su Program 16:9
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
    const terrainY = terrainManager.getElevationAtWorld(v.x, v.z);
    v.y = Math.max(v.y, terrainY) + 2.5;
    return v;
  });

  if (routeLine) scene.remove(routeLine);

  routeCurve = new THREE.CatmullRomCurve3(worldPoints, false, 'centripetal');

  const tubeSegments = settingsManager.settings.tubeSegments || 600;
  const tubeGeo = new THREE.TubeGeometry(routeCurve, tubeSegments, 1.0, 6, false);
  routeLine = new THREE.Mesh(
    tubeGeo,
    new THREE.MeshStandardMaterial({
      color: '#fff5c0',
      emissive: settingsManager.settings.themeColor,
      emissiveIntensity: 0.65,
      roughness: 0.3
    })
  );
  scene.add(routeLine);

  clearCheckpoints();
  raceManager.checkpoints.forEach(cp => {
    let pt;
    if (cp.lat && cp.lon) {
      pt = terrainManager.coordToWorld(cp.lat, cp.lon, cp.ele);
      const terrainY = terrainManager.getElevationAtWorld(pt.x, pt.z);
      pt.y = Math.max(pt.y, terrainY) + 3.5;
    } else {
      const ratio = Math.min(0.999, Math.max(0.001, cp.km / raceManager.totalKm));
      pt = routeCurve.getPointAt(ratio);
    }
    add3DCheckpoint(cp.id, cp.name, cp.km.toFixed(1), pt, cp.isStart, cp.isFinish);
  });

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
  
  setScene('overview');
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

function setScene(sceneName) {
  activeScene = sceneName;
  document.querySelectorAll('[data-scene]').forEach(b => {
    b.classList.toggle('active', b.dataset.scene === sceneName);
  });

  const modeEl = document.querySelector('#mode');
  const selectedAthlete = raceManager.getSelectedAthlete();
  const ratio = selectedAthlete ? (selectedAthlete.km / raceManager.totalKm) : 0.45;

  if (sceneName === 'overview') {
    camera.position.set(0, 550, 950);
    controls.target.set(0, 70, 0);
    if (modeEl) modeEl.textContent = 'PANORAMICA 3D VALLE PREMANA';
  } else if (sceneName === 'runner' && routeCurve) {
    const p = routeCurve.getPointAt(ratio);
    camera.position.copy(p).add(new THREE.Vector3(95, 55, 115));
    controls.target.copy(p);
    if (modeEl) modeEl.textContent = `INSEGUIMENTO DRONE: ${selectedAthlete?.name || 'Leader'}`;
  } else if (sceneName === 'checkpoint' && routeCurve) {
    const p = routeCurve.getPointAt(14.5 / 32.0);
    camera.position.copy(p).add(new THREE.Vector3(-80, 50, 95));
    controls.target.copy(p);
    if (modeEl) modeEl.textContent = 'INQUADRATURA: BOCCHETTA DI LAREC (2070m)';
  } else if (sceneName === 'pizzo' && routeCurve) {
    const p = routeCurve.getPointAt(27.5 / 32.0);
    camera.position.copy(p).add(new THREE.Vector3(85, 65, -75));
    controls.target.copy(p);
    if (modeEl) modeEl.textContent = 'INQUADRATURA: ALPE DELEGUAGGIO';
  } else if (sceneName === 'topdown') {
    camera.position.set(0, 900, 10);
    controls.target.set(0, 40, 0);
    if (modeEl) modeEl.textContent = 'VISTA SATELLITARE ZENITH';
  }
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
      el.style.display = 'none';
      if (marker) marker.visible = false;
      if (sprite) sprite.visible = false;
      return;
    }
    if (isFinish && !showFinish) {
      el.style.display = 'none';
      if (marker) marker.visible = false;
      if (sprite) sprite.visible = false;
      return;
    }
    if (marker) marker.visible = true;
    if (sprite) sprite.visible = true;

    tempVec.copy(point).project(camera);
    const visible = tempVec.z < 1 && tempVec.x > -1.15 && tempVec.x < 1.15 && tempVec.y > -1.2 && tempVec.y < 1.2;
    el.style.display = visible ? 'block' : 'none';
    el.style.left = `${(tempVec.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-tempVec.y * 0.5 + 0.5) * innerHeight}px`;
  });
}

// Inizializza UI
renderAthletesList();
renderSplitsEditor();
updateRiderCard();

// ----------------------------------------------------
// 9. RENDER LOOP PRINCIPALE
// ----------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();

  if (routeCurve) {
    const state = raceManager.getState();
    const athletes = state.athletes;

    athletes.forEach(ath => {
      if (isAutoPlaying && ath.status === 'running') {
        ath.km = (ath.km + dt * 0.08) % raceManager.totalKm;
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
      if (activeScene === 'runner') {
        const ratio = Math.min(0.999, Math.max(0.001, selectedAthlete.km / raceManager.totalKm));
        const pt = routeCurve.getPointAt(ratio);
        targetPos.lerp(pt, 0.04);
        controls.target.copy(targetPos);
      }
    }
  }

  controls.update();

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
