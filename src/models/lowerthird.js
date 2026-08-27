import * as THREE from 'three';

// Lower-third broadcast — GFX-1 — flag, name, gap, team
// Canvas 1024x180, layer 1 NDI + HTML overlay browser, synced via BroadcastChannel (raceManager)
export function createLowerThirdSprite(athlete, themeColor = '#a4c736') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Background bar (dark with accent left border)
  ctx.fillStyle = 'rgba(14, 20, 23, 0.92)';
  const r = 12;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = themeColor;
  ctx.fillRect(0, 0, 8, h);

  // Bib circle
  const bibX = 75, bibY = h / 2;
  ctx.beginPath();
  ctx.arc(bibX, bibY, 42, 0, Math.PI * 2);
  ctx.fillStyle = athlete.color || themeColor;
  ctx.fill();
  ctx.fillStyle = '#111815';
  ctx.beginPath();
  ctx.arc(bibX, bibY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 28px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(athlete.bib || ''), bibX, bibY + 2);

  // Flag emoji (country code) — simple text, evita dipendenza immagini
  ctx.fillStyle = '#ffffff';
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'left';
  const flag = countryToFlag(athlete.country || 'ITA');
  ctx.fillText(flag, 135, 42);

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Barlow Condensed, sans-serif';
  ctx.fillText((athlete.name || 'ATLETA').toUpperCase(), 175, 45);

  // Team
  ctx.fillStyle = '#a8b5c0';
  ctx.font = '600 16px DM Sans, sans-serif';
  ctx.fillText(athlete.team || '', 175, 72);

  // Gap / status
  ctx.fillStyle = themeColor;
  ctx.font = '700 18px DM Sans, sans-serif';
  ctx.textAlign = 'right';
  const gap = athlete.gap || 'LEADER';
  const km = typeof athlete.km === 'number' ? `${athlete.km.toFixed(1)} km` : '';
  ctx.fillText(gap, w - 20, 42);
  ctx.fillStyle = '#f6f4e9';
  ctx.font = '600 16px DM Sans, sans-serif';
  ctx.fillText(km, w - 20, 72);

  // Bottom accent line
  ctx.fillStyle = themeColor;
  ctx.fillRect(120, h - 18, w - 140, 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.layers.set(1); // NDI only
  // Screen-space size — 1024:180 ~5.68:1, world units 7:1.23
  sprite.scale.set(14, 2.5, 1);
  return { sprite, canvas, tex };
}

function countryToFlag(code) {
  if (!code || code.length !== 3) return '🏳️';
  const map = { ITA: '🇮🇹', FRA: '🇫🇷', ESP: '🇪🇸', SUI: '🇨🇭', GER: '🇩🇪', GBR: '🇬🇧', USA: '🇺🇸', KEN: '🇰🇪', ERI: '🇪🇷', ETH: '🇪🇹' };
  return map[code.toUpperCase()] || code.toUpperCase().slice(0, 2);
}

export function createLowerThirdHTML(athlete) {
  const el = document.createElement('div');
  el.className = 'lower-third hud';
  el.style.cssText = 'position:fixed;left:24px;bottom:92px;min-width:520px;max-width:620px;height:88px;background:rgba(14,20,23,0.92);border-radius:12px;border-left:8px solid #a4c736;display:flex;align-items:center;gap:16px;padding:12px 20px;z-index:20;';
  el.innerHTML = `
    <div style="width:56px;height:56px;border-radius:50%;background:${athlete.color || '#a4c736'};display:flex;align-items:center;justify-content:center;color:#111815;font:800 22px Barlow Condensed, sans-serif;flex-shrink:0;">${athlete.bib || ''}</div>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:8px;font:700 20px Barlow Condensed, sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${countryToFlag(athlete.country)} ${(athlete.name||'').toUpperCase()}</div>
      <div style="font:600 13px DM Sans, sans-serif;color:#a8b5c0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${athlete.team || ''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font:700 14px DM Sans, sans-serif;color:#a4c736;">${athlete.gap || 'LEADER'}</div>
      <div style="font:600 13px DM Sans, sans-serif;color:#f6f4e9;">${typeof athlete.km === 'number' ? athlete.km.toFixed(1)+' km' : ''}</div>
    </div>
  `;
  return el;
}
