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
scene.fog = new THREE.FogExp2('#9dbecd', 0.00068); // MAP-01: denser fog at edges to hide blue border, ponytail 0.00045→0.00068

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

// CONTROLLER virtuale — DJI style drone libero (non orbita) + slider zoom/tilt
let controllerActive = false;
let controllerOrbit = { x: 0, y: 0 }; // left stick: yaw (x), throttle (y) — per compatibilità orbita
let controllerZoomPan = { x: 0, y: 0 };
let controllerPan = { x: 0, y: 0 }; // right stick: x=strafe, y=forward
let controllerZoomDist = null;
let controllerSpeed = 1.0;
let controllerTilt = 0; // ghiera: -1..1 per tilt camera
// Drone libero: left Y=throttle up/down, left X=yaw, right Y=forward/back, right X=strafe, ghiera=tilt
let droneThrottle = 0, droneYaw = 0, dronePitch = 0, droneRoll = 0;
try {
  const ctrlChannel = new BroadcastChannel('giir_controller_channel');
  ctrlChannel.onmessage = (e) => {
    const d = e.data;
    if (!d || d.type !== 'controller') return;
    handleControllerMessage(d);
  };
} catch {}
let ctrlWs = null;
function connectControllerWs() {
  try {
    const url = `ws://${location.hostname || 'localhost'}:9998`;
    ctrlWs = new WebSocket(url);
    ctrlWs.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === 'controller') handleControllerMessage(d);
      } catch {}
    };
    ctrlWs.onclose = () => setTimeout(connectControllerWs, 2000);
  } catch {}
}
connectControllerWs();
function handleControllerMessage(d) {
  if (d.action === 'activate') controllerActive = !!d.active;
  if (d.action === 'orbit') {
    controllerOrbit = { x: d.x || 0, y: d.y || 0 };
    droneYaw = d.x || 0; droneThrottle = d.y || 0;
    if (d.x || d.y) controllerActive = true;
  }
  if (d.action === 'zoompan') controllerZoomPan = { x: d.x || 0, y: d.y || 0 };
  if (d.action === 'pan') {
    controllerPan = { x: d.x || 0, y: d.y || 0 };
    droneRoll = d.x || 0; dronePitch = d.y || 0;
    if (d.x || d.y) controllerActive = true;
  }
  if (d.action === 'tilt' && Number.isFinite(d.value)) { controllerTilt = d.value; controllerActive = true; }
  if (d.action === 'zoom' && Number.isFinite(d.dist)) controllerZoomDist = d.dist;
  if (d.action === 'zoom' && Number.isFinite(d.delta)) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = camera.position.distanceTo(controls.target);
    const nd = THREE.MathUtils.clamp(dist - d.delta * 18, 40, 1200);
    camera.position.copy(controls.target).add(dir.multiplyScalar(nd));
    controllerActive = true;
  }
  if (d.action === 'speed' && Number.isFinite(d.value)) controllerSpeed = Math.max(0.3, Math.min(2.5, d.value));
  if (d.action === 'scene' && d.scene) setScene(d.scene);
  if (d.action === 'timeline' && Number.isFinite(d.km)) {
    const ath = raceManager.getSelectedAthlete();
    if (ath) { raceManager.updateAthleteKm(ath.id, d.km); simElapsedSec = kmToElapsedSec(d.km); }
  }
  if (d.action === 'playpause') isAutoPlaying = !isAutoPlaying;
}

// Illuminazione Montana Naturale e Chiara (luce bianca pulita, niente dominante gialla)
const hemiLight = new THREE.HemisphereLight('#f2f8ff', '#2d3b32', 2.2);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight('#ffffff', 3.2);
sun.position.set(-560, 920, 460);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); // revert to 1024 for NDI broadcast quality (Closes #149)
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
    // PERF-08: NDI FPS 25/50
    if (settings.ndiFps && ndiStreamer && settings.ndiFps !== ndiStreamer.targetFps) {
      ndiStreamer.setFps(settings.ndiFps);
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
     } else if (e.data?.type === 'GPX_UPDATED') {
       const pts = e.data.points;
       if (pts && pts.length >= 2) {
         const gpxText = `<?xml version="1.0" encoding="UTF-8"?><gpx><trk><name>Custom GPX</name><trkseg>${pts.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele></trkpt>`).join('')}</trkseg></trk></gpx>`;
         parseGpxAndBuild(gpxText, 'Custom GPX');
       }
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

  const count = 600; // PERF-05: test 600 for density, ponytail 800→600 -25% instances, LOD billboard if needed
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
let cachedWorldPoints = []; // PROG-02: cache for dynamic bicolor refresh
let lastLeaderRatioForBicolor = -1;
let progFrameCounter = 0;
let labels = [];
const checkpointGroup = new THREE.Group();
scene.add(checkpointGroup);
let archGroup = null; // P8 arco gonfiabile rosso Bocchetta Larec 14.5km — must stay

const athleteMeshes = new Map();
let progressMarker = null;
let progressMarkerGlow = null;

function createProgressMarker() {
  if (progressMarker) { scene.remove(progressMarker); progressMarker.geometry.dispose(); progressMarker.material.dispose(); }
  if (progressMarkerGlow) { scene.remove(progressMarkerGlow); progressMarkerGlow.geometry.dispose(); progressMarkerGlow.material.dispose(); }
  const markerGeo = new THREE.SphereGeometry(1.5, 16, 12);
  const markerMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  progressMarker = new THREE.Mesh(markerGeo, markerMat);
  progressMarker.visible = settingsManager.settings.showProgressMarker;
  scene.add(progressMarker);
  const glowGeo = new THREE.SphereGeometry(3.0, 16, 12);
  const glowMat = new THREE.MeshBasicMaterial({ color: settingsManager.settings.themeColor, transparent: true, opacity: 0.3 });
  progressMarkerGlow = new THREE.Mesh(glowGeo, glowMat);
  progressMarkerGlow.visible = settingsManager.settings.showProgressMarker;
  scene.add(progressMarkerGlow);
}

function updateProgressMarker() {
  if (!routeCurve || !settingsManager.settings.showProgressMarker) {
    if (progressMarker) progressMarker.visible = false;
    if (progressMarkerGlow) progressMarkerGlow.visible = false;
    return;
  }
  const selectedAthlete = raceManager.getSelectedAthlete();
  if (!selectedAthlete) return;
  const ratio = Math.min(0.999, Math.max(0.001, selectedAthlete.km / raceManager.totalKm));
  const pt = routeCurve.getPointAt(ratio);
  progressMarker.position.copy(pt).add(new THREE.Vector3(0, 3, 0));
  progressMarkerGlow.position.copy(pt).add(new THREE.Vector3(0, 3, 0));
  progressMarker.visible = true;
  progressMarkerGlow.visible = true;
  progressMarker.material.color.set(settingsManager.settings.themeColor);
  progressMarkerGlow.material.color.set(settingsManager.settings.themeColor);
}

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

// PROG-03: Rimuovere indicatore leader grande — no sprite, only light (Closes #150)
function getOrCreateAthleteMesh(athlete) {
  if (athleteMeshes.has(athlete.id)) {
    return athleteMeshes.get(athlete.id);
  }
  // No sprite — track rainbow shows progress. Only ambient light per athlete.
  const light = new THREE.PointLight(athlete.color, 2.0, 60);
  scene.add(light);

  const entry = { sprite: null, light };
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
  labels.forEach(({ el, sprite, marker, dot }) => {
    if (el) el.remove();
    if (sprite) {
      if (sprite.material.map) sprite.material.map.dispose();
      sprite.material.dispose();
    }
    if (marker) { if (marker.geometry) marker.geometry.dispose(); if (marker.material) marker.material.dispose(); }
    if (dot) { if (dot.geometry) dot.geometry.dispose(); if (dot.material) dot.material.dispose(); }
  });
  checkpointGroup.clear();
  labels = [];
}

function add3DCheckpoint(id, name, km, worldPos, isStart = false, isFinish = false) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: isStart || isFinish ? '#ffffff' : settingsManager.settings.themeColor })
  );
  marker.position.copy(worldPos);
  marker.position.y += 3.5;
  checkpointGroup.add(marker);

  // PROG-04: checkpoint marker piccolo r=1.0 lungo traccia — sempre visibile indipendente da leader — ponytail: MeshBasicMaterial low cost, no shadow
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 8),
    new THREE.MeshBasicMaterial({ color: settingsManager.settings.themeColor })
  );
  dot.position.copy(worldPos);
  dot.position.y += 1.2; // leggermente sopra traccia
  checkpointGroup.add(dot);

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
    dot, // PROG-04: keep ref for zoomScale, never hidden by showStart/showFinish
    point: worldPos.clone().add(new THREE.Vector3(0, 10, 0))
  });
}

function rebuildTrack3D() {
  if (rawTrackPoints.length < 2) return;

  function chaikinSmooth(points, iterations = 2) {
    if (iterations <= 0 || points.length < 2) return points.map(v => v.clone());
    let result = points.map(v => v.clone());
    for (let iter = 0; iter < iterations; iter++) {
      const next = [];
      for (let i = 0; i < result.length - 1; i++) {
        const p0 = result[i];
        const p1 = result[i + 1];
        next.push(
          new THREE.Vector3(0.75 * p0.x + 0.25 * p1.x, 0.75 * p0.y + 0.25 * p1.y, 0.75 * p0.z + 0.25 * p1.z),
          new THREE.Vector3(0.25 * p0.x + 0.75 * p1.x, 0.25 * p0.y + 0.75 * p1.y, 0.25 * p0.z + 0.75 * p1.z)
        );
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

  // PROG-01: single full-track tube + rainbow vertex colors (Closes #146)
  if (routeLineTraveled) { scene.remove(routeLineTraveled); routeLineTraveled.geometry.dispose(); if (routeLineTraveled.material) routeLineTraveled.material.dispose(); }
  if (routeLineRemaining) { scene.remove(routeLineRemaining); routeLineRemaining.geometry.dispose(); if (routeLineRemaining.material) routeLineRemaining.material.dispose(); }
  if (routeLine) { scene.remove(routeLine); if (routeLine.geometry) routeLine.geometry.dispose(); routeLine = null; }

  const roughCurve = new THREE.CatmullRomCurve3(worldPoints, false, 'centripetal');
  const smoothPoints = roughCurve.getPoints(2000);
  routeCurve = new THREE.CatmullRomCurve3(smoothPoints, false, 'centripetal');

  // Single full-track tube with rainbow vertex colors (no split)
  const leader0 = raceManager.getSelectedAthlete();
  const leaderRatio0 = leader0 ? Math.min(0.999, Math.max(0.001, leader0.km / raceManager.totalKm)) : 0;
  const tubeGeo = new THREE.TubeGeometry(routeCurve, 1000, 1.1, 8, false);
  const posAttr = tubeGeo.attributes.position;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const tHead = performance.now() * 0.0003;
  for (let i = 0; i < count; i++) {
    const ratio = i / count;
    let r, g, b;
    const trackStyle = settingsManager.settings.trackStyle || 'rainbow';
    const trackSpeed = 0.0001; // slow rainbow ~63s full cycle
    if (ratio <= leaderRatio0) {
      if (trackStyle === 'solid') {
        const tc = new THREE.Color(settingsManager.settings.trackTravelColor);
        r = tc.r; g = tc.g; b = tc.b;
      } else {
        const hue = ((ratio * 4 + tHead * trackSpeed) % 1.0);
        const col = new THREE.Color().setHSL(hue, 1.0, 0.55);
        r = col.r; g = col.g; b = col.b;
      }
    } else {
      const rc = new THREE.Color(settingsManager.settings.trackRemainingColor);
      r = rc.r; g = rc.g; b = rc.b;
    }
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  routeLineTraveled = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }));
  scene.add(routeLineTraveled);
  routeLine = routeLineTraveled;

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
  archGroup = createArch({ height: 7, width: 8, tubeRadius: 1.6, color: '#be0000' });
  const archRatio = Math.min(0.999, Math.max(0.001, 14.5 / raceManager.totalKm));
  placeArchAtRoute(archGroup, routeCurve, archRatio, terrainManager);
  archGroup.rotation.y += THREE.MathUtils.degToRad(120); // Alto
  archGroup.rotation.z += THREE.MathUtils.degToRad(-25); // Frontale 
  archGroup.rotation.x = THREE.MathUtils.degToRad(0);  // Laterale
  archGroup.position.y -= 5.0; 
  archGroup.position.x -= 6.0; 
  archGroup.position.z += 4.0; //avanti
  scene.add(archGroup);

  if (elevationProfile && typeof elevationProfile.setTrackData === 'function') {
    elevationProfile.setTrackData(rawTrackPoints, raceManager.checkpoints);
  }
}

// PROG-02: rainbow neon track — single full tube + vertex colors, no seam (Closes #146)
function refreshBicolorTrack() {
  if (!routeCurve || !cachedWorldPoints.length) return;
  const leader = raceManager.getSelectedAthlete();
  const leaderRatio = leader ? Math.min(0.999, Math.max(0.001, leader.km / raceManager.totalKm)) : 0;
  if (Math.abs(leaderRatio - lastLeaderRatioForBicolor) < 0.002) return;
  lastLeaderRatioForBicolor = leaderRatio;
  if (routeLineTraveled) { scene.remove(routeLineTraveled); routeLineTraveled.geometry.dispose(); routeLineTraveled.material.dispose(); }
  if (routeLineRemaining) { scene.remove(routeLineRemaining); routeLineRemaining.geometry.dispose(); routeLineRemaining.material.dispose(); }

  const worldPoints = cachedWorldPoints;
  const roughCurve = new THREE.CatmullRomCurve3(worldPoints, false, 'centripetal');
  const smoothPoints = roughCurve.getPoints(2000);
  const curve = new THREE.CatmullRomCurve3(smoothPoints, false, 'centripetal');
  const tubeGeo = new THREE.TubeGeometry(curve, 1000, 1.1, 8, false);

  // vertex colors: rainbow neon for traveled, dim for remaining
   const posAttr = tubeGeo.attributes.position;
   const count = posAttr.count;
   const colors = new Float32Array(count * 3);
   const trackStyle = settingsManager.settings.trackStyle || 'rainbow';
   const trackSpeed = 0.0001; // slow rainbow ~63s full cycle
   const tHead = performance.now() * trackSpeed; // slow time shift for "moving" rainbow

   for (let i = 0; i < count; i++) {
     const z = posAttr.getZ(i);
     // approximate ratio from z position along tube (0=start, 1=end)
     const ratio = i / count;
     let r, g, b;
     if (ratio <= leaderRatio) {
       if (trackStyle === 'solid') {
         const tc = new THREE.Color(settingsManager.settings.trackTravelColor);
         r = tc.r; g = tc.g; b = tc.b;
       } else {
         // traveled: bright neon rainbow cycling hue (slow)
         const hue = ((ratio * 4 + tHead) % 1.0);
         const col = new THREE.Color().setHSL(hue, 1.0, 0.55);
         r = col.r; g = col.g; b = col.b;
       }
     } else {
       // remaining: custom color
       const rc = new THREE.Color(settingsManager.settings.trackRemainingColor);
       r = rc.r; g = rc.g; b = rc.b;
     }
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: '#000000',
    roughness: 0.4,
    metalness: 0.1,
  });

  routeLineTraveled = new THREE.Mesh(tubeGeo, mat);
  scene.add(routeLineTraveled);
  routeLine = routeLineTraveled;
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
  createProgressMarker();
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
let activeScene = settingsManager.settings.activeScene || 'overview';
let topdownZoomed = false; // M key toggle (Closes #148)
let isAutoPlaying = true;
const targetPos = new THREE.Vector3();
let manualFollow = false;
let manualFollowOffset = new THREE.Vector3(); // offset camera→atleta in modalità manuale

// CAM-05: presets Close/Wide/Helicopter — ponytail: 3 presets + default, persisted
const camPresets = {
  close: { dist: 40, height: 20 },
  wide: { dist: 100, height: 60 },
  helicopter: { dist: 200, height: 120 },
  default: { dist: 95, height: 55 }
};
let currentCamPreset = settingsManager.settings.cameraPreset || 'default';
let camPresetTween = null; // CAM-06: 1.8s ease for preset switches
let lastCamPreset = currentCamPreset;
function setCamPreset(name) {
  if (!camPresets[name]) return;
  if (name === currentCamPreset) return;
  // capture start for 1.8s tween
  camPresetTween = { startPos: camera.position.clone(), elapsed: 0, duration: 1.8 };
  lastCamPreset = currentCamPreset;
  currentCamPreset = name;
  try { settingsManager.update({ cameraPreset: name }); } catch {}
}

// ponytail: native lerp + easeInOutCubic instead of GSAP — stdlib Math, ~40 lines, no new dep; upgrade to GSAP/Bezier if director wants spline easing
let camTween = null; // { startPos, endPos, startTarget, endTarget, elapsed, duration }
let ndiTween = null; // TRANS-01: NDI-only tween — ponytail: separate from camTween
const ndiTarget = new THREE.Vector3(0, 70, 0);
let ndiQueue = []; // TRANS-02: queue — ponytail: array of {sceneName, params}
 function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

 // TRANS-LOCK: blocca bottoni scene durante transizione NDI
 function setSceneButtonsDisabled(disabled) {
   document.querySelectorAll('[data-scene]').forEach(b => {
     b.disabled = disabled;
     b.style.opacity = disabled ? '0.4' : '1';
     b.style.pointerEvents = disabled ? 'none' : 'auto';
   });
 }

 function getSceneParams(name) {
  const selectedAthlete = raceManager.getSelectedAthlete();
  const ratio = selectedAthlete ? (selectedAthlete.km / raceManager.totalKm) : 0.45;
  if (name === 'overview') return { pos: new THREE.Vector3(0, 480, 760), target: new THREE.Vector3(0, 70, 0), label: 'PANORAMICA 3D VALLE PREMANA' };
  if (name === 'runner' && routeCurve) { const p = routeCurve.getPointAt(ratio); return { pos: p.clone().add(new THREE.Vector3(95, 55, 115)), target: p.clone(), label: `INSEGUIMENTO DRONE: ${selectedAthlete?.name || 'Leader'}` }; }
  if (name === 'checkpoint' && routeCurve) { const p = routeCurve.getPointAt(14.5 / 32.0); return { pos: p.clone().add(new THREE.Vector3(-80, 50, 95)), target: p.clone(), label: 'INQUADRATURA: BOCCHETTA DI LAREC (2070m)' }; }
  // Pizzo Alto removed (Closes #143)
  if (name === 'topdown') {
    if (topdownZoomed) return { pos: new THREE.Vector3(0, 500, 10), target: new THREE.Vector3(0, 40, 0), label: 'ZOOM PREMANA (M per toggle)' };
    return { pos: new THREE.Vector3(0, 900, 10), target: new THREE.Vector3(0, 40, 0), label: 'VISTA SATELLITARE ZENITH' };
  }
  return null;
}
// TRANS-03: variable duration per pair — ponytail: map, fallback 1.8s
function getTransitionDuration(from, to) {
  const key = `${from}->${to}`;
  const map = {
    'overview->runner': 2.5,
    'runner->overview': 2.5,
    'overview->checkpoint': 1.5,
    'checkpoint->overview': 1.5,
    'checkpoint->topdown': 1.5,
    'topdown->checkpoint': 1.5,
    'runner->checkpoint': 2.0,
    'checkpoint->runner': 2.0,
  };
  return map[key] ?? 1.8;
}
function setScene(sceneName, opts = {}) {
  const fromScene = activeScene;
  const durFromMap = getTransitionDuration(fromScene, sceneName);
  const { instant = false, duration = durFromMap } = opts; // ponytail: per-pair duration, opts overrides
  activeScene = sceneName;
  try { settingsManager.update({ activeScene: sceneName }); } catch {}
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === sceneName));
  const params = getSceneParams(sceneName);
  if (!params) return;
  const modeEl = document.querySelector('#mode');
  if (modeEl) modeEl.textContent = params.label;
  if (instant || !routeCurve) { camera.position.copy(params.pos); controls.target.copy(params.target); targetPos.copy(params.target); programCamera.position.copy(params.pos); ndiTarget.copy(params.target); camTween = null; ndiTween = null; ndiQueue = []; return; }
  // TRANS-02: queue — if NDI tween active, push and return (never interrupt)
  if (ndiTween) {
    ndiQueue.push({ sceneName, params });
    return;
  }
   // TRANS-01: tween both NDI programCamera AND browser camera (Closes #145)
   ndiTween = { startPos: programCamera.position.clone(), endPos: params.pos.clone(), startTarget: ndiTarget.clone(), endTarget: params.target.clone(), elapsed: 0, duration };
   camTween = { startPos: camera.position.clone(), endPos: params.pos.clone(), startTarget: controls.target.clone(), endTarget: params.target.clone(), elapsed: 0, duration };
   setSceneButtonsDisabled(true);
 }

document.querySelectorAll('[data-scene]').forEach(b => {
  b.addEventListener('click', () => setScene(b.dataset.scene));
});

// Tastiera
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  // CAM-05: preset Shift+1/2/3 — close/wide/helicopter
  if (e.shiftKey && e.code === 'Digit1') { setCamPreset('close'); return; }
  if (e.shiftKey && e.code === 'Digit2') { setCamPreset('wide'); return; }
  if (e.shiftKey && e.code === 'Digit3') { setCamPreset('helicopter'); return; }
  if (e.key === '1') setScene('overview');
  if (e.key === '2') setScene('runner');
  if (e.key === '3') setScene('checkpoint');
  if (e.key === '5' || e.key === '4') setScene('topdown');
  // M key: toggle topdown zoom in/out (Closes #148)
  if (e.key.toLowerCase() === 'm' && activeScene === 'topdown') {
    topdownZoomed = !topdownZoomed;
    const zp = getSceneParams('topdown');
    if (zp) { camTween = { startPos: camera.position.clone(), endPos: zp.pos.clone(), startTarget: controls.target.clone(), endTarget: zp.target.clone(), elapsed: 0, duration: 0.8 }; }
  }
  if (e.key === ' ') {
    isAutoPlaying = !isAutoPlaying;
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'c') {
    document.body.classList.toggle('clean');
  }
  if (e.key.toLowerCase() === 'f' && activeScene === 'runner' && routeCurve) {
    manualFollow = !manualFollow;
    const selectedAthlete = raceManager.getSelectedAthlete();
    if (manualFollow && selectedAthlete) {
      const ratio = Math.min(0.999, Math.max(0.001, selectedAthlete.km / raceManager.totalKm));
      const pt = routeCurve.getPointAt(ratio);
      manualFollowOffset.copy(camera.position).sub(pt);
    }
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
  // RACE-06: tempi dettagliati — ponytail: 4 calcs, no lib
  const opElapsed = document.querySelector('#op-elapsed');
  const opRemaining = document.querySelector('#op-remaining');
  const opPace = document.querySelector('#op-pace');
  const opPercent = document.querySelector('#op-percent');
  if (opElapsed) opElapsed.textContent = formatSecToTime(simElapsedSec);
  if (opRemaining) {
    const rem = Math.max(0, getDurationSec() - simElapsedSec);
    opRemaining.textContent = `-${formatSecToTime(rem)}`;
  }
  if (opPercent) opPercent.textContent = `${((athlete.km / raceManager.totalKm)*100).toFixed(1)}%`;
  if (opPace) {
    // pace of current segment (min/km)
    let paceTxt = '-- min/km';
    try {
      const cps = raceManager.checkpoints;
      const pts = [];
      for (const cp of cps) {
        const sec = parseTimeToSec(raceManager.defaultSplits2025?.splits?.[cp.id] || cp.refSplit);
        if (sec != null) pts.push({ km: cp.km, sec });
      }
      pts.sort((a,b)=>a.sec-b.sec);
      const e = simElapsedSec % (pts[pts.length-1]?.sec || getDurationSec());
      for (let i=0;i<pts.length-1;i++) {
        if (e >= pts[i].sec && e <= pts[i+1].sec) {
          const dKm = pts[i+1].km - pts[i].km;
          const dSec = pts[i+1].sec - pts[i].sec;
          if (dKm > 0 && dSec > 0) {
            const minPerKm = (dSec/60) / dKm;
            const m = Math.floor(minPerKm);
            const s = String(Math.round((minPerKm - m)*60)).padStart(2,'0');
            paceTxt = `${m}:${s} min/km`;
          }
          break;
        }
      }
    } catch {}
    opPace.textContent = paceTxt;
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
      const km = parseFloat(e.target.value);
      raceManager.updateAthleteKm(athlete.id, km);
      // RACE-05: slider syncs global clock so next frame continues from scrubbed km — works in realtime mode too
      simElapsedSec = kmToElapsedSec(km);
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

  labels.forEach(({ el, sprite, point, isStart, isFinish, marker, dot }) => {
    // PROG-04 dot stays always visible independent of leader
    if (dot) dot.visible = true;
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
function formatSecToTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
var simElapsedSec = 0; // fix: var hoisted to avoid TDZ before updateRiderCard() top-level call (was let)
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
// RACE-05: pausa/riavvolgimento — ponytail: reverse lookup km->sec, plain loop, no lib
function kmToElapsedSec(km) {
  const cps = raceManager.checkpoints;
  const pts = [];
  for (const cp of cps) {
    const sec = parseTimeToSec(raceManager.defaultSplits2025?.splits?.[cp.id] || cp.refSplit);
    if (sec != null) pts.push({ km: cp.km, sec, ele: cp.ele });
  }
  pts.sort((a,b)=>a.km-b.km);
  if (!pts.length) return 0;
  if (km <= pts[0].km) return pts[0].sec;
  if (km >= pts[pts.length-1].km) return pts[pts.length-1].sec;
  for (let i=0;i<pts.length-1;i++) {
    const a = pts[i], b = pts[i+1];
    if (km >= a.km && km <= b.km) {
      const dist = b.km - a.km;
      let r = dist === 0 ? 0 : (km - a.km)/dist;
      const eleDelta = (b.ele ?? 0) - (a.ele ?? 0);
      let factor = 1.0;
      if (eleDelta > 80) factor = 1.25;
      else if (eleDelta < -80) factor = 0.85;
      if (factor !== 1.0) r = Math.pow(r, 1/factor); // invert RACE-04 exponent
      return a.sec + r * (b.sec - a.sec);
    }
  }
  return pts[pts.length-1].sec;
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  // CONTROLLER drone libero — yaw ruota camera su se stessa (non orbita), throttle alza/abbassa
  if (controllerActive) {
    const s = controllerSpeed;
    const moveSpeed = 6 * s * dt * 60; // più lento (prima 12)
    const rotSpeed = 0.45 * s * dt * 60; // più lento (prima 0.9)
    // left stick X = yaw: ruota target attorno a camera su asse Y (drone yaw vero)
    if (Math.abs(droneYaw) > 0.05) {
      const angle = -droneYaw * rotSpeed * 0.04;
      const dir = new THREE.Vector3().subVectors(controls.target, camera.position);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      controls.target.copy(camera.position).add(dir);
    }
    if (Math.abs(droneThrottle) > 0.05) {
      const up = new THREE.Vector3(0, 1, 0);
      const delta = up.multiplyScalar(droneThrottle * moveSpeed * 0.6);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    if (Math.abs(dronePitch) > 0.05) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();
      const delta = forward.multiplyScalar(dronePitch * moveSpeed * 0.9);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    if (Math.abs(droneRoll) > 0.05) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const delta = right.multiplyScalar(droneRoll * moveSpeed * 0.9);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    // ghiera tilt
    if (Math.abs(controllerTilt) > 0.08) {
      const dir = new THREE.Vector3().subVectors(controls.target, camera.position);
      const dist = dir.length();
      const axis = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const angle = controllerTilt * rotSpeed * 0.025;
      dir.applyAxisAngle(axis, angle);
      controls.target.copy(camera.position).add(dir.normalize().multiplyScalar(dist));
    }
    // zoom via slider (se presente) — lerp dolce
    if (controllerZoomDist !== null) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const curDist = camera.position.distanceTo(controls.target);
      const newDist = THREE.MathUtils.clamp(THREE.MathUtils.lerp(curDist, controllerZoomDist, 0.12), 40, 1200);
      camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
    }
    // fallback orbita per compatibilità telefono vecchio (se drone* a 0 ma orbit non zero)
    if ((Math.abs(controllerOrbit.x) > 0.05 || Math.abs(controllerOrbit.y) > 0.05) && Math.abs(droneYaw) < 0.05 && Math.abs(droneThrottle) < 0.05) {
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta -= controllerOrbit.x * 0.06 * s;
      spherical.phi -= controllerOrbit.y * 0.05 * s;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.15, Math.PI * 0.48);
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical).add(controls.target);
    }
    controls.update();
  }

    if (routeCurve) {
      if (isAutoPlaying) {
        const speed = settingsManager.settings.simulationSpeed ?? 1;
        simElapsedSec = (simElapsedSec + dt * speed) % getDurationSec();
      }
      // FOG: remove fog in zenith scene (scene 4) for clear top-down view
      if (activeScene === 'topdown') {
        if (scene.fog) scene.fog.density = 0;
      } else {
        if (scene.fog) scene.fog.density = 0.00068;
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
      if (entry.sprite) entry.sprite.position.copy(pt).add(new THREE.Vector3(0, 14 + Math.sin(performance.now() * 0.005) * 1.2, 0));
      entry.light.position.copy(pt).add(new THREE.Vector3(0, 10, 0));
    });
    // PROG-02: refresh bicolor every 5 frames — ponytail: throttled, deadband 0.2% avoids rebuild jitter
    if (++progFrameCounter % 5 === 0) refreshBicolorTrack();
    updateProgressMarker();

    const selectedAthlete = raceManager.getSelectedAthlete();
      if (selectedAthlete) {
        updateRiderCard();
        if (activeScene === 'runner' && !camTween) {
          const ratio = Math.min(0.999, Math.max(0.001, selectedAthlete.km / raceManager.totalKm));
          const pt = routeCurve.getPointAt(ratio);
          if (manualFollow) {
            camera.position.copy(pt).add(manualFollowOffset);
            controls.target.copy(pt);
          } else {
            // CAM-01: camera follow con offset tangente — ponytail: tangent*-dist + up*height, frame-rate independent lerp
            const tangent = routeCurve.getTangentAt(ratio).normalize();
            const baseDist = camPresets[currentCamPreset]?.dist ?? 95;
            const baseHeight = camPresets[currentCamPreset]?.height ?? 55;
            const camDistBack = baseDist; // calibration knob dist behind leader
            // CAM-04: height adaptive to slope — ponytail: Δele between verts, downhill +height, uphill -height
            const slopeProbeRatio = Math.min(0.999, ratio + 0.005);
            const ptSlopeProbe = routeCurve.getPointAt(slopeProbeRatio);
            const slopeDelta = ptSlopeProbe.y - pt.y;
            const camHeight = baseHeight + 3 + THREE.MathUtils.clamp(-slopeDelta * 2.5, -12, 18); // +3 base, adaptive range (Closes #144)
            const idealCamPos = pt.clone().add(tangent.clone().multiplyScalar(-camDistBack)).add(new THREE.Vector3(0, camHeight, 0));
            // CAM-06: preset tween 1.8s easeInOutCubic if active, else continuous follow lerp
            if (camPresetTween) {
              camPresetTween.elapsed += dt;
              let t = Math.min(1, camPresetTween.elapsed / camPresetTween.duration);
              const e = easeInOutCubic(t);
              camera.position.lerpVectors(camPresetTween.startPos, idealCamPos, e);
              if (t >= 1) camPresetTween = null;
            } else {
              const camLerp = 1 - Math.exp(-2 * dt); // smoother follow (Closes #144)
              camera.position.lerp(idealCamPos, camLerp);
            }
            // CAM-02: raycast collision — keep 15m above terrain, lateral nudge if too low
            const terrainY = terrainManager.getElevationAtWorld(camera.position.x, camera.position.z);
            const minY = terrainY + 15;
            if (camera.position.y < minY) {
              camera.position.y = THREE.MathUtils.lerp(camera.position.y, minY, 0.15);
              const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
              camera.position.add(perp.multiplyScalar(5 * dt));
            }
            // CAM-03: look-ahead 15-20m (spec) — ponytail: 18m via routeCurve tangent, calibration knob
            const leadKm = 0.025;
            const deadZone = 3.0;
            const ratioAhead = Math.min(0.999, Math.max(0.001, (selectedAthlete.km + leadKm) / raceManager.totalKm));
            const ptAhead = routeCurve.getPointAt(ratioAhead);
            if (targetPos.distanceTo(ptAhead) > deadZone) {
              targetPos.lerp(ptAhead, 0.02);
            }
            controls.target.copy(targetPos);
          }
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

  // YOU-24 + DJI RC-N1: gamepad poll — left stick orbit, right stick zoom+pan, D-pad scenes, dead-zone 0.15, speed via controllerSpeed
  try {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp && gp.connected) {
      const dz = 0.15;
      const s = controllerSpeed || 1.0;
      const lx = Math.abs(gp.axes[0] || 0) > dz ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1] || 0) > dz ? gp.axes[1] : 0;
      if ((lx || ly) && !camTween) {
        const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
        sph.theta -= lx * 0.05 * s;
        sph.phi = THREE.MathUtils.clamp(sph.phi + ly * 0.05 * s, 0.1, Math.PI * 0.48);
        camera.position.setFromSpherical(sph).add(controls.target);
      }
      const rx = Math.abs(gp.axes[2] || 0) > dz ? gp.axes[2] : 0;
      const ry = Math.abs(gp.axes[3] || 0) > dz ? gp.axes[3] : 0;
      if (ry && !camTween) {
        const dir = camera.position.clone().sub(controls.target);
        const dist = dir.length();
        const nd = THREE.MathUtils.clamp(dist + ry * dist * 0.06 * s, controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(nd));
      }
      if (rx && !camTween) {
        const camDir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        const right = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();
        const delta = right.multiplyScalar(rx * 8 * s);
        controls.target.add(delta);
        camera.position.add(delta);
      }
      // D-pad → scenes (edge trigger, no repeat while held)
      const dpadBtns = [12, 15, 13, 14]; // up,right,down,left → overview,runner,checkpoint,topdown
      const dpadScenes = ['overview', 'runner', 'checkpoint', 'topdown'];
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
  labels.forEach(({ marker, sprite, dot }) => {
    if (marker) marker.scale.setScalar(zoomScale);
    if (sprite) sprite.scale.set(80 * zoomScale, 25 * zoomScale, 1); // UI-05 match 80×25
    if (dot) dot.scale.setScalar(zoomScale); // PROG-04 keep dot proportional
  });
  athleteMeshes.forEach(({ sprite }) => {
    if (sprite) sprite.scale.set(28 * zoomScale, 28 * zoomScale, 1);
  });
  // NON scalare routeLine e treesMesh come mesh intera (sposterebbe la geometria sotto la montagna)
  // Per tracciato e alberi lo scaling va fatto su geometria/instanza, per ora lasciato a 1 per stabilità

  // TRANS-01/02: NDI-only + queue — tween moves only programCamera, browser holds
  if (ndiTween) {
    ndiTween.elapsed += dt;
    let t = Math.min(1, ndiTween.elapsed / ndiTween.duration);
    const e = easeInOutCubic(t);
    programCamera.position.lerpVectors(ndiTween.startPos, ndiTween.endPos, e);
    ndiTarget.lerpVectors(ndiTween.startTarget, ndiTween.endTarget, e);
    programCamera.lookAt(ndiTarget);
     if (t >= 1) {
       ndiTween = null;
       // TRANS-02/03: dequeue next if queued — TRANS-03 variable duration per pair
       if (ndiQueue.length) {
         const next = ndiQueue.shift();
         const from = activeScene;
         activeScene = next.sceneName;
         try { settingsManager.update({ activeScene: next.sceneName }); } catch {}
         document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === next.sceneName));
         const modeEl = document.querySelector('#mode');
         if (modeEl) modeEl.textContent = next.params.label;
         const dur = getTransitionDuration(from, next.sceneName);
         ndiTween = { startPos: programCamera.position.clone(), endPos: next.params.pos.clone(), startTarget: ndiTarget.clone(), endTarget: next.params.target.clone(), elapsed: 0, duration: dur };
         // keep buttons disabled while next tween is active
       } else {
         setSceneButtonsDisabled(false);
       }
     }
   } else {
     programCamera.copy(camera);
     ndiTarget.copy(controls.target);
     // if queue has pending but no tween (edge case)
     if (ndiQueue.length) {
       const next = ndiQueue.shift();
       const from = activeScene;
       activeScene = next.sceneName;
       try { settingsManager.update({ activeScene: next.sceneName }); } catch {}
       document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === next.sceneName));
       const modeEl = document.querySelector('#mode');
       if (modeEl) modeEl.textContent = next.params.label;
       const dur = getTransitionDuration(from, next.sceneName);
       ndiTween = { startPos: programCamera.position.clone(), endPos: next.params.pos.clone(), startTarget: ndiTarget.clone(), endTarget: next.params.target.clone(), elapsed: 0, duration: dur };
       setSceneButtonsDisabled(true);
     }
   }
  // TRANS-04: indicator visivo browser sopra profilo
  const transEl = document.querySelector('#transition-indicator');
  if (transEl) transEl.style.display = ndiTween ? 'block' : 'none';
  // TRANS-05: tally giallo TRANSIZIONE vs rosso ON-PROGRAM
  const tallyEl = document.querySelector('#tally-indicator');
  const badgeEl = document.querySelector('#ndi-badge');
  if (ndiTween) {
    if (tallyEl) { tallyEl.className = 'tally-tag preview'; tallyEl.textContent = 'TRANSIZIONE'; }
    if (badgeEl) badgeEl.className = 'ndi-badge preview';
  } else if (tallyEl && tallyEl.textContent === 'TRANSIZIONE') {
    // restore after transition — trigger status refresh
    const s = ndiStreamer.status;
    if (s && s.tally && s.tally.onProgram) {
      tallyEl.className = 'tally-tag program'; tallyEl.textContent = 'ON-PROGRAM (LIVE)';
      if (badgeEl) badgeEl.className = 'ndi-badge on-program';
    } else if (s && s.tally && s.tally.onPreview) {
      tallyEl.className = 'tally-tag preview'; tallyEl.textContent = 'ON-PREVIEW';
      if (badgeEl) badgeEl.className = 'ndi-badge preview';
    } else {
      tallyEl.className = 'tally-tag'; tallyEl.textContent = s && s.active ? 'NDI TRASMETTE' : 'NDI STANDBY';
      if (badgeEl) badgeEl.className = s && s.active ? 'ndi-badge live' : 'ndi-badge offline';
    }
  }
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
