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
  ws.on('open', () => { wsReady = true; log('WS connesso'); });
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
  // DJI RC-N1 38-byte packet, stick raw 364..1684 center 1024
  // Offsets da reverse engineering (pverhaert/miniontoby): bytes 10-11 LX, 12-13 LY, 14-15 RX, 16-17 RY (little endian 16-bit)
  // Alcune varianti usano 10:LX 12:LY 14:RX 16:RY, altre 12:RY etc. Proviamo entrambe e logghiamo
  if (buf.length < 38) return null;
  if (buf[0] !== 0x55) return null; // header
  const read16 = (off) => buf.readUInt16LE(off);
  // Prova layout A
  let lx = read16(10), ly = read16(12), rx = read16(14), ry = read16(16);
  // Se i valori sono fuori range 300-1800, prova layout B (shift)
  const inRange = (v) => v >= 300 && v <= 1800;
  if (![lx, ly, rx, ry].every(inRange)) {
    // layout B: offset 12,14,16,18
    lx = read16(12); ly = read16(14); rx = read16(16); ry = read16(18);
    if (![lx, ly, rx, ry].every(inRange)) return null;
  }
  const norm = (v) => Math.max(-1, Math.min(1, (v - 1024) / 660));
  return { lx: norm(lx), ly: norm(ly), rx: norm(rx), ry: norm(ry), raw: { lx, ly, rx, ry } };
}

async function openSerial(path) {
  log(`Apertura seriale ${path} @921600...`);
  serial = new SerialPort({ path, baudRate: 921600, autoOpen: false });
  await new Promise((res, rej) => serial.open(err => err ? rej(err) : res()));
  log(`Seriale aperta, invio handshake...`);
  serial.write(HANDSHAKE);
  let buf = Buffer.alloc(0);
  serial.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 38) {
      // cerca header 0x55
      let start = buf.indexOf(0x55);
      if (start === -1) { buf = Buffer.alloc(0); break; }
      if (start > 0) buf = buf.slice(start);
      if (buf.length < 38) break;
      const packet = buf.slice(0, 38);
      buf = buf.slice(38);
      const sticks = parsePacket(packet);
      if (!sticks) continue;
      const { lx, ly, rx, ry, raw } = sticks;
      dbg(`raw lx=${raw.lx} ly=${raw.ly} rx=${raw.rx} ry=${raw.ry} -> norm lx=${lx.toFixed(2)} ly=${ly.toFixed(2)} rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`);
      // Mappa DJI Mode 2 (default): LX=yaw, LY=throttle, RX=roll, RY=pitch
      // Per Giir 3D: left orbit (yaw/pitch), right pan
      // Invia come controller virtuale
      // Dead-zone 0.08
      const dz = 0.08;
      const dead = (v) => Math.abs(v) < dz ? 0 : v;
      const lxD = dead(lx), lyD = dead(ly), rxD = dead(rx), ryD = dead(ry);
      // Invia orbit con left stick
      if (lxD || lyD) sendController({ action: 'orbit', x: lxD, y: -lyD }); // ly invertito per pitch naturale
      // Invia pan con right stick
      if (rxD || ryD) sendController({ action: 'pan', x: rxD, y: -ryD });
      // Invia anche zoom via dial (se vuoi mappare RY a zoom): opzionale
      // Per ora non inviamo zoom da DJI, lo lasciamo allo slider
    }
  });
  serial.on('error', (e) => log('Seriale errore', e.message));
  serial.on('close', () => { log('Seriale chiusa, riapro in 2s'); setTimeout(() => findAndOpen(), 2000); });
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
