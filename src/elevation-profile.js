export class ElevationProfile {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.profilePoints = [];
    this.checkpoints = [];
    this.currentKm = 0;
    this.totalKm = 32.0;
    this.minEle = 760;
    this.maxEle = 2070;
    this.accentColor = options.accentColor || '#dff654';

    if (this.container) {
      this.initDOM();
    }
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-title">
            <span class="eyebrow">PROFILO ALTIMETRICO 3D</span>
            <strong>32 KM · 3.800 M D+</strong>
          </div>
          <div class="profile-stats">
            <span id="prof-cur-ele">-- m</span>
            <small id="prof-cur-km">0.0 km</small>
          </div>
        </div>
        <div class="profile-canvas-wrapper">
          <svg id="profile-svg" preserveAspectRatio="none" viewBox="0 0 800 140"></svg>
          <div id="profile-marker" class="profile-marker">
            <div class="marker-dot"></div>
            <div class="marker-line"></div>
          </div>
        </div>
        <div class="profile-axis">
          <span>0 km</span>
          <span>8 km</span>
          <span>16 km</span>
          <span>24 km</span>
          <span>32 km</span>
        </div>
      </div>
    `;
  }

  setTrackData(trackPoints, checkpoints = []) {
    if (!trackPoints || trackPoints.length === 0) return;
    this.checkpoints = checkpoints;

    // Calcola distanze cumulative e altitudini
    let totalDist = 0;
    this.profilePoints = [{ dist: 0, ele: trackPoints[0].ele || 960 }];

    for (let i = 1; i < trackPoints.length; i++) {
      const p1 = trackPoints[i - 1];
      const p2 = trackPoints[i];
      const dLat = (p2.lat - p1.lat) * 111150;
      const dLon = (p2.lon - p1.lon) * 77211;
      const stepDist = Math.sqrt(dLat * dLat + dLon * dLon) / 1000; // km
      totalDist += stepDist;
      this.profilePoints.push({ dist: totalDist, ele: p2.ele || 960 });
    }

    this.totalKm = Math.max(32, totalDist);
    this.minEle = Math.min(...this.profilePoints.map(p => p.ele)) - 50;
    this.maxEle = Math.max(...this.profilePoints.map(p => p.ele)) + 80;

    this.renderSVG();
  }

  renderSVG() {
    const svg = this.container?.querySelector('#profile-svg');
    if (!svg || this.profilePoints.length < 2) return;

    const width = 800;
    const height = 140;
    const paddingBottom = 15;
    const paddingTop = 15;

    const getX = km => (km / this.totalKm) * width;
    const getY = ele => height - paddingBottom - ((ele - this.minEle) / (this.maxEle - this.minEle)) * (height - paddingTop - paddingBottom);

    // Costruisci il path dell'area altimetrica
    let pathD = `M 0,${height} `;
    for (let i = 0; i < this.profilePoints.length; i++) {
      const p = this.profilePoints[i];
      const x = getX(p.dist);
      const y = getY(p.ele);
      pathD += `L ${x.toFixed(1)},${y.toFixed(1)} `;
    }
    pathD += `L ${width},${height} Z`;

    // Linea di cresta
    let lineD = '';
    for (let i = 0; i < this.profilePoints.length; i++) {
      const p = this.profilePoints[i];
      const x = getX(p.dist);
      const y = getY(p.ele);
      lineD += (i === 0 ? 'M ' : 'L ') + `${x.toFixed(1)},${y.toFixed(1)} `;
    }

    // Checkpoints pins sull'SVG
    let cpElements = '';
    this.checkpoints.forEach(cp => {
      const x = getX(cp.km);
      const y = getY(cp.ele || 1400);
      cpElements += `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#fff" stroke="#dff654" stroke-width="2" />
        <line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="2,2" />
      `;
    });

    svg.innerHTML = `
      <defs>
        <linearGradient id="profileGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--accent-neon, #dff654)" stop-opacity="0.55" />
          <stop offset="60%" stop-color="var(--accent-neon, #dff654)" stop-opacity="0.15" />
          <stop offset="100%" stop-color="var(--accent-neon, #dff654)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="url(#profileGradient)" />
      <path d="${lineD}" fill="none" stroke="var(--accent-neon, #dff654)" stroke-width="2.5" />
      ${cpElements}
    `;
  }

  updateProgress(km, elevation = null) {
    this.currentKm = Math.max(0, Math.min(this.totalKm, km));
    const ratio = (this.currentKm / this.totalKm) * 100;

    const marker = this.container?.querySelector('#profile-marker');
    const curEleEl = this.container?.querySelector('#prof-cur-ele');
    const curKmEl = this.container?.querySelector('#prof-cur-km');

    if (marker) {
      marker.style.left = `${ratio}%`;
    }
    if (curKmEl) {
      curKmEl.textContent = `${this.currentKm.toFixed(1)} km`;
    }
    if (curEleEl && elevation !== null) {
      curEleEl.textContent = `${Math.round(elevation)} m`;
    }
  }
}
