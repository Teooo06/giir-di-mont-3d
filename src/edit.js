import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TerrainManager } from './terrain-manager.js';
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
  const el = document.querySelector('#edit-trees-info');
  if (el) el.textContent = `${planted} alberi piazzati (600 richiesti)`;
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
  const marker = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshBasicMaterial({ color: isStart || isFinish ? '#ffffff' : settingsManager.settings.themeColor }));
  marker.position.copy(worldPos); marker.position.y += 3.5; checkpointGroup.add(marker);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: settingsManager.settings.themeColor }));
  dot.position.copy(worldPos); dot.position.y += 1.2; checkpointGroup.add(dot);
  const sprite = createCheckpointLabelSprite(name, km, settingsManager.settings.themeColor);
  sprite.position.copy(worldPos).add(new THREE.Vector3(0, 18, 0)); checkpointGroup.add(sprite);
  labels.push({ sprite, marker, dot, point: worldPos.clone().add(new THREE.Vector3(0, 10, 0)) });
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
  if (elevationProfile && typeof elevationProfile.setTrackData === 'function') elevationProfile.setTrackData(rawTrackPoints, raceManager.checkpoints);
  // update edit panels
  const gpxList = document.querySelector('#edit-gpx-list');
  if (gpxList) gpxList.innerHTML = `<div style="font:11px monospace; opacity:0.7;">${rawTrackPoints.length} punti · ${cachedWorldPoints.length} world (+Chaikin) · ${routeCurve ? 'curva ok' : 'no curva'}</div>`;
  const archInfo = document.querySelector('#edit-arch-info');
  if (archInfo && archGroup) archInfo.innerHTML = `pos: ${archGroup.position.x.toFixed(1)}, ${archGroup.position.y.toFixed(1)}, ${archGroup.position.z.toFixed(1)}<br>rot: y 120° z -25° x 0° (definitivo master)`;
  const cpList = document.querySelector('#edit-cp-list');
  if (cpList) cpList.innerHTML = raceManager.checkpoints.map(cp => `<div style="font:11px monospace; padding:2px 0; border-bottom:1px solid #222;">${cp.id} · ${cp.name} · ${cp.km}km · ${cp.lat.toFixed(5)},${cp.lon.toFixed(5)}</div>`).join('');
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

// Tabs
document.querySelectorAll('.nav-tab').forEach(tab => {
  if (!tab.dataset.tab) return;
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.querySelector(`#${tab.dataset.tab}`);
    if (panel) panel.classList.add('active');
  });
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
