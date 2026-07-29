#!/usr/bin/env node
/**
 * Pack Cue then launch Playwright against the unpacked binary.
 * Usage: npm run test:e2e:packed
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

console.log('Packing Cue…');
const pack = spawnSync('npm', ['run', 'pack'], { cwd: root, stdio: 'inherit', shell: true });
if (pack.status !== 0) process.exit(pack.status || 1);

let exe = null;
if (isWin) {
  const winExe = path.join(root, 'dist', 'win-unpacked', 'Cue.exe');
  const winExeAlt = path.join(root, 'dist', 'win-unpacked', 'cue.exe');
  // Pack layout is fixed under dist/; paths are not user-controlled.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (fs.existsSync(winExe)) exe = winExe;
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  else if (fs.existsSync(winExeAlt)) exe = winExeAlt;
} else if (isMac) {
  const macCandidates = [
    path.join(root, 'dist', 'mac', 'Cue.app', 'Contents', 'MacOS', 'Cue'),
    path.join(root, 'dist', 'mac-arm64', 'Cue.app', 'Contents', 'MacOS', 'Cue'),
    path.join(root, 'dist', 'mac-x64', 'Cue.app', 'Contents', 'MacOS', 'Cue')
  ];
  for (const candidate of macCandidates) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(candidate)) { exe = candidate; break; }
  }
}

if (!exe) {
  console.error('Packed binary not found under dist/. Skipping packed e2e on this platform layout.');
  process.exit(0);
}

process.env.CUE_PACKED_EXE = exe;
process.env.CUE_NO_PROTECT = '1';
console.log('Running packed e2e against', exe);
const e2e = spawnSync('npx', ['playwright', 'test', 'e2e/electron.packed.spec.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env
});
process.exit(e2e.status || 0);
