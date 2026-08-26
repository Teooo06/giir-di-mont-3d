export class SettingsManager {
  constructor(options = {}) {
    this.graphicsPresets = {
      high: {
        shadowResolution: 2048,
        treesCount: 1400,
        tubeSegments: 800,
        ndiMsaa: 4,
        preserveDrawingBuffer: true,
        shadowsEnabled: true
      },
      balanced: {
        shadowResolution: 1024,
        treesCount: 800,
        tubeSegments: 600,
        ndiMsaa: 2,
        preserveDrawingBuffer: false,
        shadowsEnabled: true
      },
      performance: {
        shadowResolution: 512,
        treesCount: 400,
        tubeSegments: 400,
        ndiMsaa: 0,
        preserveDrawingBuffer: false,
        shadowsEnabled: false
      }
    };

    this.defaultSettings = {
      themeColor: '#dff654', // Giallo fluo Giir di Mont
      fontFamily: 'Barlow Condensed', // 'Barlow Condensed', 'DM Sans', 'Montserrat', 'Oswald'
      terrainStyle: 'satellite', // 'satellite', 'stylized', 'dark'
      verticalExaggeration: 1.25, // 1.0 to 1.8
      trackGlow: true,
      showCheckpoints3D: true,
      showElevationProfile: true,
      ndiFps: 50,
      ndiSourceName: 'GIIR-3D-PROGRAM',
      graphicsPreset: 'balanced', // 'high', 'balanced', 'performance', 'custom'
      shadowResolution: 1024,
      treesCount: 800,
      tubeSegments: 600,
      ndiMsaa: 2,
      preserveDrawingBuffer: false,
      shadowsEnabled: true
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
      }
    } catch (e) {}
    this.applyGraphicsPreset(this.settings.graphicsPreset);
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
    const oldPreset = this.settings.graphicsPreset;
    this.settings = { ...this.settings, ...newVals };
    
    if (newVals.graphicsPreset && newVals.graphicsPreset !== oldPreset) {
      this.applyGraphicsPreset(newVals.graphicsPreset);
    }
    this.saveSettings();
  }

  applyGraphicsPreset(presetName) {
    if (presetName === 'custom') return;
    const preset = this.graphicsPresets[presetName];
    if (preset) {
      this.settings = { ...this.settings, ...preset };
    }
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
