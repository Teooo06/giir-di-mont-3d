#!/usr/bin/env node
// DJI RC-N1 → Giir 3D Controller Bridge (adhoc per questo progetto)
// Legge il seriale DJI (38-byte @ 100Hz) e invia via WS a //controller come joystick virtuale
// Funziona su Mac/Win/Linux se DJI Assistant 2 è installato (driver VCOM) e controller collegato via USB-C inferiore
// Uso: npm i serialport ws && node server/dji-bridge.js [--port /dev/cu.usbmodem*] [--ws ws://localhost:9998] [--debug]

import { SerialPort } from 'serialport';
import WebSocket from 'ws';

const HANDSHAKE = Buffer.from([0x55, 0x0d, 0x04, 0x33, 0x0a, 0x06, 0xeb, 0x34, 0x40, 0x06, 0x01, 0x74, 0x24]);
const WS_URL = process.env.DJI_WS || process.argv.find(a => a.startsWith('--ws='))?.split('=')[1] || 'ws://localhost:9998';
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';
let portPath = process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || null;

let ws = null;
let wsReady = false;
let serial = null;
let lastSend = 0;
let djiSpeedIdx = 1; // 0:0.2, 1:0.4, 2:0.8
const djiSpeeds = [0.2, 0.4, 0.8];
let lastBtnState = 0;

function log(...args) { console.log('[DJI-Bridge]', ...args); }
function dbg(...args) { if (DEBUG) console.log('[DJI-Bridge dbg]', ...args); }

async function findDjiPort() {
  if (portPath) return portPath;
  const ports = await SerialPort.list();
  // Cerca DJI USB VCOM
  for (const p of ports) {
    const man = (p.manufacturer || '').toLowerCase();
    const prod = (p.productId || '').toLowerCase();
    const path = p.path || '';
    if (man.includes('dji') || path.toLowerCase().includes('usbmodem') || path.toLowerCase().includes('cu.usbmodem')) {
      log(`Trovata porta DJI: ${path} man=${p.manufacturer} prod=${p.productId}`);
      // Su Mac spesso ci sono due porte per lo stesso device (cu.* e tty.*), preferisci cu.*
      if (path.includes('cu.usbmodem')) return path;
    }
  }
  // fallback: prendi la prima cu.usbmodem
  for (const p of ports) if (p.path.includes('cu.usbmodem')) return p.path;
  for (const p of ports) if (p.path.includes('tty.usbmodem')) return p.path;
  // su Win cerca COM con DJI
  for (const p of ports) if ((p.manufacturer || '').toLowerCase().includes('dji')) return p.path;
  return null;
}

function connectWs() {
  log(`Connessione WS a ${WS_URL} ...`);
  ws = new WebSocket(WS_URL);
  ws.on('open', () => {
    wsReady = true;
    log('WS connesso — invio activate per DJI');
    try { ws.send(JSON.stringify({ type: 'controller', action: 'activate', active: true })); } catch {}
  });
  ws.on('close', () => { wsReady = false; log('WS disconnesso, riconnetto in 2s'); setTimeout(connectWs, 2000); });
  ws.on('error', (e) => { log('WS errore', e.message); });
}

function sendController(payload) {
  if (!wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;
  try { ws.send(JSON.stringify({ type: 'controller', ...payload })); } catch {}
  // throttle a 50Hz max
  const now = Date.now();
  if (now - lastSend < 18) return;
  lastSend = now;
}

function parsePacket(buf) {
  if (buf.length < 38) return null;
  if (buf[0] !== 0x55) return null;
  const inRange = (v) => v >= 300 && v <= 1800;
  const norm = (v) => Math.max(-1, Math.min(1, (v - 1024) / 660));
  // Layout corretto da Python pverhaert: rx=13, ry=16, ly=19, lx=22 (little endian)
  const tryParse = (offsets) => {
    const vals = offsets.map(off => buf.readUInt16LE(off));
    if (vals.every(inRange)) {
      const [rx, ry, ly, lx] = vals;
      return { lx: norm(lx), ly: norm(ly), rx: norm(rx), ry: norm(ry), raw: { lx, ly, rx, ry } };
    }
    return null;
  };
  // Prova layout corretto
  let res = tryParse([13, 16, 19, 22]);
  if (res) return res;
  // Fallback: prova altri offset noti
  const fallbacks = [[10,12,14,16],[12,14,16,18],[13,16,19,22]];
  for (const offs of fallbacks) {
    const vals = offs.map(o => buf.readUInt16LE(o));
    if (vals.every(inRange)) {
      const [a,b,c,d] = vals;
      // mappa a seconda di layout
      return { lx: norm(a), ly: norm(b), rx: norm(c), ry: norm(d), raw: { lx:a, ly:b, rx:c, ry:d } };
    }
  }
  return null;
}

let opening = false;
async function openSerial(path) {
  if (opening) return;
  opening = true;
  const tryBauds = [921600, 115200, 57600];
  for (const baud of tryBauds) {
    try {
      log(`Apertura seriale ${path} @${baud}...`);
      if (serial && serial.isOpen) { try { serial.close(); } catch {} await new Promise(r => setTimeout(r, 300)); }
      serial = new SerialPort({ path, baudRate: baud, autoOpen: false });
      await new Promise((res, rej) => serial.open(err => err ? rej(err) : res()));
      log(`Seriale aperta @${baud}, invio handshake (3x)...`);
      for (let i = 0; i < 3; i++) {
        serial.write(HANDSHAKE);
        await new Promise(r => setTimeout(r, 100));
      }
      // Invia handshake ogni 10ms come Python (mantiene stream attivo)
  const hsInterval = setInterval(() => { try { serial.write(HANDSHAKE); } catch {} }, 10);
  serial.on('close', () => clearInterval(hsInterval));
  let buf = Buffer.alloc(0);
      let packetCount = 0;
      let lastLog = Date.now();
      serial.on('data', (chunk) => {
        if (Date.now() - lastLog > 3000) {
          log(`Ricevuti ${chunk.length} byte (hex: ${chunk.slice(0, 16).toString('hex')}...)`);
          lastLog = Date.now();
        }
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 3) {
          let start = buf.indexOf(0x55);
          if (start === -1) {
            if (buf.length > 100) {
              dbg(`Nessun header 0x55 in ${buf.length} byte, dump: ${buf.slice(0, 32).toString('hex')}`);
              buf = Buffer.alloc(0);
            }
            break;
          }
          if (start > 0) buf = buf.slice(start);
          if (buf.length < 3) break;
          const ph = buf.readUInt16LE(1);
          const pl = ph & 0x03FF; // 10-bit length
          if (pl < 3 || pl > 100) { buf = buf.slice(1); continue; }
          if (buf.length < pl) break; // aspetta resto pacchetto
          const packet = buf.slice(0, pl);
          buf = buf.slice(pl);
          packetCount++;
          if (packetCount % 50 === 0) log(`Pacchetti ricevuti: ${packetCount} len=${pl}`);
          if (pl !== 38) {
            // non è pacchetto stick, ignora
            if (DEBUG) dbg(`Pacchetto len ${pl} ignorato (non 38): ${packet.toString('hex').slice(0, 48)}`);
            continue;
          }
          const sticks = parsePacket(packet);
          if (!sticks) {
            if (DEBUG) dbg(`Pacchetto 38 scartato: ${packet.toString('hex').slice(0, 64)}`);
            continue;
          }
          const { lx, ly, rx, ry, raw } = sticks;
          const isCenter = raw.lx === 1024 && raw.ly === 1024 && raw.rx === 1024 && raw.ry === 1024;
          if (!isCenter) dbg(`raw lx=${raw.lx} ly=${raw.ly} rx=${raw.rx} ry=${raw.ry} -> norm lx=${lx.toFixed(2)} ly=${ly.toFixed(2)} rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`);
          const dz = 0.08;
          const dead = (v) => Math.abs(v) < dz ? 0 : v;
          const lxD = dead(lx), lyD = dead(ly), rxD = dead(rx), ryD = dead(ry);
          sendController({ action: 'orbit', x: lxD * 0.2, y: lyD * 0.2 });
          sendController({ action: 'pan', x: rxD * 0.2, y: ryD * 0.2 });
          const camRaw = packet.readUInt16LE(25);
          const camNorm = Math.max(-1, Math.min(1, (camRaw - 1024) / 660));
          const camD = dead(camNorm);
          sendController({ action: 'tilt', value: camD });
          // logga solo se sticks non al centro o se ci sono byte diversi dal centro (per tasti)
          const isCenterSticks = raw.lx === 1024 && raw.ly === 1024 && raw.rx === 1024 && raw.ry === 1024;
          if (!isCenterSticks) {
            dbg(`STICK move: lx=${raw.lx} ly=${raw.ly} rx=${raw.rx} ry=${raw.ry}`);
          }
          // per tasti, confronta con pacchetto centro e logga diff
          const centerSticks = { lx: 1024, ly: 1024, rx: 1024, ry: 1024 };
          const curIsCenter = raw.lx === 1024 && raw.ly === 1024 && raw.rx === 1024 && raw.ry === 1024;
          if (!curIsCenter) {
            // già loggato sopra
          } else {
            // anche se sticks al centro, controlla se altri byte (tasti) cambiano
            // usa un center di riferimento per tasti: se packet diverso da quello con tutti 0 nei tasti, logga
            const btnPart = packet.slice(28, 36).toString('hex');
            if (btnPart !== '0004000004000004') dbg(`btn non-center: ${btnPart} full:${packet.toString('hex').slice(0,64)}`);
          }
          const b28 = packet[28] || 0, b29 = packet[29] || 0, b30 = packet[30] || 0;
          const btnNow = (b28 << 16) | (b29 << 8) | b30;
          if (btnNow !== lastBtnState) {
            if ((btnNow & 0x01) && !(lastBtnState & 0x01)) {
              djiSpeedIdx = (djiSpeedIdx + 1) % djiSpeeds.length;
              const ns = djiSpeeds[djiSpeedIdx];
              sendController({ action: 'speed', value: ns });
              log(`DJI speed -> ${ns}x (selettore centrale)`);
            }
            if ((btnNow & 0x02) && !(lastBtnState & 0x02)) { sendController({ action: 'scene', scene: 'overview' }); log('DJI btn -> scene overview'); }
            if ((btnNow & 0x04) && !(lastBtnState & 0x04)) { sendController({ action: 'scene', scene: 'runner' }); log('DJI btn -> scene runner'); }
            if ((btnNow & 0x08) && !(lastBtnState & 0x08)) { sendController({ action: 'scene', scene: 'checkpoint' }); log('DJI btn -> scene checkpoint'); }
            if ((btnNow & 0x10) && !(lastBtnState & 0x10)) { sendController({ action: 'scene', scene: 'topdown' }); log('DJI btn -> scene topdown'); }
            lastBtnState = btnNow;
          }
        }
      });
      serial.on('error', (e) => log('Seriale errore', e.message));
      serial.on('close', () => { log('Seriale chiusa, riapro in 2s'); setTimeout(() => findAndOpen(), 2000); });
      // Se non riceviamo dati in 3s, prova prossimo baud
      setTimeout(() => {
        if (packetCount === 0) {
          log(`Nessun pacchetto @${baud} dopo 3s, provo prossimo baud...`);
          try { if (serial && serial.isOpen) serial.close(); } catch {}
          opening = false;
          openSerial(path).catch(() => {});
        } else {
          log(`Baud ${baud} OK, ${packetCount} pacchetti ricevuti`);
          opening = false;
        }
      }, 3000);
      opening = false;
      return;
    } catch (e) {
      log(`Fallito @${baud}: ${e.message}`);
      try { if (serial && serial.isOpen) serial.close(); } catch {}
      opening = false;
      continue;
    }
  }
  opening = false;
  log(`Tutti i baud falliti per ${path}`);
  setTimeout(() => findAndOpen(), 3000);
}

async function findAndOpen() {
  const path = await findDjiPort();
  if (!path) {
    log('Nessuna porta DJI trovata. Collega RC-N1 via USB-C inferiore, accendilo, e riprovo in 3s...');
    log('Porte disponibili:');
    const ports = await SerialPort.list();
    ports.forEach(p => log(`  - ${p.path} man=${p.manufacturer || '?'} prod=${p.productId || '?'}`));
    setTimeout(findAndOpen, 3000);
    return;
  }
  try { await openSerial(path); } catch (e) {
    log(`Impossibile aprire ${path}: ${e.message}`);
    setTimeout(findAndOpen, 3000);
  }
}

log('=== DJI RC-N1 → Giir 3D Bridge ===');
log('WS:', WS_URL);
log('Per debug dettagliato avvia con --debug');
connectWs();
findAndOpen();

// Keep alive
process.on('SIGINT', () => {
  log('Chiusura...');
  try { serial?.close(); } catch {}
  try { ws?.close(); } catch {}
  process.exit(0);
});
