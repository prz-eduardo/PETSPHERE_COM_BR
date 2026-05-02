import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import fs from 'fs';

const modelsDir = fileURLToPath(new URL('../models', import.meta.url));

function contentTypeFor(ext: string) {
  if (ext === '.json') return 'application/json';
  if (ext === '.bin') return 'application/octet-stream';
  if (ext === '.manifest') return 'application/json';
  return 'application/octet-stream';
}

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0', // permite acesso externo
    https: {
      key: fs.readFileSync('../192.168.18.71-key.pem'),
      cert: fs.readFileSync('../192.168.18.71.pem'),
    },
  },
  plugins: [
    {
      name: 'serve-alphavalid-models',
      configureServer(server) {
        // Serve local SDK models for dev without copying to demo/public
        server.middlewares.use('/alphavalid-models', (req, res, next) => {
          if (!req.url) return next();
          const urlPath = decodeURIComponent(req.url.split('?')[0] || '');
          const safePath = urlPath.replace(/^\/+/, '');
          const filePath = path.join(modelsDir, safePath);
          if (!filePath.startsWith(modelsDir)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }
          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            return next();
          }
          res.setHeader('Content-Type', contentTypeFor(path.extname(filePath).toLowerCase()));
          fs.createReadStream(filePath).pipe(res);
        });
      },
    }
  ],
  resolve: {
    alias: {
      // Importa o SDK via source (sem publicar / sem build)
      'alphavalid-sdk': fileURLToPath(new URL('../src/index.ts', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        minimum: fileURLToPath(new URL('./minimum.html', import.meta.url))
      }
    }
  }
});
