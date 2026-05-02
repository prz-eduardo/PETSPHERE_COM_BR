#!/usr/bin/env node

// Copies PetSphere KYC face-api model files into the consumer app.
// From app root (Angular): models land in public/assets/kyc-face-models → /assets/kyc-face-models
// Usage:
//   node ./node_modules/petsphere-kyc-sdk/scripts/copy-models.cjs

const fs = require('fs');
const path = require('path');

function detectProjectType() {
  if (fs.existsSync('angular.json')) return 'angular';
  if (fs.existsSync('vite.config.js') || fs.existsSync('vite.config.ts') || fs.existsSync('index.html') || fs.existsSync('public')) return 'vite';
  return 'unknown';
}

function getTargetDir() {
  const type = detectProjectType();
  if (type === 'angular') {
    if (fs.existsSync(path.join('public'))) {
      return path.join('public', 'assets', 'kyc-face-models');
    }
    return path.join('src', 'assets', 'kyc-face-models');
  }
  if (type === 'vite') return path.join('public', 'assets', 'kyc-face-models');
  return path.join('kyc-face-models');
}

const src = path.join(__dirname, '../models');
const dest = path.resolve(process.cwd(), getTargetDir());
if (!fs.existsSync(src)) {
  console.error('[petsphere-kyc-sdk] Pasta de models não encontrada:', src);
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });
for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log(`[petsphere-kyc-sdk] Models copiados para ${dest}`);
