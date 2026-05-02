# alphavalid-sdk — Documentacao completa

SDK frontend (framework-agnostic) para **captura de selfie + liveness heuristico** direto no browser, sem backend de visao computacional.

Pensado para pipelines de identidade(KYC) onde voce precisa:
- abrir camera no navegador (desktop/mobile)
- guiar o usuario (feedback em tempo real)
- executar desafios simples de liveness (piscar, olhar para lados, etc.)
- capturar uma selfie em JPEG pronta para envio ao backend (face match, validacao documental, antifraude).

---

## O que e o AlphaValid?

**AlphaValid** e um SDK leve de validacao facial e liveness no frontend.

Ele cuida de:
- abrir camera, overlay e UI (ou funcionar em modo headless)
- validar qualidade basica do frame (1 rosto, centralizado, distancia adequada)
- aplicar desafios de liveness heuristico (sequencia configuravel)
- capturar a selfie final (JPEG Blob) para envio ao backend

Ele **nao faz**:
- reconhecimento facial / identificacao biometrica
- comparacao de rosto com documento
- scoring antifraude completo

Use o AlphaValid como **componente de captura + liveness** dentro do seu pipeline de identidade.

---

## Quando usar / Quando nao usar

### Quando usar

- Onboarding KYC (fintechs, bancos digitais, marketplaces, healthtechs) que precisam:
  - capturar selfie guiada com boa qualidade
  - aplicar liveness leve (piscar, olhar para lados, etc.)
- Fluxos de prova de vida simples (renovacao de cadastro, revalidacao periodica).
- Produtos que ja possuem backend de identidade (ex.: DataValid, bureaus, provedores de face match) e precisam apenas da **melhor captura possivel** no frontend.

### Quando **nao** usar sozinho

- Se voce precisa de **identificacao** ou **autenticacao biometrica robusta** (quem e essa pessoa?):
  - AlphaValid nao faz reconhecimento facial.
- Se precisa de liveness forte contra ataques sofisticados (deepfakes, replays elaborados, etc.):
  - o liveness aqui e **heuristico**, voltado a UX e barreiras basicas.
- Se sua regulacao exige tecnologia biometrica certificada:
  - use um provedor especializado e integre o AlphaValid apenas como captura/controlador de UX (opcional).

---

## Uso em KYC (pipeline recomendado)

O AlphaValid e pensado para ser **uma etapa** do seu fluxo KYC, nao o fluxo todo.

Pipeline tipico:

1. Coleta de dados cadastrais (nome, CPF, etc.).
2. Captura de documento (frente/verso) via outro componente.
3. **Captura de selfie + liveness** com AlphaValid.
4. Envio de:
   - selfie
   - imagens dos documentos
   - dados cadastrais
   para o backend/provedor (ex.: DataValid) para:
   - validacao documental
   - face match documento vs selfie
   - regras de antifraude.

Papel do AlphaValid nesse fluxo:

- Garantir que a selfie capturada:
  - tem **um** rosto visivel
  - esta **centralizada** e com **distancia razoavel**
  - passou pelos desafios de liveness configurados (ex.: piscar + olhar para frente)
- Entregar **um Blob JPEG** pronto para ser enviado ao backend.

Reforco importante:
- AlphaValid **nao faz identificacao** nem face match.
- Ele complementa o backend de identidade; nao substitui.

---

## Quick Start (1 minuto)

**Copie, cole e rode em menos de 1 minuto:**

```bash
npm i alphavalid-sdk
npx alphavalid-sdk setup
```

```ts
import { AlphaValid } from 'alphavalid-sdk';

const sdk = new AlphaValid();

await sdk.start({
  modelsPath: '/alphavalid-models',
  onUserPreviewConfirm: (blob) => {
    // ex: fazer upload da selfie para seu backend de identidade
    uploadSelfie(blob);
  }
});
```

- `npx alphavalid-sdk setup` copia os models para o lugar certo (Angular/Vite).
- `modelsPath: '/alphavalid-models'` funciona para Vite/SPA/Next/CRA quando os models estao em `public/alphavalid-models`.

---

## Sumario

- O que e o AlphaValid?
- Quando usar / Quando nao usar
- Uso em KYC
- Quick Start
- Instalacao e setup de models
- Setup recomendado (90% dos casos)
- Fluxo recomendado
- Exemplos (minimo e completo)
- Referencia de opcoes (AlphaValidStartOptions)
- Liveness (TL;DR + avancado)
- UI/preview/botoes
- Debug
- Tipos principais
- Estado e callbacks
- Ciclo de vida
- UI headless (modo recomendavel p/ producao)
- Fluxo interno (diagrama)
- Performance
- Boas praticas de UX
- Troubleshooting
- Limitacoes
- CLI e scripts
- Notas

---

## Setup recomendado (90% dos casos)

Para a maioria dos fluxos KYC/frontend:

- 2 desafios simples de liveness
- preset de liveness equilibrado
- preview gerenciado pelo SDK

```ts
const sdk = new AlphaValid();

await sdk.start({
  modelsPath: '/alphavalid-models',

  livenessPreset: 'normal',
  liveness: {
    challenges: [
      { type: 'lookForward' },
      { type: 'blink' }
    ]
  },

  userPreview: true,
  onUserPreviewConfirm: (blob) => {
    enviarSelfieParaKyc(blob);
  }
});
```

Recomendacao importante para maior robustez:
- a **ordem dos challenges** (`challenges: [...]`) pode ser gerada pelo backend (ex.: embaralhada/variavel por sessao) e enviada ao frontend.
- isso reduz repetibilidade do fluxo e aumenta barreira para scripts simples.

---

## Instalacao

```bash
npm i alphavalid-sdk
```

---

## Setup dos models (obrigatorio)

O `face-api.js` carrega os pesos via HTTP. O pacote inclui os arquivos em `models/`.

### CLI recomendado

```bash
npx alphavalid-sdk setup
```

O CLI detecta seu projeto e copia para:
- Angular: `src/assets/alphavalid-models` (runtime: `/assets/alphavalid-models`)
- Vite: `public/alphavalid-models` (runtime: `/alphavalid-models`)

### Manual

```bash
node ./node_modules/alphavalid-sdk/scripts/copy-models.cjs ./public/alphavalid-models
```

---

## Fluxo recomendado

1) Copiar os models para um caminho publico.
2) Criar um container (ou usar o id `cameraContainer`).
3) `sdk.start()` com opcoes.
4) Capturar via auto-capture ou botao manual.
5) Confirmar preview ou tratar `onPreview`.

---

## Exemplo minimo

```ts
import { AlphaValid } from 'alphavalid-sdk';

const sdk = new AlphaValid();

await sdk.start({
  modelsPath: '/alphavalid-models',
  onUserPreviewConfirm: (blob) => {
    // upload ou persistencia
  }
});
```

---

## Exemplo completo (todos os parametros)

No exemplo completo, o `uiMode: 'Mobile'` representa hoje o layout mobile otimizado (overlay + preview + botao). Apesar do nome interno, ele e adequado para producao; no futuro, uma alias mais neutra (ex.: `mobile`) podera ser introduzida mantendo compatibilidade.

```ts
import { AlphaValid } from 'alphavalid-sdk';

const sdk = new AlphaValid();

await sdk.start({
  // container opcional: se omitido usa #cameraContainer
  container: document.getElementById('cameraContainer')!,

  // modelos
  modelsPath: '/assets/alphavalid-models',

  // UI
  uiMode: 'Mobile',
  overlay: true,
  guideCircleRatio: 0.72,

  // preview gerenciado
  userPreview: true,
  onUserPreviewConfirm: (blob) => {
    console.log('confirmado', blob);
  },
  previewOkText: 'Usar foto',
  previewRetakeText: 'Tirar outra',

  // loader
  loader: {
    enabled: true,
    src: '/images/alphaloader.gif',
    sizePx: 120,
    minVisibleMs: 900
  },

  // botao manual (somente Mobile + autoCapture desabilitado)
  captureButton: {
    enabled: true,
    text: 'Capturar foto',
    color: '#ff6b35'
  },

  // performance
  detectionIntervalMs: 50,

  // gate adicional de lookForward no momento da captura
  requireLookForwardForCapture: true,

  // liveness
  liveness: {
    challenges: [
      { type: 'lookForward' },
      { type: 'blink' },
      { type: 'lookLeft' },
      { type: 'lookRight' },
      { type: 'lookUp' },
      { type: 'lookDown' },
      { type: 'zoomIn' },
      { type: 'zoomOut' },
      { type: 'cheese' },
      { type: 'openMouth' }
    ],

    strictness: 0.5,
    lookForwardTolerance: 0.75,
    lookForwardCenterTol: 0.12,
    lookForwardYawTol: 0.06,
    lookForwardJawMouthDistMinPx: 500,
    lookForwardJawMouthDistMaxPx: 1000,
    lookForwardMouthVsJawMidYAbsTol: 0.5,
    lookForwardHoldMs: 1000,

    lookSideTol: 0.05,
    lookUpDownTol: 0.12,
    lookSideRatioThr: 0.12,
    lookSideAbsDeltaThr: 0.1,
    lookSideNearThr: 0.3,
    lookSideFarThr: 1.0,

    zoomInMinArea: 0.16,
    zoomOutMaxArea: 0.12,

    blinkClosedThreshold: 0.5,
    blinkOpenThreshold: 0.85,

    challengeMinHoldMs: 150,
    challengeCooldownMs: 400,
    neutralHoldMs: 350,

    cheeseThreshold: 0.05,
    cheeseUseBaseline: true,
    cheeseBaselineWindowMs: 1200,
    cheeseBaselineMinSamples: 8,

    openMouthThreshold: 0.5,

    poseProgressAccept: 0.65,
    poseGraceMs: 900,
    faceLostGraceMs: 900,
    mirrorMode: 'mirrored',
    poseProgressSource: 'auto'
  },

  // auto-capture (opcional)
  autoCapture: {
    enabled: false,
    stableMs: 650,
    holdStillMessage: 'Nao se mova...',
    onCapture: (blob) => {
      console.log('auto-capture', blob);
    }
  },

  // callbacks
  onReady: () => console.log('ready'),
  onFeedback: (fb) => console.log('feedback', fb),
  onStateChange: (state) => console.log('state', state),
  onError: (err) => console.error('error', err),

  // debug
  debug: {
    drawLandmarks: true,
    draw: {
      eyes: true,
      mouth: true,
      nose: true,
      jaw: true,
      mouthJaw: true,
      cheese: true
    },
    extra: {
      showOverlayTable: true,
      showOverlayTableCanvas: false
    }
  }
});
```

---

## Referencia de opcoes (AlphaValidStartOptions)

### Gerais

- `container?: HTMLElement`
  - Default: elemento com id `cameraContainer`.

- `modelsPath?: string`
  - Default: `/alphavalid-models`.

- `detectionIntervalMs?: number`
  - Default: `50`.

### UI

- `uiMode?: 'default' | 'headless' | 'Mobile'`
  - Default: `Mobile`.

- `overlay?: boolean`
  - Default: `true` (quando `uiMode !== 'headless'`).

- `guideCircleRatio?: number`
  - Default: `0.72`.

### Preview (SDK)

- `userPreview?: boolean`
  - Default: `true`.
  - So funciona em `uiMode: 'Mobile'`.

- `onUserPreviewConfirm?: (blob: Blob) => void`
  - Chamado quando o usuario toca OK.

- `previewOkText?: string`
  - Default: `OK`.

- `previewRetakeText?: string`
  - Default: `Tirar outra`.

### Preview customizado

- `onPreview?: (blob, actions) => void`
  - Se definido, o SDK nao renderiza a UI de preview e entrega:
    - `actions.retake()`
    - `actions.confirm()`

### Loader

- `loader?: { enabled?: boolean; src?: string; sizePx?: number; minVisibleMs?: number }`
  - Defaults: `enabled: true`, `src: /images/alphaloader.gif`, `sizePx: 120`, `minVisibleMs: 900`.

### Botao de captura (SDK)

- `captureButton?: { enabled?: boolean; text?: string; color?: string }`
  - Default: `enabled: true`, `text: 'Capturar imagem'`, `color: '#00bcd4'`.
  - So aparece em `uiMode: 'Mobile'` e quando `autoCapture.enabled !== true`.

### Liveness

- `liveness?: AlphaValidLivenessOptions`
  - Veja a secao completa abaixo.

- `livenessPreset?: 'easy' | 'normal' | 'strict'`
  - Atalho para configuracoes de liveness sem mexer em todos os thresholds.
  - `normal` (default): usa os valores atuais (equilibrado entre UX e rigor).
  - `easy`: ideal para UX suave (menos exigente, menos friccao).
  - `strict`: ideal para fluxos mais sensiveis (mais exigente, pode reprovar mais usuarios).

Quando `livenessPreset` e informado **e** `liveness` tambem, os valores explicitos em `liveness` tem precedencia sobre o preset.

### Auto-capture

- `autoCapture?: { enabled?: boolean; stableMs?: number; holdStillMessage?: string; onCapture?: (blob) => void }`
  - Default: `enabled: false`, `stableMs: 650`.

### Gate de lookForward na captura

- `requireLookForwardForCapture?: boolean`
  - Default: `true`.

### Callbacks

- `onReady?: () => void`
- `onFeedback?: (feedback) => void`
- `onStateChange?: (state) => void`
- `onError?: (error) => void`

### Debug

- `debug?: { drawLandmarks?: boolean; draw?: {...}; extra?: any }`
  - `draw`:
    - `eyes?: boolean`
    - `mouth?: boolean`
    - `nose?: boolean`
    - `jaw?: boolean`
    - `mouthJaw?: boolean`
    - `cheese?: boolean`

---

## Liveness (AlphaValidLivenessOptions)

### TL;DR (resumo pratico)

- Use `livenessPreset` para nao mexer em dezenas de thresholds:
  - `easy` → UX mais suave, menos exigente.
  - `normal` → equilibrio entre UX e rigor (default recomendado).
  - `strict` → mais exigente (pode reprovar mais usuarios; use com cuidado).
- Defina **poucos challenges** (2–4):
  - ex.: `lookForward` + `blink` ou `lookForward` + `lookLeft` + `lookRight`.
- Deixe os thresholds avancados (`lookSideTol`, `poseProgressAccept`, etc.) nos defaults, a menos que voce tenha tempo para testar muito bem.

Exemplo enxuto recomendado:

```ts
await sdk.start({
  livenessPreset: 'normal',
  liveness: {
    challenges: [
      { type: 'lookForward' },
      { type: 'blink' }
    ]
  }
});
```

Para maior robustez, gere a ordem dos challenges no backend (embaralhada ou dinamica) e envie ja pronta para o frontend.

### Sequencia

- `challenges?: AlphaValidChallengeStep[]`
  - Tipos: `lookForward`, `lookLeft`, `lookRight`, `lookUp`, `lookDown`, `zoomIn`, `zoomOut`, `blink`, `cheese`, `openMouth`, `mouthWidth`.
  - O SDK nao injeta `lookForward` automaticamente.

### Sensibilidade e thresholds (explicacao pratica)

Alguns parametros sao mais "perigosos" de mexer. Dicas de tuning:

- `strictness?: number` (0..1)
  - Mais alto = liveness mais exigente (mais dificil de passar).
  - `0.3`–`0.6`: bom para producao amigavel.

- `lookForwardTolerance?: number` (0..1)
  - Quanto maior, mais tolerante a pequenas variacoes (fica mais facil ficar em "olhe para a camera").

- `lookForwardCenterTol?: number`
  - Tolerancia para o rosto sair um pouco do centro.
  - Menor = obriga usuario a ficar mais centralizado.

- `lookForwardYawTol?: number`
  - Quanto menor, mais rigido para virar o rosto.
  - Se usuarios reclamarem que "nao passa" mesmo olhando para frente, aumente um pouco.

- `lookSideTol?`, `lookUpDownTol?`
  - Controlam o quanto o usuario precisa virar/subir/descer a cabeca.
  - Menor = precisa virar mais.

- `zoomInMinArea?` / `zoomOutMaxArea?`
  - Controlam o quanto precisa aproximar/afastar.
  - Use valores extremos com cuidado para nao exigir movimentos desconfortaveis.

- `cheeseThreshold?` / `cheeseUseBaseline?`
  - Com `cheeseUseBaseline: true` (default), o SDK mede sua boca neutra e aceita "sorriso" quando passar `cheeseThreshold` acima disso.
  - Menor = sorriso mais facil de ser aceito.

- `openMouthThreshold?`
  - Maior = precisa abrir mais a boca para passar.

- `poseProgressAccept?`
  - Quanto de progresso (0..1) precisa para o desafio de pose ser considerado ok.
  - Valores mais altos deixam o desafio mais exigente.

Se voce nao precisa de tuning fino, pode usar apenas `challenges` + `strictness` e deixar o resto com defaults.

_Observacao_: para a maioria dos casos de uso, comece com apenas:

```ts
await sdk.start({
  livenessPreset: 'normal',
  liveness: {
    challenges: [
      { type: 'lookForward' },
      { type: 'blink' }
    ]
  }
});
```

E ajuste `livenessPreset` para `easy` ou `strict` conforme seu publico/risco.

---

## Estado e callbacks

### Ciclo de vida

Transicoes de estado do SDK:

- `initializing`: inicializando (abrindo camera, carregando modelos)
- `running`: pronto para detectar faces
- `ready`: rosto detectado, pronto para capturar
- `stopped`: camera parada

### Principais propriedades

- `status`: estado atual (`initializing`, `running`, `ready`, `stopped`)
- `isReadyToCapture`: booleano, indica se o SDK esta pronto para capturar uma imagem
- `challenge`: objeto do desafio atual (ou `null`)

### Exemplos

Exemplo para habilitar/desabilitar botao "Capturar" na sua UI (versao simples):

```ts
await sdk.start({
  uiMode: 'headless',
  onStateChange: (state) => {
    const canCapture = state.status === 'ready' && state.isReadyToCapture;
    updateCaptureButton(canCapture);
  }
});
```

Se voce quiser depender explicitamente da presenca de liveness (challenges), use apenas `isReadyToCapture` como verdade unica (o SDK ja leva liveness em conta):

```ts
const canCapture = state.isReadyToCapture;
```

Assim voce nao precisa inspecionar campos internos de `challenge`.

**Recomendacao importante:**

- Trate `state.isReadyToCapture` como **fonte de verdade** para habilitar captura (botao, auto-capture, etc.).
- O SDK ja leva em conta liveness, qualidade de frame e demais heuristicas ao definir esse flag.

Em quase todos os cenarios, voce pode simplesmente fazer:

```ts
onStateChange: (state) => {
  const canCapture = state.isReadyToCapture;
  toggleCaptureButton(canCapture);
}
```

Sem inspecionar detalhes internos de `challenge` ou `debug`.

---

## UI headless e captura manual (modo recomendado para UIs custom)

Quando `uiMode: 'headless'`:
- O SDK nao renderiza overlay, textos ou botoes.
- Voce controla toda a experiencia visual, usando apenas o estado/callbacks.

Fluxo tipico:

```ts
const sdk = new AlphaValid();

await sdk.start({
  uiMode: 'headless',
  onStateChange: (state) => {
    renderStatus(state.feedback.message);

    const canCapture =
      state.status === 'ready' &&
      state.isReadyToCapture &&
      (!state.challenge?.enabled || state.challenge.completed);

    toggleCaptureButton(canCapture);
  },
  onPreview: (blob, actions) => {
    openCustomPreviewModal(blob, {
      onConfirm: () => actions.confirm(),
      onRetake: () => actions.retake()
    });
  }
});

// opcional: usar capture() direto no clique do seu botao
captureButton.onclick = async () => {
  const blob = await sdk.capture();
  // tratar blob...
};
```

Exemplo simples de UI HTML:

```html
<div id="cameraContainer"></div>
<button id="captureBtn" disabled>Capturar</button>
<div id="status"></div>
```

```ts
const sdk = new AlphaValid();
const btn = document.getElementById('captureBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;

await sdk.start({
  uiMode: 'headless',
  onStateChange: (state) => {
    statusEl.textContent = state.feedback.message;

    const canCapture =
      state.status === 'ready' &&
      state.isReadyToCapture &&
      (!state.challenge?.enabled || state.challenge.completed);

    btn.disabled = !canCapture;
  },
  onPreview: (blob, actions) => {
    // seu preview custom
    openCustomPreviewModal(blob, {
      onConfirm: () => actions.confirm(),
      onRetake: () => actions.retake()
    });
  }
});

btn.onclick = async () => {
  const blob = await sdk.capture();
  // ex: mandar direto para backend ou abrir outro preview
};
```

Nos exemplos de headless, sempre prefira usar **somente** `state.isReadyToCapture` como criterio de habilitacao:

```ts
const canCapture = state.isReadyToCapture;
```

Isso evita depender de campos internos como `challenge.enabled/completed` e garante compatibilidade futura.

---

## Fluxo interno (diagrama textual)

```
inicializa()
  ├─ abreCamera()
  ├─ carregaModelos()
  ├─ onReady()
  │    ├─ startDetection()
  │    ├─ onStateChange(aguardando rosto)
  │    │    ├─ rostoDetectado()
  │    │    │    ├─ onStateChange(pronto para capturar)
  │    │    │    ├─ iniciaDesafioLiveness()
  │    │    │    ├─ onFeedback(desafio em andamento)
  │    │    │    └─ onError(erro no desafio)
  │    │    └─ rostoNaoDetectado()
  │    │         └─ onFeedback(aguardando rosto)
  │    └─ onError(erro ao iniciar)
  └─ onFeedback(inicializando...)
```

---

## Performance

- `detectionIntervalMs` controla o intervalo entre deteccoes (em ms):
  - valores menores = mais responsivo, mais uso de CPU.
  - valores maiores = menos uso de CPU/bateria, porem feedback um pouco menos fluido.

Recomendacoes praticas:

- Desktop/notebooks:
  - `detectionIntervalMs: 40–60` (default atual: `50`).
- Mobile intermediario/antigo:
  - `detectionIntervalMs: 80–120`.

Dicas:

- Se notar aquecimento/travamento em celulares, aumente para `80` ou `100`.
- Para telas com muitos elementos/animacoes, considere aumentar um pouco para aliviar o main thread.

---

## Boas praticas de UX

Para evitar frustracao do usuario em fluxos de liveness/captura:

- Sempre exiba o feedback do SDK na tela:
  - via `onFeedback` (texto simples), ou
  - via `onStateChange` usando `state.feedback.message`.
- Evite sequencias muito longas de desafios:
  - 2–3 steps (ex: `lookForward` + `blink`) funcionam bem para onboarding.
  - 4–5 steps ja parecem "prova de vida" mais pesada.
- Use mensagens claras e curtas (sem jargoes tecnicos).
- Tenha um limite de tentativas razoavel e um plano B:
  - ex: apos X falhas, oferecer upload de documento ou contato com suporte.
- Em mobile, evite exigir movimentos muito extremos de cabeca.

Exemplo de liveness enxuto para UX rapida:

```ts
await sdk.start({
  livenessPreset: 'normal',
  liveness: {
    challenges: [
      { type: 'lookForward' },
      { type: 'blink' }
    ]
  }
});
```

---

## Troubleshooting (problemas comuns)

- **Captura muito escura ou clara**:
  - Ajuste a iluminacao do ambiente.
  - Evite luz de fundo intensa (ex: janela aberta atras da pessoa).
- **Rosto cortado ou fora de foco**:
  - Peça para o usuario centralizar o rosto na tela.
  - Verifique se ha apenas **um** rosto visivel.
- **Desafios de liveness muito exigentes ou muito fáceis**:
  - Ajuste o `livenessPreset` para `easy`, `normal` ou `strict`.
  - Teste com diferentes usuarios e em diferentes iluminacoes.
- **Erro ao iniciar o SDK**:
  - Verifique se os models estao no caminho correto.
  - Confira se ha permissao para acessar a camera.

Acrescimo para o caso "nunca fica ready":

### Nunca fica "ready" (isReadyToCapture nunca true)

- Verifique iluminacao: ambientes muito escuros prejudicam deteccao.
- Certifique-se de que ha apenas **1 rosto** visivel.
- Teste aumentar tolerancias ou suavizar preset:
  - usar `livenessPreset: 'easy'`.
  - aumentar `lookForwardTolerance`.
  - diminuir `poseProgressAccept`.
- Ative `debug.drawLandmarks` e `debug.extra` no ambiente de teste para inspecionar overlay.

---

## Limitacoes

- **Nao** faz reconhecimento facial nem identificacao biometrica.
- Liveness e **heuristico**, baseado em pose/movimentos e sinais derivados de landmarks:
  - nao substitui solucoes biomtricas dedicadas com certificacao/regulacao especifica.
- Depende fortemente de:
  - iluminacao adequada (rosto visivel, sem contra-luz extrema).
  - qualidade da camera e estabilidade do dispositivo.
- Ambientes com muitos rostos, mascaras, oclusoes extremas ou latencia muito alta podem reduzir a eficacia das heuristicas.

Sempre complemente com um backend de identidade (documento + face match + regras antifraude).

---

## CLI e scripts

### Setup dos models

```bash
npx alphavalid-sdk setup
```

### Exemplos de uso

```ts
import { AlphaValid } from 'alphavalid-sdk';

const sdk = new AlphaValid();
await sdk.start({ modelsPath: '/alphavalid-models' });
```

---

## Notas

- Para relatar bugs ou sugerir melhorias, use o GitHub Issues do repositorio.
- Mantenha sempre as dependencias atualizadas para receber melhorias de liveness, performance e UX.
- Para liveness robusto e decisao KYC final, use o AlphaValid como componente de **captura guiada**, integrado a um backend de identidade especializado.
