export class SettingsManager {
  constructor(options = {}) {
    this.defaultSettings = {
      themeColor: '#dff654', // Giallo fluo Giir di Mont
      fontFamily: 'Barlow Condensed', // 'Barlow Condensed', 'DM Sans', 'Montserrat', 'Oswald'
      terrainStyle: 'satellite', // 'satellite', 'stylized', 'dark'
      verticalExaggeration: 1.25, // 1.0 to 1.8
      trackGlow: true,
      showCheckpoints3D: true,
      showElevationProfile: true,
      ndiFps: 50, // ponytail: 50 is target, calibration knob — if NDI p95 >16ms on target Mac, setFps(30) via /impostazioni (saves ~6.6ms budget slack, no code change)
      ndiSourceName: 'GIIR-3D-PROGRAM',
      simulationSpeed: 1 // RACE-02: 1=Tempo Reale, 10-100=Accelerato — ponytail: one knob, localStorage via giir_settings_v1
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
