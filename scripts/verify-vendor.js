#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'vendor-hashes.json'), 'utf8'));
let failed = 0;

function hashesEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

for (const [rel, hash] of Object.entries(expected)) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error('missing', rel);
    failed++;
    continue;
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if (!hashesEqual(actual, hash)) {
    console.error('hash mismatch', rel, '\n expected', hash, '\n actual  ', actual);
    failed++;
  } else {
    console.log('ok', rel);
  }
}

const fonts = [
  'renderer/fonts/outfit-latin-400-normal.woff2',
  'renderer/fonts/outfit-latin-500-normal.woff2',
  'renderer/fonts/outfit-latin-600-normal.woff2',
  'renderer/fonts/outfit-latin-700-normal.woff2',
  'renderer/fonts/ibm-plex-mono-latin-400-normal.woff2',
  'renderer/fonts/ibm-plex-mono-latin-500-normal.woff2'
];
for (const rel of fonts) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error('missing font', rel);
    failed++;
  } else {
    console.log('ok', rel);
  }
}

process.exit(failed ? 1 : 0);
