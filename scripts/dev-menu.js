#!/usr/bin/env node
import readline from 'readline';
import { spawn } from 'child_process';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('\n=== Giir di Mont — Avvio ===');
console.log('1) Solo browser (vite)');
console.log('2) Browser + NDI (vite + ndi-service)');
console.log('3) Browser + NDI + DJI controller (vite + ndi + dji-bridge)');
console.log('');

rl.question('Scegli 1/2/3 [2]: ', (answer) => {
  const choice = (answer.trim() || '2');
  rl.close();
  let procs = [];
  if (choice === '1') {
    console.log('\n▶️ Avvio solo browser...\n');
    procs = [{ cmd: 'npx', args: ['vite', '--host'], name: 'VITE', color: 'cyan' }];
  } else if (choice === '3') {
    console.log('\n▶️ Avvio browser + NDI + DJI (con delay 1s tra i servizi)...\n');
    procs = [
      { cmd: 'npx', args: ['vite', '--host'], name: 'VITE', color: 'cyan', delay: 0 },
      { cmd: 'node', args: ['server/ndi-service.js'], name: 'NDI', color: 'magenta', delay: 1000 },
      { cmd: 'node', args: ['server/dji-bridge.js'], name: 'DJI', color: 'yellow', delay: 2500 },
    ];
  } else {
    console.log('\n▶️ Avvio browser + NDI (con delay 1s)...\n');
    procs = [
      { cmd: 'npx', args: ['vite', '--host'], name: 'VITE', color: 'cyan', delay: 0 },
      { cmd: 'node', args: ['server/ndi-service.js'], name: 'NDI', color: 'magenta', delay: 1000 },
    ];
  }

  // Avvia con delay
  if (procs.length === 1) {
    const p = procs[0];
    spawn(p.cmd, p.args, { stdio: 'inherit', shell: true });
  } else {
    procs.forEach((p) => {
      setTimeout(() => {
        console.log(`[Avvio ${p.name}...]`);
        const child = spawn(p.cmd, p.args, { stdio: 'inherit', shell: true });
        child.on('exit', (code) => { if (code !== 0) console.log(`[${p.name}] uscito con ${code}`); });
      }, p.delay || 0);
    });
  }
});
