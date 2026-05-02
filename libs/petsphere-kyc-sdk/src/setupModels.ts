import fs from 'fs';
import path from 'path';

export async function setupModels() {
  function detectProjectType() {
    if (fs.existsSync('angular.json')) return 'angular';
    if (
      fs.existsSync('vite.config.js') ||
      fs.existsSync('vite.config.ts') ||
      fs.existsSync('index.html') ||
      fs.existsSync('public')
    )
      return 'vite';
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
    throw new Error('[AlphaValid] Pasta de models não encontrada: ' + src);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
  return `[petsphere-kyc-sdk] Models copiados para ${dest}`;
}
