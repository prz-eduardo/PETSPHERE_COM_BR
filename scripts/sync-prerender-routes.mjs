/**
 * Copia rotas pré-renderizadas do último `ng build` para prerender-routes.txt.
 * Rode após mudanças nas rotas: npm run sync:prerender-routes
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'dist', 'petsphere-com-br', 'prerendered-routes.json');
const out = join(root, 'prerender-routes.txt');

async function main() {
  const raw = await readFile(src, 'utf8');
  const j = JSON.parse(raw);
  const routes = Array.isArray(j.routes) ? j.routes : [];
  await writeFile(
    out,
    routes.slice().sort((a, b) => String(a).localeCompare(String(b))).join('\n') + '\n',
    'utf8',
  );
  console.log('[sync-prerender-routes]', out, '(' + routes.length + ' routes)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
