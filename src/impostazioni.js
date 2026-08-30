import { RaceManager } from './race-manager.js';
import { SettingsManager } from './settings-manager.js';
import { VersionManager } from './version-manager.js';

const settingsManager = new SettingsManager();
const raceManager = new RaceManager({
  onStateChange: () => {
    renderAthleteTabs();
    populateAthleteForm();
    renderSplitsTable();
  }
});

// YOU-27: live timing WS hook — reuse NDI bridge WS (port 9998) for timing_update broadcasts
let timingWs = null;
function connectTimingWs() {
  try {
    timingWs = new WebSocket(`ws://${location.hostname || 'localhost'}:9998`);
    timingWs.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type !== 'timing_update' || !Array.isArray(data.updates)) return;
        data.updates.forEach(u => {
          const bib = String(u.bib ?? '').trim(); if (!bib) return;
          let ath = raceManager.athletes.find(a => a.bib === bib);
          if (!ath && u.name) { ath = raceManager.addAthlete({ bib, name: u.name, country: u.country || 'ITA', team: u.team || 'Skyrunner', color: u.color || '#dff654' }); }
          if (!ath) return;
          if (u.km !== undefined && u.km !== null && u.km !== '') raceManager.updateAthleteKm(ath.id, u.km);
          if (u.gap !== undefined) raceManager.updateAthleteDetails(ath.id, { gap: String(u.gap) });
          if (u.status !== undefined) raceManager.updateAthleteDetails(ath.id, { status: String(u.status) });
          if (u.splits && typeof u.splits === 'object') Object.entries(u.splits).forEach(([cp, t]) => raceManager.updateSplitTime(ath.id, cp, String(t)));
          Object.keys(u).forEach(k => { if (k.startsWith('cp')) raceManager.updateSplitTime(ath.id, k, String(u[k])); });
        });
      } catch (_) {}
    };
    timingWs.onclose = () => setTimeout(connectTimingWs, 2000);
  } catch (_) { setTimeout(connectTimingWs, 3000); }
}
connectTimingWs();

// Broadcast channel per notifiche istantanee
const syncChannel = new BroadcastChannel('giir_sync_channel');
const versionManager = new VersionManager();
try {
  const versionChannel = new BroadcastChannel('giir_version_channel');
  versionChannel.onmessage = (e) => { if (e.data?.type === 'VERSION_UPDATED') renderVersionList(); };
} catch {}

// ----------------------------------------------------
// GESTIONE ATLETI & SPLITS
// ----------------------------------------------------
function renderAthleteTabs() {
  const container = document.querySelector('#athlete-tabs');
  if (!container) return;

  const state = raceManager.getState();
  container.innerHTML = state.athletes.map(ath => `
    <button class="ath-tab ${ath.id === state.selectedAthlete?.id ? 'active' : ''}" data-id="${ath.id}">
      <span class="tab-bib" style="color:${ath.color};">${ath.bib}</span>
      <span>${ath.name}</span>
    </button>
  `).join('');

  container.querySelectorAll('.ath-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      raceManager.selectAthlete(btn.dataset.id);
    });
  });
}

function populateAthleteForm() {
  const ath = raceManager.getSelectedAthlete();
  if (!ath) return;

  document.querySelector('#ath-bib').value = ath.bib || '';
  document.querySelector('#ath-name').value = ath.name || '';
  document.querySelector('#ath-country').value = ath.country || '';
  document.querySelector('#ath-team').value = ath.team || '';
  document.querySelector('#ath-color').value = ath.color || '#dff654';
  document.querySelector('#ath-status').value = ath.status || 'running';
}

// Aggiornamento campi form atleta
['#ath-bib', '#ath-name', '#ath-country', '#ath-team', '#ath-color', '#ath-status'].forEach(selector => {
  const el = document.querySelector(selector);
  if (el) {
    el.addEventListener('input', () => {
      const ath = raceManager.getSelectedAthlete();
      if (ath) {
        raceManager.updateAthleteDetails(ath.id, {
          bib: document.querySelector('#ath-bib').value,
          name: document.querySelector('#ath-name').value,
          country: document.querySelector('#ath-country').value,
          team: document.querySelector('#ath-team').value,
          color: document.querySelector('#ath-color').value,
          status: document.querySelector('#ath-status').value
        });
      }
    });
  }
});

function renderSplitsTable() {
  const tbody = document.querySelector('#splits-tbody');
  const ath = raceManager.getSelectedAthlete();
  if (!tbody || !ath) return;

  tbody.innerHTML = raceManager.checkpoints.map(cp => {
    const val = ath.splits?.[cp.id] || '';
    return `
      <tr>
        <td><strong>${cp.km.toFixed(1)} km</strong></td>
        <td><strong>${cp.name}</strong></td>
        <td>${Math.round(cp.ele)} m</td>
        <td><span style="color:var(--text-muted); font-family:monospace;">${cp.refSplit || '--:--:--'}</span></td>
        <td>
          <input 
            type="text" 
            class="split-inp" 
            placeholder="00:00:00" 
            value="${val}" 
            data-cp-id="${cp.id}" 
          />
        </td>
        <td>
          ${cp.refSplit ? `<button class="quick-set-btn" data-cp-id="${cp.id}" data-time="${cp.refSplit}">Usa Riferimento</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.split-inp').forEach(inp => {
    inp.addEventListener('change', (e) => {
      raceManager.updateSplitTime(ath.id, e.target.dataset.cpId, e.target.value);
    });
  });

  tbody.querySelectorAll('.quick-set-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cpId = e.target.dataset.cpId;
      const time = e.target.dataset.time;
      raceManager.updateSplitTime(ath.id, cpId, time);
    });
  });
}

// Aggiungi atleta
document.querySelector('#btn-add-athlete')?.addEventListener('click', () => {
  const bib = prompt('Numero di pettorale:', '10');
  if (!bib) return;
  const name = prompt('Nome atleta:', 'Nuovo Corridore');
  if (!name) return;
  const newAth = raceManager.addAthlete({ bib, name, country: 'ITA', team: 'Sky Team', color: '#ff3b30' });
  raceManager.selectAthlete(newAth.id);
});

// YOU-26: CSV import — ponytail: hidden file input + raceManager.importCsv, no dep
document.querySelector('#btn-import-csv')?.addEventListener('click', () => {
  document.querySelector('#csv-input')?.click();
});
document.querySelector('#csv-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const n = raceManager.importCsv(text);
    alert(`Importati ${n} atleti da ${file.name}`);
  } catch (err) {
    alert(`Errore CSV: ${err.message}`);
  } finally {
    e.target.value = '';
  }
});

// MAP-04: Export/Import config JSON — ponytail: localStorage giir_settings_v1 + giir_race_data_v2
document.querySelector('#btn-export-config')?.addEventListener('click', () => {
  const data = {
    settings: JSON.parse(localStorage.getItem('giir_settings_v1') || '{}'),
    race: JSON.parse(localStorage.getItem('giir_race_data_v2') || '{}'),
    exportedAt: new Date().toISOString(),
    version: 1
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `giir-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
document.querySelector('#btn-import-config')?.addEventListener('click', () => {
  document.querySelector('#config-input')?.click();
});
document.querySelector('#config-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.settings) localStorage.setItem('giir_settings_v1', JSON.stringify(data.settings));
    if (data.race) localStorage.setItem('giir_race_data_v2', JSON.stringify(data.race));
    alert(`Config importata da ${file.name} — ricarica pagina per applicare`);
    location.reload();
  } catch (err) {
    alert(`Errore import: ${err.message}`);
  } finally {
    e.target.value = '';
  }
});

// Elimina atleta
document.querySelector('#btn-delete-athlete')?.addEventListener('click', () => {
  const ath = raceManager.getSelectedAthlete();
  if (ath && confirm(`Vuoi eliminare l'atleta ${ath.name} (#${ath.bib})?`)) {
    raceManager.deleteAthlete(ath.id);
  }
});

// Reset dati gara
document.querySelector('#btn-reset-data')?.addEventListener('click', () => {
  if (confirm('Vuoi ripristinare tutti gli atleti e i tempi intermedi di default?')) {
    raceManager.resetToDefault();
  }
});

// ----------------------------------------------------
// GESTIONE IMPOSTAZIONI GRAFICA BROADCAST
// ----------------------------------------------------
function initSettingsUI() {
  const s = settingsManager.settings;

  // Stile terreno
  const terrainRadio = document.querySelector(`input[name="terrainStyle"][value="${s.terrainStyle}"]`);
  if (terrainRadio) terrainRadio.checked = true;

  document.querySelectorAll('input[name="terrainStyle"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      settingsManager.update({ terrainStyle: e.target.value });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  });

  // Colore tema
  const colorPicker = document.querySelector('#theme-color-picker');
  if (colorPicker) {
    colorPicker.value = s.themeColor;
    colorPicker.addEventListener('input', (e) => {
      settingsManager.update({ themeColor: e.target.value });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.color;
      if (colorPicker) colorPicker.value = c;
      settingsManager.update({ themeColor: c });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  });

  // Font
  const fontSelect = document.querySelector('#font-family-select');
  if (fontSelect) {
    fontSelect.value = s.fontFamily;
    fontSelect.addEventListener('change', (e) => {
      settingsManager.update({ fontFamily: e.target.value });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // Esagerazione altimetrica
  const exagInput = document.querySelector('#exag-input');
  const exagLabel = document.querySelector('#exag-label');
  if (exagInput) {
    exagInput.value = s.verticalExaggeration;
    if (exagLabel) exagLabel.textContent = `${parseFloat(s.verticalExaggeration).toFixed(2)}x`;
    exagInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (exagLabel) exagLabel.textContent = `${v.toFixed(2)}x`;
      settingsManager.update({ verticalExaggeration: v });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // NDI Source Name
  const ndiInput = document.querySelector('#ndi-source-input');
  if (ndiInput) {
    ndiInput.value = s.ndiSourceName;
    ndiInput.addEventListener('change', (e) => {
      settingsManager.update({ ndiSourceName: e.target.value });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // RACE-02: Velocità Simulazione — ponytail: plain select+range, one stored int, BroadcastChannel sync
  const simMode = document.querySelector('#sim-speed-mode');
  const simSlider = document.querySelector('#sim-speed-slider');
  const simLabel = document.querySelector('#sim-speed-label');
  const simVal = document.querySelector('#sim-speed-val');
  const updateSimUI = (speed) => {
    const isReal = speed === 1;
    if (simMode) simMode.value = isReal ? 'realtime' : 'accelerated';
    if (simSlider) { simSlider.disabled = isReal; simSlider.value = isReal ? 10 : speed; }
    if (simLabel) simLabel.textContent = isReal ? 'Tempo Reale (1×)' : `Accelerato (${speed}×)`;
    if (simVal) simVal.textContent = isReal ? '1×' : `${speed}×`;
  };
  updateSimUI(s.simulationSpeed ?? 1);
  if (simMode) simMode.addEventListener('change', () => {
    const speed = simMode.value === 'realtime' ? 1 : parseInt(simSlider?.value || '10', 10);
    settingsManager.update({ simulationSpeed: speed });
    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    updateSimUI(speed);
  });
  if (simSlider) simSlider.addEventListener('input', () => {
    const speed = parseInt(simSlider.value, 10);
    // auto-switch to accelerated if user drags slider
    if (simMode) simMode.value = 'accelerated';
    settingsManager.update({ simulationSpeed: speed });
    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    updateSimUI(speed);
  });

  // PERF-08: Target FPS 25/50 — ponytail: range 25-50 step 25, no 30
  const fpsInput = document.querySelector('#ndi-fps-input');
  const fpsLabel = document.querySelector('#ndi-fps-label');
  if (fpsInput) {
    fpsInput.value = s.ndiFps;
    if (fpsLabel) fpsLabel.textContent = s.ndiFps;
    fpsInput.addEventListener('input', () => {
      const v = parseInt(fpsInput.value, 10);
      const valid = (v === 25 || v === 50) ? v : 50;
      if (fpsLabel) fpsLabel.textContent = valid;
      settingsManager.update({ ndiFps: valid });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // PERF-07: Graphics preset High/Balanced/Performance — ponytail
  const presetRadios = document.querySelectorAll('input[name="graphicsPreset"]');
  const customBox = document.querySelector('#custom-graphics-settings');
  const shadowSlider = document.querySelector('#shadow-resolution');
  const shadowLabel = document.querySelector('#shadow-label');
  const treesSlider = document.querySelector('#trees-count');
  const treesLabel = document.querySelector('#trees-label');
  const tubeSlider = document.querySelector('#tube-segments');
  const tubeLabel = document.querySelector('#tube-label');
  const msaaSelect = document.querySelector('#ndi-msaa');
  const chkPreserve = document.querySelector('#chk-preserve-buffer');
  const chkShadows = document.querySelector('#chk-shadows-enabled');
  const presetMap = {
    high: { shadowResolution: 2048, treesCount: 1400, tubeSegments: 800, ndiMsaa: 4, shadowsEnabled: true, preserveBuffer: false },
    balanced: { shadowResolution: 1024, treesCount: 800, tubeSegments: 600, ndiMsaa: 2, shadowsEnabled: true, preserveBuffer: false },
    performance: { shadowResolution: 512, treesCount: 400, tubeSegments: 400, ndiMsaa: 0, shadowsEnabled: true, preserveBuffer: false },
  };
  function applyPresetUI(name) {
    const isCustom = name === 'custom';
    if (customBox) customBox.style.display = isCustom ? 'block' : 'none';
    if (!isCustom && presetMap[name]) {
      const p = presetMap[name];
      if (shadowSlider) { shadowSlider.value = p.shadowResolution; if (shadowLabel) shadowLabel.textContent = p.shadowResolution; }
      if (treesSlider) { treesSlider.value = p.treesCount; if (treesLabel) treesLabel.textContent = p.treesCount; }
      if (tubeSlider) { tubeSlider.value = p.tubeSegments; if (tubeLabel) tubeLabel.textContent = p.tubeSegments; }
      if (msaaSelect) msaaSelect.value = String(p.ndiMsaa);
      if (chkPreserve) chkPreserve.checked = p.preserveBuffer;
      if (chkShadows) chkShadows.checked = p.shadowsEnabled;
    }
  }
  const initialPreset = s.graphicsPreset || 'balanced';
  presetRadios.forEach(r => { if (r.value === initialPreset) r.checked = true; });
  applyPresetUI(initialPreset);
  presetRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const name = radio.value;
      if (presetMap[name]) {
        settingsManager.update({ graphicsPreset: name, ...presetMap[name] });
      } else {
        settingsManager.update({ graphicsPreset: name });
      }
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
      applyPresetUI(name);
    });
  });
  // custom sliders update
  if (shadowSlider) shadowSlider.addEventListener('input', () => {
    if (shadowLabel) shadowLabel.textContent = shadowSlider.value;
    settingsManager.update({ graphicsPreset: 'custom', shadowResolution: parseInt(shadowSlider.value,10) });
    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    presetRadios.forEach(r => { if (r.value === 'custom') r.checked = true; });
    if (customBox) customBox.style.display = 'block';
  });
  if (treesSlider) treesSlider.addEventListener('input', () => {
    if (treesLabel) treesLabel.textContent = treesSlider.value;
    settingsManager.update({ graphicsPreset: 'custom', treesCount: parseInt(treesSlider.value,10) });
    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    presetRadios.forEach(r => { if (r.value === 'custom') r.checked = true; });
    if (customBox) customBox.style.display = 'block';
  });
  if (tubeSlider) tubeSlider.addEventListener('input', () => {
    if (tubeLabel) tubeLabel.textContent = tubeSlider.value;
    settingsManager.update({ graphicsPreset: 'custom', tubeSegments: parseInt(tubeSlider.value,10) });
    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    presetRadios.forEach(r => { if (r.value === 'custom') r.checked = true; });
    if (customBox) customBox.style.display = 'block';
  });
  if (msaaSelect) msaaSelect.addEventListener('change', () => {
    settingsManager.update({ graphicsPreset: 'custom', ndiMsaa: parseInt(msaaSelect.value,10) });
    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    presetRadios.forEach(r => { if (r.value === 'custom') r.checked = true; });
    if (customBox) customBox.style.display = 'block';
  });

  // Profilo Altimetrico
  const chkProf = document.querySelector('#chk-prof-overlay');
  if (chkProf) {
    chkProf.checked = s.showElevationProfile;
    chkProf.addEventListener('change', (e) => {
      settingsManager.update({ showElevationProfile: e.target.checked });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // PROG-07: Percorso & Marker
  const chkProgress = document.querySelector('#chk-progress-marker');
  if (chkProgress) {
    chkProgress.checked = s.showProgressMarker;
    chkProgress.addEventListener('change', (e) => {
      settingsManager.update({ showProgressMarker: e.target.checked });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }
  const travelColor = document.querySelector('#track-travel-color');
  const remainingColor = document.querySelector('#track-remaining-color');
  if (travelColor) {
    travelColor.value = s.trackTravelColor;
    travelColor.addEventListener('input', (e) => {
      settingsManager.update({ trackTravelColor: e.target.value });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }
  if (remainingColor) {
    remainingColor.value = s.trackRemainingColor;
    remainingColor.addEventListener('input', (e) => {
      settingsManager.update({ trackRemainingColor: e.target.value });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }
  // Track style: rainbow vs solid
  const trackStyleRadios = document.querySelectorAll('input[name="trackStyle"]');
  if (trackStyleRadios.length) {
    trackStyleRadios.forEach(radio => {
      if (radio.value === (s.trackStyle || 'rainbow')) radio.checked = true;
    });
    trackStyleRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        settingsManager.update({ trackStyle: e.target.value });
        syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
      });
    });
   }
   // PROG-SMOOTH: Path smoothing toggle
   const chkPathSmoothing = document.querySelector('#chk-path-smoothing');
   if (chkPathSmoothing) {
     chkPathSmoothing.checked = s.pathSmoothing !== false;
     chkPathSmoothing.addEventListener('change', (e) => {
       settingsManager.update({ pathSmoothing: e.target.checked });
       syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
     });
   }
   // GPX file upload
  const gpxInput = document.querySelector('#gpx-input');
  const gpxSource = document.querySelector('#gpx-source');
  if (gpxSource) {
    gpxSource.value = s.gpxSource || '/data/giir-di-mont-32-km.gpx';
    gpxSource.addEventListener('change', (e) => {
      settingsManager.update({ gpxSource: e.target.value });
    });
  }
  if (gpxInput) {
    gpxInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const xml = new DOMParser().parseFromString(text, 'application/xml');
        if (xml.querySelector('parsererror')) { alert('GPX non valido'); return; }
        const trkpts = [...xml.querySelectorAll('trkpt')];
        if (trkpts.length < 2) { alert('Nessun punto trkpt nel GPX'); return; }
        const points = trkpts.map(n => ({ lat: Number(n.getAttribute('lat')), lon: Number(n.getAttribute('lon')), ele: Number(n.querySelector('ele')?.textContent || 960) }));
        if (points.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) { alert('Coordinate GPX non valide'); return; }
        settingsManager.update({ gpxSource: file.name });
        syncChannel.postMessage({ type: 'GPX_UPDATED', points });
        alert(`GPX caricato: ${points.length} punti`);
      } catch (err) { alert(`Errore GPX: ${err.message}`); }
      e.target.value = '';
    });
  }
}

function renderVersionList() {
  const c = document.querySelector('#version-list');
  if (!c) return;
  const versions = versionManager.list();
  if (!versions.length) {
    c.innerHTML = `<div style="font:12px monospace; opacity:0.6; padding:12px; text-align:center;">Nessuna versione salvata.<br>Modifica in <a href="/edit.html" target="_blank">/edit</a> e salva per creare la prima versione.</div>`;
    return;
  }
  c.innerHTML = versions.map((v, idx) => {
    const d = new Date(v.timestamp);
    const isLatest = idx === 0;
    const pts = v.snapshot?.rawTrackPoints?.length || 0;
    const trees = v.snapshot?.trees?.length || 0;
    const cps = v.snapshot?.checkpoints?.length || 0;
    return `<div style="display:flex; align-items:center; gap:8px; padding:8px; border:1px solid ${isLatest ? '#3a5' : '#333'}; background:${isLatest ? '#112' : '#1a1a1a'}; margin-bottom:6px; border-radius:6px;">
      <div style="flex:1; min-width:0;">
        <div style="font:600 12px monospace; color:${isLatest ? '#8f8' : '#ddd'};">${isLatest ? '● ATTIVA · ' : ''}${v.label}</div>
        <div style="font:11px monospace; opacity:0.7;">${d.toLocaleString('it-IT')} · ${pts} punti · ${cps} cp · ${trees} alberi</div>
      </div>
      <div style="display:flex; gap:4px; flex-wrap:wrap;">
        <button data-ver-action="restore" data-ver-id="${v.id}" style="padding:4px 8px; font:11px monospace; background:#223; color:#8ff; border:1px solid #446;">↩ Ripristina</button>
        <button data-ver-action="rename" data-ver-id="${v.id}" style="padding:4px 8px; font:11px monospace; background:#222; color:#ddd; border:1px solid #333;">✏️ Rinomina</button>
        <button data-ver-action="export" data-ver-id="${v.id}" style="padding:4px 8px; font:11px monospace; background:#332; color:#ff8; border:1px solid #664;">📤 Esporta</button>
        <button data-ver-action="delete" data-ver-id="${v.id}" style="padding:4px 8px; font:11px monospace; background:#311; color:#f88; border:1px solid #533;">🗑️</button>
      </div>
    </div>`;
  }).join('');
  c.querySelectorAll('[data-ver-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.verId;
      const action = btn.dataset.verAction;
      if (action === 'restore') {
        if (!confirm('Ripristinare questa versione? Sovrascriverà il mondo attivo (verrà comunque salvata una nuova versione di backup).')) return;
        const snap = versionManager.restoreVersion(id);
        if (snap) {
          // broadcast to main and edit
          try { new BroadcastChannel('giir_version_channel').postMessage({ type: 'VERSION_UPDATED' }); } catch {}
          alert('Versione ripristinata — ricarica / per vedere le modifiche');
          renderVersionList();
        }
      } else if (action === 'delete') {
        if (!confirm('Eliminare questa versione?')) return;
        versionManager.deleteVersion(id);
        renderVersionList();
      } else if (action === 'rename') {
        const cur = versionManager.getById(id);
        const name = prompt('Nuovo nome versione:', cur?.label || '');
        if (name !== null) { versionManager.renameVersion(id, name); renderVersionList(); }
      } else if (action === 'export') {
        const v = versionManager.getById(id);
        if (!v) return;
        const blob = new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `giir-version-${v.id}.json`; a.click();
      }
    });
  });
}
function initVersionUI() {
  renderVersionList();
  document.querySelector('#btn-version-save')?.addEventListener('click', () => {
    const label = prompt('Nome versione:', `versione ${new Date().toLocaleString('it-IT')}`);
    if (label === null) return;
    // crea versione da latest snapshot o da current edit
    const latest = versionManager.getLatest();
    const snap = latest ? latest.snapshot : JSON.parse(localStorage.getItem('giir_edit_v1') || 'null');
    if (!snap) { alert('Nessun salvataggio da versionare — modifica prima in /edit'); return; }
    versionManager.createVersion(snap, label);
    try { new BroadcastChannel('giir_version_channel').postMessage({ type: 'VERSION_UPDATED' }); } catch {}
    renderVersionList();
  });
  document.querySelector('#btn-version-clear')?.addEventListener('click', () => {
    if (!confirm('Cancellare TUTTE le versioni?')) return;
    versionManager.clearAll();
    renderVersionList();
  });
  document.querySelector('#btn-version-export-all')?.addEventListener('click', () => {
    const all = versionManager.list();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `giir-versions-${Date.now()}.json`; a.click();
  });
  // auto-refresh ogni 2s per catturare nuove versioni da /edit
  setInterval(renderVersionList, 2000);
}

// Inizializza
renderAthleteTabs();
populateAthleteForm();
renderSplitsTable();
initSettingsUI();
initVersionUI();
