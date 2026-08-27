import * as THREE from 'three';

// Mini-map 2D PIP — GFX-2 — 256x256 canvas, track + checkpoints + athlete dots
// Layer 1 NDI sprite + HTML canvas overlay, aggiornato ogni frame
export class MiniMap {
  constructor(options = {}) {
    this.size = options.size || 256;
    this.bgColor = options.bgColor || '#0e1417';
    this.trackColor = options.trackColor || '#a4c736';
    this.checkpointColor = options.checkpointColor || '#ffffff';

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.layers.set(1); // NDI only
    this.sprite.scale.set(5.2, 5.2, 1); // ~256px a 1920x1080, angolo alto-destra

    // HTML overlay per browser (stesso canvas clonato)
    this.htmlCanvas = document.createElement('canvas');
    this.htmlCanvas.width = this.size;
    this.htmlCanvas.height = this.size;
    this.htmlCanvas.style.cssText = 'position:fixed;top:24px;right:24px;width:200px;height:200px;border:2px solid rgba(164,199,54,0.9);border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.6);z-index:15;pointer-events:none;';
    this.htmlCanvas.className = 'minimap hud';
    this.htmlCtx = this.htmlCanvas.getContext('2d');

    this.worldBounds = null; // {minX,maxX,minZ,maxZ}
    this.trackPoints = [];
    this.checkpoints = [];
  }

  attachToDOM(container = document.querySelector('#app')) {
    if (container) container.append(this.htmlCanvas);
  }

  detach() {
    this.htmlCanvas.remove();
  }

  setTrackData(worldPoints, checkpoints) {
    this.trackPoints = worldPoints || [];
    this.checkpoints = checkpoints || [];
    if (this.trackPoints.length > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      this.trackPoints.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      });
      const padX = (maxX - minX) * 0.12;
      const padZ = (maxZ - minZ) * 0.12;
      this.worldBounds = { minX: minX - padX, maxX: maxX + padX, minZ: minZ - padZ, maxZ: maxZ + padZ };
    }
    this.render();
  }

  worldToCanvas(x, z) {
    if (!this.worldBounds) return { x: this.size / 2, y: this.size / 2 };
    const nx = (x - this.worldBounds.minX) / (this.worldBounds.maxX - this.worldBounds.minX);
    const nz = (z - this.worldBounds.minZ) / (this.worldBounds.maxZ - this.worldBounds.minZ);
    // Z invertito (world Z negativo = nord)
    return { x: nx * (this.size - 16) + 8, y: (1 - nz) * (this.size - 16) + 8 };
  }

  render(athletes = []) {
    const ctx = this.ctx;
    const htmlCtx = this.htmlCtx;
    const s = this.size;

    // Clear
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, s, s);
    htmlCtx.fillStyle = this.bgColor;
    htmlCtx.fillRect(0, 0, s, s);

    // Track line
    if (this.trackPoints.length > 1) {
      [ctx, htmlCtx].forEach(c => {
        c.strokeStyle = this.trackColor;
        c.lineWidth = 1.8;
        c.lineJoin = 'round';
        c.beginPath();
        this.trackPoints.forEach((p, i) => {
          const pt = this.worldToCanvas(p.x, p.z);
          if (i === 0) c.moveTo(pt.x, pt.y);
          else c.lineTo(pt.x, pt.y);
        });
        c.stroke();
      });
    }

    // Checkpoints
    this.checkpoints.forEach(cp => {
      // cp.worldPos may be stored, or we compute via routeCurve externally; use cp.worldPos if available else approximate via x/z
      const wx = cp.worldPos ? cp.worldPos.x : cp.x || 0;
      const wz = cp.worldPos ? cp.worldPos.z : cp.z || 0;
      const pt = this.worldToCanvas(wx, wz);
      [ctx, htmlCtx].forEach(c => {
        c.beginPath();
        c.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
        c.fillStyle = this.checkpointColor;
        c.fill();
        c.strokeStyle = this.trackColor;
        c.lineWidth = 1;
        c.stroke();
      });
    });

    // Athletes
    athletes.forEach(ath => {
      if (!ath.worldPos && ath.km === undefined) return;
      // worldPos passed via ath.worldPos if available, else skip
      const pos = ath.worldPos;
      if (!pos) return;
      const pt = this.worldToCanvas(pos.x, pos.z);
      [ctx, htmlCtx].forEach(c => {
        c.beginPath();
        c.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        c.fillStyle = ath.color || '#ff3b30';
        c.fill();
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.5;
        c.stroke();
        // bib text
        c.fillStyle = '#ffffff';
        c.font = '700 9px Barlow Condensed, sans-serif';
        c.textAlign = 'center';
        c.fillText(String(ath.bib || ''), pt.x, pt.y - 9);
      });
    });

    // Border
    [ctx, htmlCtx].forEach(c => {
      c.strokeStyle = 'rgba(164,199,54,0.9)';
      c.lineWidth = 2;
      c.strokeRect(1, 1, s - 2, s - 2);
    });

    this.texture.needsUpdate = true;
  }

  // Posiziona sprite davanti a programCamera (alto-destra)
  updateSpritePosition(programCamera) {
    if (!this.sprite) return;
    const dir = new THREE.Vector3();
    programCamera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, programCamera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    this.sprite.position.copy(programCamera.position)
      .add(dir.clone().multiplyScalar(9))
      .add(right.clone().multiplyScalar(5.8))
      .add(up.clone().multiplyScalar(3.6));
    this.sprite.quaternion.copy(programCamera.quaternion);
  }
}
