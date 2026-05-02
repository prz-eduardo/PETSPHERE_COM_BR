# alphavalid-sdk demo

Demo local para testar overlay/canvas/landmarks antes de publicar/consumir via npm.

## Pré-requisitos
- Node.js / npm
- Permissão de câmera no browser

## Como rodar

### Opção A (recomendado): usando scripts do root
1) Instale as dependências do projeto:
- `npm i`

2) Instale as dependências do demo:
- `npm run demo:install`

3) Copie os modelos do face-api.js para o `public/` do demo:
- `npm run copy-models:demo`

4) Suba o dev server:
- `npm run demo:dev`

### Opção B: rodando manualmente
1) `cd demo && npm i`
2) `node ../scripts/copy-models.cjs ./public/alphavalid-models`
3) `npm run dev`

## Como testar
- Abra a URL mostrada pelo Vite.
- Permita acesso à câmera.
- Centralize o rosto no círculo.
- Se houver desafios (liveness) configurados no demo, execute os passos.
- Quando o estado ficar pronto, teste a captura.

## Dicas (mobile)
- Para a câmera funcionar no celular, prefira HTTPS (ou debug remoto via cabo).
- Se estiver na mesma rede, use o IP local exibido pelo Vite para abrir no celular.

## Assets de modelos
Os arquivos são copiados para:
- `demo/public/alphavalid-models`
Em runtime o SDK deve apontar para:
- `modelsPath: '/alphavalid-models'`
