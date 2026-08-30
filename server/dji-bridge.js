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

async function openSerial(path) {
  const tryBauds = [921600, 115200, 57600];
  for (const baud of tryBauds) {
    try {
      log(`Apertura seriale ${path} @${baud}...`);
      serial = new SerialPort({ path, baudRate: baud, autoOpen: false });
      await new Promise((res, rej) => serial.open(err => err ? rej(err) : res()));
      log(`Seriale aperta @${baud}, invio handshake (3x)...`);
      // Invia handshake 3 volte con delay per robustezza
      for (let i = 0; i < 3; i++) {
        serial.write(HANDSHAKE);
        await new Promise(r => setTimeout(r, 100));
      }
      let buf = Buffer.alloc(0);
      let packetCount = 0;
      let lastLog = Date.now();
      serial.on('data', (chunk) => {
        if (Date.now() - lastLog > 3000) {
          log(`Ricevuti ${chunk.length} byte (hex: ${chunk.slice(0, 16).toString('hex')}...)`);
          lastLog = Date.now();
        }
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 38) {
          let start = buf.indexOf(0x55);
          if (start === -1) { 
            // log raw per debug se non troviamo header
            if (buf.length > 100) {
              dbg(`Nessun header 0x55 in ${buf.length} byte, dump: ${buf.slice(0, 32).toString('hex')}`);
              buf = Buffer.alloc(0);
            }
            break; 
          }
          if (start > 0) buf = buf.slice(start);
          if (buf.length < 38) break;
          const packet = buf.slice(0, 38);
          buf = buf.slice(38);
          packetCount++;
          if (packetCount % 50 === 0) log(`Pacchetti ricevuti: ${packetCount}`);
          const sticks = parsePacket(packet);
          if (!sticks) {
            if (DEBUG) dbg(`Pacchetto scartato: ${packet.toString('hex').slice(0, 64)}`);
            continue;
          }
          const { lx, ly, rx, ry, raw } = sticks;
          dbg(`raw lx=${raw.lx} ly=${raw.ly} rx=${raw.rx} ry=${raw.ry} -> norm lx=${lx.toFixed(2)} ly=${ly.toFixed(2)} rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`);
          const dz = 0.08;
          const dead = (v) => Math.abs(v) < dz ? 0 : v;
          const lxD = dead(lx), lyD = dead(ly), rxD = dead(rx), ryD = dead(ry);
          if (lxD || lyD) sendController({ action: 'orbit', x: lxD, y: -lyD });
          if (rxD || ryD) sendController({ action: 'pan', x: rxD, y: -ryD });
        }
      });
      serial.on('error', (e) => log('Seriale errore', e.message));
      serial.on('close', () => { log('Seriale chiusa, riapro in 2s'); setTimeout(() => findAndOpen(), 2000); });
      // Se non riceviamo dati in 3s, prova prossimo baud
      setTimeout(() => {
        if (packetCount === 0) {
          log(`Nessun pacchetto @${baud} dopo 3s, provo prossimo baud...`);
          try { if (serial && serial.isOpen) serial.close(); } catch {}
          openSerial(path).catch(() => {});
        } else {
          log(`Baud ${baud} OK, ${packetCount} pacchetti ricevuti`);
        }
      }, 3000);
      return;
    } catch (e) {
      log(`Fallito @${baud}: ${e.message}`);
      try { if (serial && serial.isOpen) serial.close(); } catch {}
      continue;
    }
  }
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
