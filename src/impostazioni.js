import { RaceManager } from './race-manager.js';
import { SettingsManager } from './settings-manager.js';

const settingsManager = new SettingsManager();
const raceManager = new RaceManager({
  onStateChange: () => {
    renderAthleteTabs();
    populateAthleteForm();
    renderSplitsTable();
  }
});

// Broadcast channel per notifiche istantanee
const syncChannel = new BroadcastChannel('giir_sync_channel');

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

  // Profilo Altimetrico
  const chkProf = document.querySelector('#chk-prof-overlay');
  if (chkProf) {
    chkProf.checked = s.showElevationProfile;
    chkProf.addEventListener('change', (e) => {
      settingsManager.update({ showElevationProfile: e.target.checked });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // Graphics Preset
  initGraphicsSettingsUI();
}

function initGraphicsSettingsUI() {
  const s = settingsManager.settings;

  // Preset radio
  const presetRadio = document.querySelector(`input[name="graphicsPreset"][value="${s.graphicsPreset}"]`);
  if (presetRadio) presetRadio.checked = true;

  document.querySelectorAll('input[name="graphicsPreset"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const preset = e.target.value;
      settingsManager.update({ graphicsPreset: preset });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
      toggleCustomSettings(preset === 'custom');
      updateCustomInputsFromSettings();
    });
  });

  // Custom settings visibility
  function toggleCustomSettings(show) {
    const customSection = document.querySelector('#custom-graphics-settings');
    if (customSection) {
      customSection.style.display = show ? 'block' : 'none';
    }
  }
  toggleCustomSettings(s.graphicsPreset === 'custom');

  // Custom inputs
  const shadowRes = document.querySelector('#shadow-resolution');
  const shadowLabel = document.querySelector('#shadow-label');
  if (shadowRes) {
    shadowRes.value = s.shadowResolution;
    if (shadowLabel) shadowLabel.textContent = s.shadowResolution;
    shadowRes.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      if (shadowLabel) shadowLabel.textContent = v;
      settingsManager.update({ shadowResolution: v, graphicsPreset: 'custom' });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  const treesCount = document.querySelector('#trees-count');
  const treesLabel = document.querySelector('#trees-label');
  if (treesCount) {
    treesCount.value = s.treesCount;
    if (treesLabel) treesLabel.textContent = s.treesCount;
    treesCount.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      if (treesLabel) treesLabel.textContent = v;
      settingsManager.update({ treesCount: v, graphicsPreset: 'custom' });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  const tubeSegs = document.querySelector('#tube-segments');
  const tubeLabel = document.querySelector('#tube-label');
  if (tubeSegs) {
    tubeSegs.value = s.tubeSegments;
    if (tubeLabel) tubeLabel.textContent = s.tubeSegments;
    tubeSegs.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      if (tubeLabel) tubeLabel.textContent = v;
      settingsManager.update({ tubeSegments: v, graphicsPreset: 'custom' });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  const ndiMsaa = document.querySelector('#ndi-msaa');
  if (ndiMsaa) {
    ndiMsaa.value = s.ndiMsaa;
    ndiMsaa.addEventListener('change', (e) => {
      settingsManager.update({ ndiMsaa: parseInt(e.target.value), graphicsPreset: 'custom' });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  const preserveBuffer = document.querySelector('#chk-preserve-buffer');
  if (preserveBuffer) {
    preserveBuffer.checked = s.preserveDrawingBuffer;
    preserveBuffer.addEventListener('change', (e) => {
      settingsManager.update({ preserveDrawingBuffer: e.target.checked, graphicsPreset: 'custom' });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  const shadowsEnabled = document.querySelector('#chk-shadows-enabled');
  if (shadowsEnabled) {
    shadowsEnabled.checked = s.shadowsEnabled;
    shadowsEnabled.addEventListener('change', (e) => {
      settingsManager.update({ shadowsEnabled: e.target.checked, graphicsPreset: 'custom' });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  // NDI FPS
  const ndiFpsInput = document.querySelector('#ndi-fps-input');
  const ndiFpsLabel = document.querySelector('#ndi-fps-label');
  if (ndiFpsInput) {
    ndiFpsInput.value = s.ndiFps;
    if (ndiFpsLabel) ndiFpsLabel.textContent = s.ndiFps;
    ndiFpsInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      if (ndiFpsLabel) ndiFpsLabel.textContent = v;
      settingsManager.update({ ndiFps: v });
      syncChannel.postMessage({ type: 'SETTINGS_UPDATED', settings: settingsManager.settings });
    });
  }

  function updateCustomInputsFromSettings() {
    const cur = settingsManager.settings;
    if (shadowRes) { shadowRes.value = cur.shadowResolution; if (shadowLabel) shadowLabel.textContent = cur.shadowResolution; }
    if (treesCount) { treesCount.value = cur.treesCount; if (treesLabel) treesLabel.textContent = cur.treesCount; }
    if (tubeSegs) { tubeSegs.value = cur.tubeSegments; if (tubeLabel) tubeLabel.textContent = cur.tubeSegments; }
    if (ndiMsaa) ndiMsaa.value = cur.ndiMsaa;
    if (preserveBuffer) preserveBuffer.checked = cur.preserveDrawingBuffer;
    if (shadowsEnabled) shadowsEnabled.checked = cur.shadowsEnabled;
  }
}

// Inizializza
renderAthleteTabs();
populateAthleteForm();
renderSplitsTable();
initSettingsUI();
