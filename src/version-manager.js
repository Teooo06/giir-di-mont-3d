export class VersionManager {
  constructor(options = {}) {
    this.key = options.key || 'giir_edit_versions_v1';
    this.autoKey = options.autoKey || 'giir_edit_v1';
    this.maxVersions = options.maxVersions || 20;
    this.versions = this.loadVersions();
  }
  loadVersions() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
  saveVersions() {
    try { localStorage.setItem(this.key, JSON.stringify(this.versions)); } catch {}
  }
  list() { return [...this.versions].sort((a, b) => b.timestamp - a.timestamp); }
  getLatest() {
    const list = this.list();
    return list[0] || null;
  }
  getById(id) { return this.versions.find(v => v.id === id) || null; }
  createVersion(snapshot, label = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = Date.now();
    const autoLabel = label || `v${this.versions.length + 1} · ${new Date(now).toLocaleString('it-IT')}`;
    const version = { id, timestamp: now, label: autoLabel, snapshot: JSON.parse(JSON.stringify(snapshot)) };
    this.versions.unshift(version);
    if (this.versions.length > this.maxVersions) this.versions = this.versions.slice(0, this.maxVersions);
    this.saveVersions();
    // also update autoKey for backward compat / main auto-use
    try { localStorage.setItem(this.autoKey, JSON.stringify(snapshot)); } catch {}
    return version;
  }
  deleteVersion(id) {
    this.versions = this.versions.filter(v => v.id !== id);
    this.saveVersions();
  }
  renameVersion(id, newLabel) {
    const v = this.getById(id);
    if (v) { v.label = newLabel; this.saveVersions(); }
  }
  restoreVersion(id) {
    const v = this.getById(id);
    if (!v) return null;
    try { localStorage.setItem(this.autoKey, JSON.stringify(v.snapshot)); } catch {}
    return JSON.parse(JSON.stringify(v.snapshot));
  }
  clearAll() { this.versions = []; this.saveVersions(); localStorage.removeItem(this.autoKey); }
  // auto-use: if latest exists and is newer than public/data, main should use it
  hasVersions() { return this.versions.length > 0; }
}
