export class SettingsManager {
  constructor(options = {}) {
    this.defaultSettings = {
      themeColor: '#a4c736', // Verde Giir sito (ex #dff654) — --e-global-color-astglobalcolor0
      fontFamily: 'Barlow Condensed', // 'Barlow Condensed', 'DM Sans', 'Montserrat', 'Oswald'
      terrainStyle: 'satellite', // 'satellite', 'stylized', 'dark'
      verticalExaggeration: 1.25, // 1.0 to 1.8
      trackGlow: true,
      showCheckpoints3D: true,
      showElevationProfile: true,
      ndiFps: 30, // ottimizzazione wifi: 30fps default (era 50) — dimezza banda NDI, ~12ms budget vs 20ms, più fluido su wifi
      ndiSourceName: 'GIIR-3D-PROGRAM'
    };

    this.settings = { ...this.defaultSettings };
    this.onChange = options.onChange || null;
    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('giir_settings_v1');
      if (saved) {
        this.settings = { ...this.defaultSettings, ...JSON.parse(saved) };
        // FIX _TEOO suffix: migrazione da vecchio valore con suffisso test → base
        if (this.settings.ndiSourceName && this.settings.ndiSourceName !== this.defaultSettings.ndiSourceName) {
          const base = this.defaultSettings.ndiSourceName;
          // se contiene _TEOO o comunque diverso dal base, normalizza a base (evita 2 sorgenti con stesso prefisso)
          if (this.settings.ndiSourceName.includes('_TEOO') || this.settings.ndiSourceName === 'GIIR-3D-PROGRAM_TEOO') {
            this.settings.ndiSourceName = base;
            try { localStorage.setItem('giir_settings_v1', JSON.stringify(this.settings)); } catch (e2) {}
          }
        }
        // MIGRAZIONE colore sito: #dff654 (vecchio giallo fluo) → #a4c736 (verde sito)
        if (this.settings.themeColor === '#dff654') {
          this.settings.themeColor = this.defaultSettings.themeColor;
          try { localStorage.setItem('giir_settings_v1', JSON.stringify(this.settings)); } catch (e2) {}
        }
        // MIGRAZIONE fps: 50→30 default per wifi/leggerezza
        if (this.settings.ndiFps === 50) {
          this.settings.ndiFps = 30;
          try { localStorage.setItem('giir_settings_v1', JSON.stringify(this.settings)); } catch (e2) {}
        }
      }
    } catch (e) {}
    this.applySettingsToDOM();
  }

  saveSettings() {
    try {
      localStorage.setItem('giir_settings_v1', JSON.stringify(this.settings));
    } catch (e) {}
    this.applySettingsToDOM();
    if (typeof this.onChange === 'function') {
      this.onChange(this.settings);
    }
  }

  update(newVals) {
    this.settings = { ...this.settings, ...newVals };
    this.saveSettings();
  }

  applySettingsToDOM() {
    const root = document.documentElement;
    root.style.setProperty('--accent-neon', this.settings.themeColor);
    root.style.setProperty('--font-primary', `"${this.settings.fontFamily}", sans-serif`);
    
    // Mostra/Nascondi overlay altimetrico
    const profEl = document.querySelector('#elevation-profile-container');
    if (profEl) {
      profEl.style.display = this.settings.showElevationProfile ? 'block' : 'none';
    }
  }

  reset() {
    this.settings = { ...this.defaultSettings };
    this.saveSettings();
  }
}
