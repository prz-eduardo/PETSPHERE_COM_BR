# alphavalid-sdk

SDK frontend (framework-agnostic) para validação facial e liveness com captura de selfie em JPEG.

Principais recursos:
- câmera frontal com teardown correto
- overlay visual com guias e hints
- desafios de liveness configuráveis
- captura manual e auto-capture com gate de estabilidade
- preview com botões OK/Recapturar (SDK ou customizado)

---

## Instalação

```bash
npm i alphavalid-sdk
```

---

## Modelos (obrigatório)

O `face-api.js` carrega pesos via HTTP. Copie os models do pacote para a pasta pública do seu app.

### CLI (recomendado)

```bash
npx alphavalid-sdk setup
```

Ele detecta o tipo de projeto e copia:
- Angular: `src/assets/alphavalid-models` (runtime: `/assets/alphavalid-models`)
- Vite: `public/alphavalid-models` (runtime: `/alphavalid-models`)

### Manual

```bash
node ./node_modules/alphavalid-sdk/scripts/copy-models.cjs ./public/alphavalid-models
```

---

## Uso minimo

```ts
import { AlphaValid } from 'alphavalid-sdk';

const sdk = new AlphaValid();

await sdk.start({
  // se estiver no Angular/Ionic, use /assets/alphavalid-models
  modelsPath: '/alphavalid-models',
  onUserPreviewConfirm: (blob) => {
    // enviar blob
  }
});
```

Para finalizar:

```ts
await sdk.stop();
```

---

## Preview (OK/Recapturar)

O preview gerenciado pelo SDK funciona em `uiMode: 'Mobile'` e `userPreview: true`.
Por padrao o preview ja vem ligado.

```ts
await sdk.start({
  uiMode: 'Mobile',
  userPreview: true,
  previewOkText: 'OK',
  previewRetakeText: 'Tirar outra',
  onUserPreviewConfirm: (blob) => {
    // enviar blob
  }
});
```

Se voce quiser renderizar um preview customizado:

```ts
await sdk.start({
  onPreview: (blob, actions) => {
    // abra seu modal, use actions.retake() e actions.confirm()
  }
});
```

---

## Personalizacao de botoes

```ts
await sdk.start({
  captureButton: {
    enabled: true,
    text: 'Capturar foto',
    color: '#ff6b35'
  },
  previewOkText: 'Usar foto',
  previewRetakeText: 'Tirar outra'
});
```

---

## API publica

- `new AlphaValid()`
- `start(options: AlphaValidStartOptions): Promise<void>`
- `stop(): Promise<void>`
- `capture(): Promise<Blob>`
- `getState(): AlphaValidState | null`
- `resetChallenges(): void`
- `setupModels(): Promise<string>` (importando `setupModels` do pacote)

---

## Documentacao completa

Veja [alphavalid-sdk-docs.md](alphavalid-sdk-docs.md) para:
- todas as opcoes do SDK
- defaults oficiais
- exemplos completos
- ajustes de liveness e debug
- detalhes do estado e callbacks


### `stop(): Promise<void>`
