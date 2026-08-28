import * as THREE from 'three';

/**
 * YOU-13: LowerThird — Three.js Sprite (NDI layer 1) + HTML overlay (browser)
 * Ponytail: CanvasTexture 1536×160 (80% width), single class, BroadcastChannel sync
 */
export class LowerThird {
  constructor(options = {}) {
    this.scene = options.scene;
    this.themeColor = options.themeColor || '#dff654';
    this.onShow = options.onShow || null;
    this.onHide = options.onHide || null;

    // NDI Sprite (layer 1)
    this.sprite = null;
    this.texture = null;
    this.visible = false;
    this.hideTimer = null;

    // Browser HTML
    this.el = this.createHtmlElement();
    document.querySelector('#app')?.append(this.el);

    // BroadcastChannel for /impostazioni sync
    try {
      this.channel = new BroadcastChannel('giir_sync_channel');
      this.channel.onmessage = (e) => {
        if (e.data?.type === 'LOWER_THIRD_SHOW') this.show(e.data.data, { broadcast: false });
        if (e.data?.type === 'LOWER_THIRD_HIDE') this.hide({ broadcast: false });
        if (e.data?.type === 'LOWER_THIRD_UPDATE') this.update(e.data.data, { broadcast: false });
      };
    } catch {}

    this.createSprite();
  }

  createHtmlElement() {
    const el = document.createElement('div');
    el.className = 'lower-third';
    el.style.cssText = `
      position:fixed;left:10%;bottom:10%;width:80%;height:80px;
      display:none;align-items:center;gap:16px;padding:0 16px;
      background:rgba(14,20,23,0.92);border:1px solid rgba(255,255,255,0.12);
      border-radius:6px;border-top:4px solid ${this.themeColor};
      backdrop-filter:blur(12px);z-index:15;color:#f7f5ec;
      font-family:'Barlow Condensed',sans-serif;
    `;
    el.innerHTML = `
      <div class="lt-flag" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:28px;background:rgba(255,255,255,0.06);border-radius:4px"></div>
      <div class="lt-avatar" style="width:60px;height:60px;border-radius:50%;background:#223d2e;display:flex;align-items:center;justify-content:center;font:700 20px sans-serif;overflow:hidden"><span></span></div>
      <div style="flex:1"><strong class="lt-name" style="display:block;font:700 18px/1 'Barlow Condensed',sans-serif"></strong><small class="lt-country" style="font:700 12px 'DM Sans',sans-serif;color:#aab;text-transform:uppercase"></small></div>
      <div class="lt-gap" style="font:700 14px monospace"></div>
      <div class="lt-pace" style="font:600 12px 'DM Sans',sans-serif;color:#cfd6cd"></div>
    `;
    return el;
  }

  createSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 160;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.layers.set(1);
    this.sprite.scale.set(80, 8.5, 1);
    this.sprite.position.set(0, -40, 0);
    this.sprite.visible = false;
    if (this.scene) this.scene.add(this.sprite);
  }

  renderCanvas(data) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    // bg
    ctx.fillStyle = 'rgba(14,20,23,0.92)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();
    // accent top
    ctx.fillStyle = this.themeColor;
    ctx.fillRect(0, 0, w, 6);
    // flag
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.flag || '🏳️', 60, h / 2);
    // avatar placeholder circle
    ctx.beginPath();
    ctx.arc(140, h / 2, 30, 0, Math.PI * 2);
    ctx.fillStyle = data.color || '#223d2e';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px Barlow Condensed';
    ctx.fillText((data.bib || '?').toString().slice(0, 2), 140, h / 2 + 2);
    // name
    ctx.fillStyle = '#f7f5ec';
    ctx.font = '700 36px Barlow Condensed';
    ctx.textAlign = 'left';
    ctx.fillText(data.name || 'Atleta', 200, h / 2 - 12);
    // country
    ctx.fillStyle = '#aab';
    ctx.font = '700 18px DM Sans';
    ctx.fillText((data.country || 'ITA') + ' · ' + (data.team || ''), 200, h / 2 + 24);
    // gap
    ctx.fillStyle = '#fff';
    ctx.font = '700 28px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(data.gap || 'LEADER', w - 220, h / 2);
    // pace
    ctx.fillStyle = '#cfd6cd';
    ctx.font = '600 18px DM Sans';
    ctx.fillText(data.pace || '--', w - 40, h / 2);
    this.texture.needsUpdate = true;
  }

  renderHtml(data) {
    const flagEl = this.el.querySelector('.lt-flag');
    const avatarEl = this.el.querySelector('.lt-avatar span');
    const nameEl = this.el.querySelector('.lt-name');
    const countryEl = this.el.querySelector('.lt-country');
    const gapEl = this.el.querySelector('.lt-gap');
    const paceEl = this.el.querySelector('.lt-pace');
    if (flagEl) flagEl.textContent = data.flag || '🏳️';
    if (avatarEl) {
      avatarEl.textContent = (data.bib || '?').toString().slice(0, 2);
      avatarEl.parentElement.style.background = data.color || '#223d2e';
    }
    if (nameEl) nameEl.textContent = data.name || 'Atleta';
    if (countryEl) countryEl.textContent = `${data.country || 'ITA'} · ${data.team || ''}`;
    if (gapEl) gapEl.textContent = data.gap || 'LEADER';
    if (paceEl) paceEl.textContent = data.pace || '--';
    this.el.style.borderTopColor = this.themeColor;
  }

  show(data, opts = {}) {
    const broadcast = opts.broadcast !== false;
    this.renderCanvas(data);
    this.renderHtml(data);
    this.sprite.visible = true;
    this.el.style.display = 'flex';
    this.visible = true;
    if (broadcast && this.channel) this.channel.postMessage({ type: 'LOWER_THIRD_SHOW', data });
    if (this.onShow) this.onShow(data);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 5000);
  }

  hide(opts = {}) {
    const broadcast = opts.broadcast !== false;
    this.sprite.visible = false;
    this.el.style.display = 'none';
    this.visible = false;
    if (broadcast && this.channel) this.channel.postMessage({ type: 'LOWER_THIRD_HIDE' });
    if (this.onHide) this.onHide();
    clearTimeout(this.hideTimer);
  }

  update(data, opts = {}) {
    if (!this.visible) return;
    const broadcast = opts.broadcast !== false;
    this.renderCanvas(data);
    this.renderHtml(data);
    if (broadcast && this.channel) this.channel.postMessage({ type: 'LOWER_THIRD_UPDATE', data });
  }

  setThemeColor(color) {
    this.themeColor = color;
    this.el.style.borderTopColor = color;
    // re-render if visible
    if (this.visible) {
      // need last data — store
      // For ponytail, just update border, texture will update on next show/update
    }
  }

  dispose() {
    if (this.sprite && this.scene) this.scene.remove(this.sprite);
    if (this.texture) this.texture.dispose();
    if (this.el) this.el.remove();
    clearTimeout(this.hideTimer);
    if (this.channel) this.channel.close();
  }
}
