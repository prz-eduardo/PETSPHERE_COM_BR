import { AlphaValid } from '../../src/index';
import { clamp } from '../../src/utils/canvas';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

// Simple helpers
const uid = () => Math.random().toString(16).slice(2);

// Preview/capture payload for the consuming app (demo just logs it).
// This is set from `onPreview` (and `autoCapture.onCapture`) and consumed by the preview OK button.
let lastPreviewBlob: Blob | null = null;

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

// Simulates how the host app would receive the preview result.
async function emitPreviewResult(signal: 'ok' | 'retake', blob: Blob | null) {
  if (!blob) {
    // eslint-disable-next-line no-console
    console.warn('[alphavalid-demo] preview result (no blob)', { signal });
    return;
  }
  try {
    const base64 = await blobToBase64(blob);
    // eslint-disable-next-line no-console
    console.log('[alphavalid-demo] preview result', {
      signal,
      blob,
      bytes: blob.size,
      type: blob.type,
      base64
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[alphavalid-demo] preview result base64 failed', e);
    // eslint-disable-next-line no-console
    console.log('[alphavalid-demo] preview result (blob only)', { signal, blob });
  }
}

type ChallengeItem = { id: string; type: any; enabled: boolean };

const ALL_CHALLENGES: Array<{ type: any; label: string }> = [
  { type: 'lookLeft', label: 'Olhar p/ esquerda' },
  { type: 'lookRight', label: 'Olhar p/ direita' },
  { type: 'lookUp', label: 'Olhar p/ cima' },
  { type: 'lookDown', label: 'Olhar p/ baixo' },
  { type: 'zoomOut', label: 'Afaste-se da câmera' },
  { type: 'zoomIn', label: 'Aproxime-se da câmera' },
  { type: 'blink', label: 'Pisque' },
  { type: 'openMouth', label: 'Abra a boca' },
  { type: 'lookForward', label: 'Olhar p/ câmera' }
];

let challengeList: ChallengeItem[] = ALL_CHALLENGES.map((c) => ({ id: uid(), type: c.type, enabled: false }));

app.innerHTML = `
  <div class="page">
    <header class="topbar">
      <div class="headerStatus" aria-live="polite" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span id="hdrStatus" class="pill">idle</span>
          <span id="hdrReady" class="pill muted">not-ready</span>
          <span id="hdrFeedback" class="pill muted">-</span>
        </div>
        <div class="actions" style="display:flex; align-items:center; justify-content:flex-end;">
          <button id="btnPower" class="btnPower" aria-label="Ligar/Desligar" title="Ligar/Desligar" type="button">
            <span aria-hidden="true">⏻</span>
          </button>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="stage">
        <div id="cameraContainer" class="camera"></div>
      </section>

      <section class="panel" data-sheet-state="peek">
        <div class="panelBody">
          <div class="mobileSheetBar">
            <div class="mobileSheetHandle" aria-hidden="true"></div>
          </div>
          <div id="optionsPanel">
            <details class="details" open>
              <summary>Auto capture + preview</summary>
              <div class="grid">
                <label class="field checkbox">
                  <input id="inAutoCapture" type="checkbox" />
                  <span>autoCapture (captura quando ficar READY)</span>
                </label>
                <div class="previewWrap">
                  <img id="imgPreview" class="preview" alt="preview" style="display:none" />
                  <div id="previewMeta" class="hint" style="margin-top: 8px; display:none"></div>
                </div>
              </div>
            </details>

            <div style="margin: 16px 0 8px 0; font-weight: bold;">
              <label class="field checkbox" style="font-size: 1.1em;">
                <input id="inShowDebugTableCanvas" type="checkbox" style="transform: scale(1.2); margin-right: 8px;" />
                Exibir tabela de debug <b>dentro do overlay/canvas</b>
              </label>
            </div>
            <div id="debugPanelMount"></div>

            <details class="details" open>
              <summary>Config</summary>
              <div class="grid">
                <label class="field">
                  <span>modelsPath</span>
                  <input id="inModels" value="/alphavalid-models" />
                </label>
                <label class="field">
                  <span>guideCircleRatio</span>
                  <input id="inCircle" type="number" step="0.01" min="0.2" max="1" value="0.72" />
                </label>
                <label class="field">
                  <span>detectionIntervalMs</span>
                  <input id="inInterval" type="number" step="10" min="10" value="50" />
                </label>
                <label class="field checkbox">
                  <input id="inDraw" type="checkbox" checked />
                  <span>debug.drawLandmarks (master)</span>
                </label>
                <label class="field checkbox">
                  <input id="inDrawEyes" type="checkbox" checked />
                  <span>draw: eyes</span>
                </label>
                <label class="field checkbox">
                  <input id="inDrawMouth" type="checkbox" checked />
                  <span>draw: mouth</span>
                </label>
                <label class="field checkbox">
                  <input id="inDrawJaw" type="checkbox" checked />
                  <span>draw: jaw line</span>
                </label>
                <label class="field checkbox">
                  <input id="inDrawNose" type="checkbox" checked />
                  <span>draw: nose</span>
                </label>
                <label class="field checkbox">
                  <input id="inDrawMouthJaw" type="checkbox" checked />
                  <span>draw: mouth↔jaw (linhas)</span>
                </label>
                <label class="field checkbox">
                  <input id="inDbgCheese" type="checkbox" checked />
                  <span>debug panel: cheese (mostrar/ocultar métricas de sorriso)</span>
                </label>
                <label class="field checkbox">
                  <input id="inHeadless" type="checkbox" />
                  <span>uiMode: headless</span>
                </label>
                <label class="field">
                  <span>UI Mode</span>
                  <select id="inUiMode">
                    <option value="default">Default</option>
                    <option value="Mobile">Coxinha Mobile</option>
                    <option value="headless">Headless</option>
                  </select>
                </label>
              </div>
            </details>

            <details class="details" open>
              <summary>Liveness · knobs</summary>
              <div class="grid">
                <label class="field">
                  <span>strictness (0..1) <b>↑ mais difícil</b> · <b>↓ mais fácil</b></span>
                  <input id="inStrict" type="range" min="0" max="1" step="0.01" value="0.5" />
                  <input id="inStrictNum" type="number" min="0" max="1" step="0.01" value="0.5" />
                </label>

                <label class="field">
                  <span>lookForwardTolerance (0..1) <b>↑ mais fácil</b> · <b>↓ mais difícil</b></span>
                  <input id="inLfTol" type="range" min="0" max="1" step="0.01" value="0.75" />
                  <input id="inLfTolNum" type="number" min="0" max="1" step="0.01" value="0.75" />
                </label>

                <label class="field">
                  <span>lookSideNormThr (yaw) <b>↓ mais fácil</b> · <b>↑ mais difícil</b></span>
                  <input id="inYaw" type="range" min="0.02" max="0.12" step="0.005" value="0.05" />
                  <input id="inYawNum" type="number" min="0.02" max="0.12" step="0.005" value="0.05" />
                </label>

                <label class="field">
                  <span>blinkClosedThreshold <b>↑ mais fácil</b> · <b>↓ mais difícil</b></span>
                  <input id="inBlinkClosed" type="range" min="0.4" max="0.95" step="0.01" value="0.5" />
                  <input id="inBlinkClosedNum" type="number" min="0.4" max="0.95" step="0.01" value="0.5" />
                </label>

                <label class="field">
                  <span>blinkOpenThreshold <b>↓ mais fácil</b> · <b>↑ mais difícil</b></span>
                  <input id="inBlinkOpen" type="range" min="0.4" max="0.95" step="0.01" value="0.85" />
                  <input id="inBlinkOpenNum" type="number" min="0.4" max="0.95" step="0.01" value="0.85" />
                </label>

                <label class="field">
                  <span>challengeMinHoldMs <b>↓ mais fácil</b> · <b>↑ mais difícil</b></span>
                  <input id="inHold" type="number" min="0" step="50" value="150" />
                </label>

                <label class="field checkbox">
                  <input id="inReqLf" type="checkbox" checked />
                  <span>requireLookForward (desmarcar = mais fácil)</span>
                </label>

                <label class="field checkbox">
                  <input id="inMirror" type="checkbox" />
                  <span>mirrorMode: mirrored (swap left/right)</span>
                </label>

                <label class="field">
                  <span>poseProgressAccept (0..1) <b>↓ mais fácil</b> · <b>↑ mais difícil</b></span>
                  <input id="inPoseAccept" type="range" min="0.3" max="1" step="0.01" value="0.65" />
                  <input id="inPoseAcceptNum" type="number" min="0.3" max="1" step="0.01" value="0.65" />
                </label>
              </div>
            </details>

            <details class="details" open>
              <summary>Challenges (checkbox + reorder)</summary>
              <div id="chList" class="grid"></div>
              <div class="hint">Marque os passos. Use ↑/↓ para reordenar. (O SDK executa na ordem listada)</div>
            </details>

            <div class="hint">
              Debug extra: veja blinkCount no painel e os valores left/rightEyeOpenProb.
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
`;

const el = {
  btnPower: document.querySelector<HTMLButtonElement>('#btnPower')!,

  hdrStatus: document.querySelector<HTMLSpanElement>('#hdrStatus')!,
  hdrReady: document.querySelector<HTMLSpanElement>('#hdrReady')!,
  hdrFeedback: document.querySelector<HTMLSpanElement>('#hdrFeedback')!,

  mobileSheetBar: document.querySelector<HTMLDivElement>('.mobileSheetBar')!,
  mobileSheetHandle: document.querySelector<HTMLDivElement>('.mobileSheetHandle')!,

  cameraContainer: document.querySelector<HTMLDivElement>('#cameraContainer')!,
  panel: document.querySelector<HTMLElement>('.panel')!,

  stStatus: document.querySelector<HTMLSpanElement>('#stStatus'),
  stReady: document.querySelector<HTMLSpanElement>('#stReady'),
  stFeedback: document.querySelector<HTMLSpanElement>('#stFeedback'),
  stChallenge: document.querySelector<HTMLSpanElement>('#stChallenge'),
  stHistory: document.querySelector<HTMLDivElement>('#stHistory')!,

  inModels: document.querySelector<HTMLInputElement>('#inModels')!,
  inCircle: document.querySelector<HTMLInputElement>('#inCircle')!,
  inInterval: document.querySelector<HTMLInputElement>('#inInterval')!,
  inDraw: document.getElementById('inDraw') as HTMLInputElement,
  inDrawEyes: document.getElementById('inDrawEyes') as HTMLInputElement,
  inDrawMouth: document.getElementById('inDrawMouth') as HTMLInputElement,
  inDrawJaw: document.getElementById('inDrawJaw') as HTMLInputElement,
  inDrawNose: document.getElementById('inDrawNose') as HTMLInputElement,
  inDrawMouthJaw: document.getElementById('inDrawMouthJaw') as HTMLInputElement,
  inDbgCheese: document.getElementById('inDbgCheese') as HTMLInputElement,
  inHeadless: document.querySelector<HTMLInputElement>('#inHeadless')!,

  inStrict: document.querySelector<HTMLInputElement>('#inStrict')!,
  inStrictNum: document.querySelector<HTMLInputElement>('#inStrictNum')!,
  inLfTol: document.querySelector<HTMLInputElement>('#inLfTol')!,
  inLfTolNum: document.querySelector<HTMLInputElement>('#inLfTolNum')!,

  inYaw: document.querySelector<HTMLInputElement>('#inYaw')!,
  inYawNum: document.querySelector<HTMLInputElement>('#inYawNum')!,

  inBlinkClosed: document.querySelector<HTMLInputElement>('#inBlinkClosed')!,
  inBlinkClosedNum: document.querySelector<HTMLInputElement>('#inBlinkClosedNum')!,
  inBlinkOpen: document.querySelector<HTMLInputElement>('#inBlinkOpen')!,
  inBlinkOpenNum: document.querySelector<HTMLInputElement>('#inBlinkOpenNum')!,

  inHold: document.querySelector<HTMLInputElement>('#inHold')!,

  inReqLf: document.querySelector<HTMLInputElement>('#inReqLf')!,
  inMirror: document.querySelector<HTMLInputElement>('#inMirror')!,

  chList: document.querySelector<HTMLDivElement>('#chList')!,

  inAutoCapture: document.querySelector<HTMLInputElement>('#inAutoCapture')!,
  imgPreview: document.querySelector<HTMLImageElement>('#imgPreview')!,
  previewMeta: document.querySelector<HTMLDivElement>('#previewMeta')!,

  inPoseAccept: document.querySelector<HTMLInputElement>('#inPoseAccept')!,
  inPoseAcceptNum: document.querySelector<HTMLInputElement>('#inPoseAcceptNum')!,

  inUiMode: document.querySelector<HTMLSelectElement>('#inUiMode')!,

  loaderOverlay: document.getElementById('loader-overlay'),

  inShowDebugPanel: document.getElementById('inShowDebugPanel') as HTMLInputElement,
  debugPanel: document.getElementById('debugPanel') as HTMLDivElement,
  inShowDebugTable: document.getElementById('inShowDebugTable') as HTMLInputElement,
  inShowDebugTableCanvas: document.getElementById('inShowDebugTableCanvas') as HTMLInputElement,
};

// Defaults aligned with SDK (see src/index.ts and src/types/sdk.ts)
const SDK_DEFAULTS = {
  modelsPath: '/alphavalid-models',
  guideCircleRatio: 0.72,
  detectionIntervalMs: 50,
  uiMode: 'Mobile' as 'default' | 'headless' | 'Mobile',
  overlay: true,
  drawLandmarks: true,

  // Liveness (these are demo defaults aligned with current SDK defaults/behavior)
  strictness: 0.5,
  lookForwardTolerance: 0.75,
  requireLookForward: false,
  lookSideTol: 0.05,
  blinkClosedThreshold: 0.5, // mais sensível
  blinkOpenThreshold: 0.85, // mais sensível
  challengeMinHoldMs: 150,
  mirrorMode: 'mirrored' as const,
  poseProgressAccept: 0.65
};

// Force initial UI values to match SDK defaults (so the demo panel always starts "standard").
function applyDefaultsToUi() {
  el.inModels.value = SDK_DEFAULTS.modelsPath;
  el.inCircle.value = String(SDK_DEFAULTS.guideCircleRatio);
  el.inInterval.value = String(SDK_DEFAULTS.detectionIntervalMs);
  // Desabilitar todos os checkboxes de debug por padrão
  el.inDraw.checked = false;
  el.inDrawEyes.checked = false;
  el.inDrawMouth.checked = false;
  el.inDrawJaw.checked = false;
  el.inDrawNose.checked = false;
  el.inDrawMouthJaw.checked = false;
  el.inDbgCheese.checked = false;
  el.inHeadless.checked = SDK_DEFAULTS.uiMode === 'headless';

  el.inStrict.value = String(SDK_DEFAULTS.strictness);
  el.inStrictNum.value = String(SDK_DEFAULTS.strictness);
  el.inLfTol.value = String(SDK_DEFAULTS.lookForwardTolerance);
  el.inLfTolNum.value = String(SDK_DEFAULTS.lookForwardTolerance);

  el.inYaw.value = String(SDK_DEFAULTS.lookSideTol);
  el.inYawNum.value = String(SDK_DEFAULTS.lookSideTol);

  el.inBlinkClosed.value = String(SDK_DEFAULTS.blinkClosedThreshold);
  el.inBlinkClosedNum.value = String(SDK_DEFAULTS.blinkClosedThreshold);
  el.inBlinkOpen.value = String(SDK_DEFAULTS.blinkOpenThreshold);
  el.inBlinkOpenNum.value = String(SDK_DEFAULTS.blinkOpenThreshold);

  el.inHold.value = String(SDK_DEFAULTS.challengeMinHoldMs);
  el.inReqLf.checked = SDK_DEFAULTS.requireLookForward;
  el.inMirror.checked = SDK_DEFAULTS.mirrorMode === 'mirrored';

  el.inPoseAccept.value = String(SDK_DEFAULTS.poseProgressAccept);
  el.inPoseAcceptNum.value = String(SDK_DEFAULTS.poseProgressAccept);

  el.inUiMode.value = SDK_DEFAULTS.uiMode;

  // Habilitar todos os challenges por padrão
  challengeList.forEach((c) => { c.enabled = true; });
  renderChallengeList();
}

applyDefaultsToUi();

// Keep demo UI aligned with SDK default.
// SDK default is mirrorMode: 'mirrored', so checkbox should start checked.
el.inMirror.checked = true;

function linkRangeNumber(range: HTMLInputElement, num: HTMLInputElement, min: number, max: number) {
  const syncFromRange = () => {
    num.value = range.value;
  };
  const syncFromNum = () => {
    const v = clamp(Number(num.value), min, max);
    num.value = String(v);
    range.value = String(v);
  };
  range.addEventListener('input', syncFromRange);
  num.addEventListener('input', syncFromNum);
  syncFromRange();
}

linkRangeNumber(el.inStrict, el.inStrictNum, 0, 1);
linkRangeNumber(el.inLfTol, el.inLfTolNum, 0, 1);
linkRangeNumber(el.inYaw, el.inYawNum, 0.02, 0.12);
linkRangeNumber(el.inBlinkClosed, el.inBlinkClosedNum, 0.4, 0.95);
linkRangeNumber(el.inBlinkOpen, el.inBlinkOpenNum, 0.4, 0.95);
linkRangeNumber(el.inPoseAccept, el.inPoseAcceptNum, 0.3, 1);

function renderChallengeList() {
  el.chList.innerHTML = '';
  const labels = new Map(ALL_CHALLENGES.map((c) => [c.type, c.label] as const));

  challengeList.forEach((it, idx) => {
    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '10px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = it.enabled;
    cb.addEventListener('change', () => {
      it.enabled = cb.checked;
    });

    const label = document.createElement('div');
    label.textContent = labels.get(it.type) ?? String(it.type);

    left.appendChild(cb);
    left.appendChild(label);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';

    const up = document.createElement('button');
    up.className = 'btn';
    up.textContent = '↑';
    up.disabled = idx === 0;
    up.addEventListener('click', () => {
      if (idx === 0) return;
      const a = challengeList[idx - 1];
      challengeList[idx - 1] = challengeList[idx];
      challengeList[idx] = a;
      renderChallengeList();
    });

    const down = document.createElement('button');
    down.className = 'btn';
    down.textContent = '↓';
    down.disabled = idx === challengeList.length - 1;
    down.addEventListener('click', () => {
      if (idx >= challengeList.length - 1) return;
      const a = challengeList[idx + 1];
      challengeList[idx + 1] = challengeList[idx];
      challengeList[idx] = a;
      renderChallengeList();
    });

    right.appendChild(up);
    right.appendChild(down);

    row.appendChild(left);
    row.appendChild(right);
    el.chList.appendChild(row);
  });
}

renderChallengeList();

let sdk: AlphaValid;
const feedbackHistory: string[] = [];

let isRunning = false;
let restartTimer: number | null = null;

// Auto-capture lock (avoid repeated captures)
let autoCaptureLock = false;

// NEW: in-camera preview UI moved to the SDK (userPreview mode).
// Keep only the file/blob references for logging in this demo.
let lastPreviewUrl: string | null = null;

// Remove demo-managed in-camera preview overlay helpers (SDK handles it when userPreview=true).
// - resetSdkFromPreview
// - closePreviewFromPreview
// - ensureInCameraPreviewElements
// - setInCameraPreview

function clearPreview() {
  if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
  lastPreviewUrl = null;
  lastPreviewBlob = null;
  el.imgPreview.removeAttribute('src');
  el.previewMeta.textContent = '';
}

async function doStop() {
  if (restartTimer != null) {
    window.clearTimeout(restartTimer);
    restartTimer = null;
  }
  await sdk.stop();
  isRunning = false;
  applyPowerButtonUi(false);
  setText(el.stStatus, 'idle');
  setText(el.stReady, 'false');
  setText(el.stFeedback, '-');
  setText(el.stChallenge, '-');
  autoCaptureLock = false;
  clearPreview();
}

function scheduleRestart() {
  if (!isRunning) return;
  if (restartTimer != null) window.clearTimeout(restartTimer);
  restartTimer = window.setTimeout(() => {
    restartTimer = null;
    void doStart(true);
  }, 450);
}

function wireLive(elm: HTMLElement, eventName: string = 'input') {
  elm.addEventListener(eventName as any, () => scheduleRestart());
}

// Wire all knobs/checkboxes to live restart
[
  el.inModels,
  el.inCircle,
  el.inInterval,
  el.inDraw,
  el.inDrawEyes,
  el.inDrawMouth,
  el.inDrawJaw,
  el.inDrawNose,
  el.inDrawMouthJaw,
  el.inDbgCheese,
  el.inHeadless,
  el.inStrict,
  el.inStrictNum,
  el.inLfTol,
  el.inLfTolNum,
  el.inYaw,
  el.inYawNum,
  el.inBlinkClosed,
  el.inBlinkClosedNum,
  el.inBlinkOpen,
  el.inBlinkOpenNum,
  el.inHold,
  el.inReqLf,
  el.inMirror,
  el.inAutoCapture,
  el.inPoseAccept,
  el.inPoseAcceptNum,
  el.inUiMode
].forEach((n) => wireLive(n));

// Reorder/checkbox list: schedule restart after clicks
el.chList.addEventListener('click', () => scheduleRestart());
el.chList.addEventListener('change', () => scheduleRestart());

// Garante que qualquer checkbox de debug reinicia o SDK e propaga as flags
[
  el.inDraw,
  el.inDrawEyes,
  el.inDrawMouth,
  el.inDrawJaw,
  el.inDrawNose,
  el.inDrawMouthJaw,
  el.inDbgCheese
].forEach((n) => n.addEventListener('change', () => scheduleRestart()));
el.inUiMode.addEventListener('change', () => scheduleRestart());

let loaderMutationObserver: MutationObserver | null = null;
let readyToShowCamera = false;
let loaderTimeout: number | null = null;
let pendingVideoNode: Node | null = null;

function createFakeOverlay() {
  // Cria um canvas ou div com a mesma classe do overlay real
  const fake = document.createElement('div');
  fake.className = 'alphavalid-overlay';
  fake.style.position = 'absolute';
  fake.style.top = '0';
  fake.style.left = '0';
  fake.style.width = '100%';
  fake.style.height = '100%';
  fake.style.pointerEvents = 'none';
  fake.style.background = 'transparent';
  fake.style.zIndex = '10';
  return fake;
}

function ensureOverlayBeforeVideo() {
  const overlay = Array.from(el.cameraContainer.children).find(
    el => el.classList.contains('alphavalid-overlay') || el.classList.contains('alphavalid-overlay-coxinha')
  );
  const video = Array.from(el.cameraContainer.children).find(
    el => el.tagName === 'VIDEO'
  );
  if (overlay && video && overlay.nextSibling !== video) {
    el.cameraContainer.insertBefore(overlay, video);
  }
  return { overlay, video };
}

let loaderShownAt = 0;
let loaderMinTimeTimeout: number | null = null;
let loaderReadyToHide = false;

function tryHideLoaderAfterMinTime() {
  const elapsed = Date.now() - loaderShownAt;
  if (elapsed >= 1000) {
    hideLoader();
  } else {
    if (loaderMinTimeTimeout) clearTimeout(loaderMinTimeTimeout);
    loaderMinTimeTimeout = window.setTimeout(() => {
      hideLoader();
    }, 1000 - elapsed);
  }
}

function showLoader() {
  readyToShowCamera = false;
  loaderReadyToHide = false;
  loaderShownAt = Date.now();
  if (loaderTimeout) {
    clearTimeout(loaderTimeout);
    loaderTimeout = null;
  }
  if (loaderMinTimeTimeout) {
    clearTimeout(loaderMinTimeTimeout);
    loaderMinTimeTimeout = null;
  }
  pendingVideoNode = null;
  // Garante overlay fake antes de qualquer vídeo
  if (!el.cameraContainer.querySelector('#fake-overlay')) {
    el.cameraContainer.appendChild(createFakeOverlay());
  }
  let loader = el.cameraContainer.querySelector('#camera-loader') as HTMLElement | null;
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'camera-loader';
    loader.style.position = 'absolute';
    loader.style.top = '0';
    loader.style.left = '0';
    loader.style.width = '100%';
    loader.style.height = '100%';
    loader.style.background = 'transparent';
    loader.style.display = 'flex';
    loader.style.alignItems = 'center';
    loader.style.justifyContent = 'center';
    loader.style.zIndex = '999';
    loader.innerHTML = '<img src="/images/alphaloader.gif" alt="Carregando..." style="width:120px;height:120px;">';
    el.cameraContainer.style.position = 'relative';
    el.cameraContainer.appendChild(loader);
  } else {
    loader.style.display = 'flex';
  }
  // Esconde todos os filhos do cameraContainer (exceto o loader)
  Array.from(el.cameraContainer.children).forEach(child => {
    if (child !== loader) (child as HTMLElement).style.visibility = 'hidden';
  });

  // Ativa MutationObserver para garantir ordem e exibição correta
  if (loaderMutationObserver) loaderMutationObserver.disconnect();
  loaderMutationObserver = new MutationObserver(() => {
    let overlayReal = Array.from(el.cameraContainer.children).find(
      el => (el.classList.contains('alphavalid-overlay') || el.classList.contains('alphavalid-overlay-coxinha')) && el.id !== 'fake-overlay'
    );
    let overlayFake = el.cameraContainer.querySelector('#fake-overlay');
    let video = Array.from(el.cameraContainer.children).find(
      el => el.tagName === 'VIDEO'
    );
    // Garante overlay (fake ou real) antes do vídeo
    let overlayToUse = overlayReal || overlayFake;
    if (overlayToUse && video && overlayToUse.nextSibling !== video) {
      el.cameraContainer.insertBefore(overlayToUse, video);
    }
    // NOVO: só remove overlay fake se overlay real JÁ está no DOM E vídeo está pronto para ser exibido
    if (overlayReal && overlayFake && video) {
      overlayFake.remove();
      if (readyToShowCamera) {
        loaderReadyToHide = true;
        tryHideLoaderAfterMinTime();
      }
      return;
    }
    Array.from(el.cameraContainer.children).forEach(child => {
      if (child !== loader) (child as HTMLElement).style.visibility = 'hidden';
    });
    if (readyToShowCamera && video && (overlayReal || overlayFake)) {
      loaderReadyToHide = true;
      tryHideLoaderAfterMinTime();
    }
  });
  loaderMutationObserver.observe(el.cameraContainer, { childList: true, subtree: false });
}

function hideLoader() {
  const loader = el.cameraContainer.querySelector('#camera-loader') as HTMLElement | null;
  if (loader) loader.remove();
  Array.from(el.cameraContainer.children).forEach(child => {
    (child as HTMLElement).style.visibility = 'visible';
  });
  ensureOverlayBeforeVideo();
  if (loaderMutationObserver) {
    loaderMutationObserver.disconnect();
    loaderMutationObserver = null;
  }
  if (loaderTimeout) {
    clearTimeout(loaderTimeout);
    loaderTimeout = null;
  }
  if (loaderMinTimeTimeout) {
    clearTimeout(loaderMinTimeTimeout);
    loaderMinTimeTimeout = null;
  }
  pendingVideoNode = null;
}

async function doStart(isRestart = false) {
  // garante container limpo
  el.cameraContainer.innerHTML = '';

  if (isRestart && sdk) {
    await sdk.stop();
  } else {
    feedbackHistory.length = 0;
    if (el.stHistory) el.stHistory.textContent = '';
  }

  const strictness = Number(el.inStrictNum.value);
  const lookForwardTolerance = Number(el.inLfTolNum.value);
  const requireLookForward = el.inReqLf.checked;

  const lookSideNormThr = Number(el.inYawNum.value);

  const blinkClosedThreshold = Number(el.inBlinkClosedNum.value);
  const blinkOpenThreshold = Number(el.inBlinkOpenNum.value);

  const challengeMinHoldMs = Number(el.inHold.value);
  const mirrorMode = el.inMirror.checked ? 'mirrored' : 'raw';
  const poseProgressAccept = Number(el.inPoseAcceptNum.value);

  const challenges = challengeList
    .filter((c) => c.enabled)
    .map((c) => ({ type: c.type }));

  autoCaptureLock = false;
  if (!isRestart) clearPreview();

  showLoader(); // Mostra loader só na câmera
  const loaderShownAt = Date.now();

  if (!sdk) sdk = new AlphaValid();
  await sdk.start({
    container: el.cameraContainer,
    modelsPath: el.inModels.value,
    guideCircleRatio: Number(el.inCircle.value),
    detectionIntervalMs: Number(el.inInterval.value),
    uiMode: el.inUiMode.value as 'default' | 'headless' | 'Mobile',

    // NEW: easy-mode preview managed by the SDK (only effective in uiMode: 'Mobile')
    userPreview: true,

    // When user confirms OK in SDK preview UI
    onUserPreviewConfirm: (blob) => {
      lastPreviewBlob = blob;
      void emitPreviewResult('ok', blob);

      if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
      lastPreviewUrl = URL.createObjectURL(blob);
      el.imgPreview.src = lastPreviewUrl;
      el.previewMeta.textContent = `confirmed: ${(blob.size / 1024).toFixed(1)} KB · ${new Date().toLocaleTimeString()}`;
    },

    debug: {
      drawLandmarks: el.inDraw?.checked ?? false,
      draw: el.inDraw?.checked
        ? { eyes: true, mouth: true, nose: true, jaw: true, mouthJaw: true, cheese: true }
        : {
            eyes: el.inDrawEyes?.checked ?? false,
            mouth: el.inDrawMouth?.checked ?? false,
            jaw: el.inDrawJaw?.checked ?? false,
            nose: el.inDrawNose?.checked ?? false,
            mouthJaw: (el.inDrawMouthJaw?.checked ?? false) || (el.inDbgCheese?.checked ?? false),
            cheese: el.inDbgCheese?.checked ?? false
          },
      extra: {
        showOverlayTable: el.inShowDebugTable && el.inShowDebugTable.checked,
        showOverlayTableCanvas: el.inShowDebugTableCanvas && el.inShowDebugTableCanvas.checked
      }
    },
    autoCapture: {
      enabled: el.inAutoCapture.checked,
      stableMs: 650,
      holdStillMessage: 'Não se mova...',
      onCapture: (blob) => {
        // In userPreview mode, this callback is NOT used for the final confirmation;
        // it may still be useful for logging raw capture events.
        try {
          lastPreviewBlob = blob;
          if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
          lastPreviewUrl = URL.createObjectURL(blob);
          el.imgPreview.src = lastPreviewUrl;
          el.previewMeta.textContent = `captured: ${(blob.size / 1024).toFixed(1)} KB · ${new Date().toLocaleTimeString()}`;
        } catch (e) {
          console.error('[alphavalid-sdk demo] onCapture failed', e);
        }
      }
    },

    // Keep onPreview only for the case userPreview:false (custom UI handled by the host).
    onPreview: (blob, actions) => {
      try {
        lastPreviewBlob = blob;
        if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
        lastPreviewUrl = URL.createObjectURL(blob);
        el.imgPreview.src = lastPreviewUrl;
        el.previewMeta.textContent = `preview: ${(blob.size / 1024).toFixed(1)} KB · ${new Date().toLocaleTimeString()}`;

        // Demo: auto-confirm when preview is shown (custom flow example)
        // actions.confirm();

        // Ensure manual capture button never shows on preview
        updateManualCaptureButton({ status: 'preview', isReadyToCapture: false, challenge: { completed: false } });
      } catch (e) {
        console.error('[alphavalid-sdk demo] onPreview failed', e);
      }
    },

    liveness: {
      strictness,
      lookForwardTolerance,
      requireLookForward,
      lookSideTol: lookSideNormThr,
      mirrorMode,
      blinkClosedThreshold,
      blinkOpenThreshold,
      challengeMinHoldMs,
      poseProgressAccept,
      challenges: challenges.length > 0 ? challenges : undefined
    },
    onStateChange: onSdkStateChange,
    onError: (err: any) => {
      console.error('[alphavalid-sdk demo] error', err);
      isRunning = false;
    },
    onReady: async () => {
      console.log('[alphavalid-demo] SDK onReady (câmera pronta)');
      readyToShowCamera = true;
      // Só libera se overlay e vídeo já existem (MutationObserver cuida disso)
      const result = ensureOverlayBeforeVideo();
      const overlay = result.overlay;
      const video = result.video;
      if (video && overlay) {
        loaderReadyToHide = true;
        tryHideLoaderAfterMinTime();
      } else if (video && !overlay) {
        // Timeout de segurança: se overlay não aparecer em 1s, libera mesmo assim
        loaderTimeout = window.setTimeout(() => {
          const fake = el.cameraContainer.querySelector('#fake-overlay');
          if (fake) fake.remove();
          console.warn('[alphavalid-sdk demo] Overlay não encontrado após 1s do onReady. Exibindo câmera mesmo assim.');
          loaderReadyToHide = true;
          tryHideLoaderAfterMinTime();
        }, 1000);
      }
      // Senão, o observer vai liberar assim que ambos existirem
    }
    // Fim do objeto de opções do sdk.start
  });
  isRunning = true;
  applyPowerButtonUi(true);
}

function applyPowerButtonUi(running: boolean) {
  if (!el?.btnPower) return;
  el.btnPower.setAttribute('aria-pressed', running ? 'true' : 'false');
  el.btnPower.classList.toggle('isOn', running);
  el.btnPower.classList.toggle('isOff', !running);
}

// estilo inline mínimo pro botão power (sem depender do CSS externo)
(function injectPowerButtonCss() {
  const id = 'alphavalid-demo-power-css';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .btnPower {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      font-size: 18px;
      line-height: 1;
    }
    .btnPower:hover { transform: translateY(-1px); }
    .btnPower:active { transform: translateY(0px) scale(0.98); }
    .btnPower:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0,188,212,0.35), 0 6px 18px rgba(0,0,0,0.25);
      border-color: rgba(0,188,212,0.55);
    }
    .btnPower.isOn {
      background: rgba(0,188,212,0.20);
      border-color: rgba(0,188,212,0.65);
      box-shadow: 0 0 0 2px rgba(0,188,212,0.15), 0 8px 22px rgba(0,0,0,0.28);
    }
    .btnPower.isOff {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.15);
    }
  `;
  document.head.appendChild(style);
})();

// estado inicial do botão
applyPowerButtonUi(false);

el.btnPower.addEventListener('click', () => {
  if (isRunning) {
    void doStop();
  } else {
    void doStart(false);
  }
});


// Renderiza dinamicamente a tabela de debug conforme checkbox
function renderDebugPanel() {
  const mount = document.getElementById('debugPanelMount');
  if (!mount) return;
  mount.innerHTML = '';
  if (!el.inShowDebugTable.checked) return;
  const panel = document.createElement('div');
  panel.id = 'debugPanel';
  panel.innerHTML = `
    <div style="display: flex; gap: 16px; margin-bottom: 8px;">
      <span id="stStatus" class="hint"></span>
      <span id="stReady" class="hint"></span>
      <span id="stFeedback" class="hint"></span>
      <span id="stChallenge" class="hint"></span>
    </div>
    <details class="details" open>
      <summary>Histórico (últimos 12)</summary>
      <div id="stHistory" class="hint" style="white-space: pre-wrap"></div>
    </details>
  `;
  mount.appendChild(panel);
  // Re-wire os elementos do painel
  el.stStatus = document.getElementById('stStatus') as HTMLSpanElement | null;
  el.stReady = document.getElementById('stReady') as HTMLSpanElement | null;
  el.stFeedback = document.getElementById('stFeedback') as HTMLSpanElement | null;
  el.stChallenge = document.getElementById('stChallenge') as HTMLSpanElement | null;
  const stHistoryElem = document.getElementById('stHistory');
  if (!stHistoryElem) throw new Error('stHistory element not found');
  el.stHistory = stHistoryElem as HTMLDivElement;
}

el.inShowDebugTable = document.getElementById('inShowDebugTable') as HTMLInputElement;
el.inShowDebugTable.addEventListener('change', renderDebugPanel);
renderDebugPanel();

// Remove overlays/canvas de debug do DOM se drawLandmarks master estiver desmarcado
function removeDebugOverlays() {
  // Remove overlays/canvas de debug conhecidos
  const overlays = el.cameraContainer.querySelectorAll('.alphavalid-overlay, .alphavalid-overlay-coxinha, canvas');
  overlays.forEach((node) => {
    // Só removes se não for o overlay fake
    if (!(node as HTMLElement).id || (node as HTMLElement).id !== 'fake-overlay') {
      node.remove();
    }
  });
}

el.inDraw.addEventListener('change', () => {
  if (!el.inDraw.checked) {
    removeDebugOverlays();
  }
});

const hmr = (import.meta as any).hot as undefined | { dispose: (cb: () => void) => void };
if (hmr) {
  hmr.dispose(() => {
    void doStop();
  });
}

function setText(node: HTMLElement | null, v: string) {
  if (node) node.textContent = v;
}

// Variável para cor do botão de captura manual
const captureButtonColor = '#00bcd4'; // Altere aqui para customizar a cor

function showManualCaptureButton(show: boolean) {
  console.log('[alphavalid-demo] showManualCaptureButton called, show =', show);
  let btn = document.getElementById('manual-capture-btn') as HTMLButtonElement | null;
  if (show) {
    if (!btn) {
      console.log('[alphavalid-demo] Criando botão manual de captura');
      btn = document.createElement('button');
      btn.id = 'manual-capture-btn';
      btn.textContent = 'Capturar imagem';
      btn.style.position = 'absolute';
      btn.style.bottom = '32px';
      btn.style.left = '50%';
      btn.style.transform = 'translateX(-50%)';
      btn.style.width = '90vw';
      btn.style.maxWidth = '340px';
      btn.style.height = '64px';
      btn.style.borderRadius = '18px';
      btn.style.background = captureButtonColor;
      btn.style.color = '#fff';
      btn.style.fontWeight = 'bold';
      btn.style.fontSize = '1.2em';
      btn.style.border = 'none';
      btn.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
      btn.style.cursor = 'pointer';
      btn.style.zIndex = '100'; // garantir sobreposição
      btn.style.display = 'block';
      btn.style.pointerEvents = 'auto';
      btn.addEventListener('click', async () => {
        // Defensive: do not allow manual capture outside a running/ready session
        const st = typeof sdk?.getState === 'function' ? sdk.getState() : undefined;
        if (!st || st.status !== 'ready' || st.isReadyToCapture !== true) return;

        if (sdk && typeof sdk.capture === 'function') {
          try {
            const blob = await sdk.capture();
            // In userPreview mode, SDK will show preview UI and only confirm via onUserPreviewConfirm.
            // We still update the small preview panel with the raw blob for debugging.
            if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
            lastPreviewUrl = URL.createObjectURL(blob);
            el.imgPreview.src = lastPreviewUrl;
            el.previewMeta.textContent = `captured: ${(blob.size / 1024).toFixed(1)} KB · ${new Date().toLocaleTimeString()}`;
          } catch (e) {
            alert('Erro ao capturar imagem: ' + (e && (e as any).message ? (e as any).message : e));
          }
        }
      });
      el.cameraContainer.style.position = 'relative'; // garantir contexto de posicionamento
      el.cameraContainer.appendChild(btn);
    } else {
      console.log('[alphavalid-demo] Exibindo botão manual de captura existente');
      btn.style.display = 'block';
    }
  } else if (btn) {
    console.log('[alphavalid-demo] Escondendo botão manual de captura');
    btn.style.display = 'none';
  }
}

// Exibe botão manual só se autocapture estiver desabilitado e SDK está no estado READY
// IMPORTANTE: `state.status` no SDK é 'ready' (minúsculo). O sinal correto é `state.isReadyToCapture`.
function updateManualCaptureButton(state?: any) {
  const autoCaptureOff = !el.inAutoCapture.checked;
  const sdkState = state || (typeof sdk?.getState === 'function' ? sdk.getState() : undefined);

  // Never show manual capture while not actively running (e.g. preview/paused/stopped)
  const isSdkRunning = sdkState?.status === 'running' || sdkState?.status === 'ready';

  const allChallengesCompleted = sdkState?.challenge && sdkState.challenge.enabled && (sdkState.challenge.total ?? 0)
    ? sdkState.challenge.completed === true
    : true;

  const isReadyToCapture = sdkState?.isReadyToCapture === true;
  const shouldShow = isSdkRunning && autoCaptureOff && isReadyToCapture && allChallengesCompleted;

  console.log('[alphavalid-demo] updateManualCaptureButton', {
    autoCaptureOff,
    status: sdkState?.status,
    isReadyToCapture,
    challenge: sdkState?.challenge,
    allChallengesCompleted,
    shouldShow
  });

  showManualCaptureButton(shouldShow);
}

// Atualiza visibilidade do botão sempre que autocapture mudar
el.inAutoCapture.addEventListener('change', () => {
  updateManualCaptureButton(typeof sdk?.getState === 'function' ? sdk.getState() : undefined);
});

// Hook para feedback do SDK (onStateChange)
let lastManualButtonState = false;
function onSdkStateChange(state) {
  isRunning = state.status !== 'idle' && state.status !== 'error';
  // mantém UI do botão em sync (ex: se der erro/idle)
  applyPowerButtonUi(isRunning);

  // Header pills (sempre visíveis)
  if (el.hdrStatus) {
    el.hdrStatus.textContent = state.status;
    el.hdrStatus.classList.toggle('ok', state.status === 'ready');
    el.hdrStatus.classList.toggle('warn', state.status === 'detecting');
    el.hdrStatus.classList.toggle('bad', state.status === 'error');
  }
  if (el.hdrReady) {
    el.hdrReady.textContent = state.isReadyToCapture ? 'READY' : '...';
    el.hdrReady.classList.toggle('ok', !!state.isReadyToCapture);
    el.hdrReady.classList.toggle('muted', !state.isReadyToCapture);
  }
  if (el.hdrFeedback) {
    el.hdrFeedback.textContent = state.feedback?.code ?? '-';
    el.hdrFeedback.classList.toggle('muted', !state.feedback?.code);
  }

  const hasChallenges = !!state.challenge?.enabled && (state.challenge?.total ?? 0) > 0;
  // botão de reset removido do header; não exibir nada aqui

  const line = `${new Date().toLocaleTimeString()}  ${state.feedback.code}  ${state.feedback.message}`;
  if (feedbackHistory.length === 0 || !feedbackHistory[feedbackHistory.length - 1]?.includes(state.feedback.code)) {
    feedbackHistory.push(line);
    if (feedbackHistory.length > 12) feedbackHistory.shift();
    if (el.stHistory) el.stHistory.textContent = feedbackHistory.join('\n');
  }

  // Botão manual: só quando autocapture OFF + pronto para capturar + desafios concluídos (se existirem)
  const autoCaptureOff = !el.inAutoCapture.checked;
  const allChallengesCompleted = state?.challenge && state.challenge.enabled && (state.challenge.total ?? 0) > 0
    ? state.challenge.completed === true
    : true;
  const isReadyToCapture = state?.isReadyToCapture === true;

  const shouldShowManual = autoCaptureOff && isReadyToCapture && allChallengesCompleted;
  if (shouldShowManual !== lastManualButtonState) {
    updateManualCaptureButton(state);
    lastManualButtonState = shouldShowManual;
  }
}

// Ajuste de UX no celular: manter só o essencial aberto por padrão.
(function applyMobileDetailsDefaults() {
  const isMobile = window.matchMedia('(max-width: 600px)').matches;
  if (!isMobile) return;
  const detailEls = Array.from(document.querySelectorAll<HTMLDetailsElement>('details.details'));
  // Mantém o primeiro (Auto capture + preview) aberto; fecha os demais.
  detailEls.forEach((d, idx) => {
    d.open = idx === 0;
  });
})();

// Mobile: controle de abrir/fechar painel de opções
function isMobile() {
  return window.matchMedia('(max-width: 600px)').matches;
}

function setSheetState(state: 'peek' | 'open' | 'collapsed') {
  if (!el.panel) return;
  el.panel.setAttribute('data-sheet-state', state);
}

function getSheetState(): 'peek' | 'open' | 'collapsed' {
  const cur = (el.panel?.getAttribute('data-sheet-state') as any) || 'peek';
  if (cur === 'open' || cur === 'collapsed' || cur === 'peek') return cur;
  return 'peek';
}

// Mobile: arrastar o painel (sheet) no modo celular
(() => {
  let dragging = false;
  let startY = 0;
  let startOffsetPx = 0;
  let currentOffsetPx = 0;

  const H_PEEK = 280;
  const H_COLLAPSED = 56;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const getPanelHeight = () => el.panel?.getBoundingClientRect().height ?? 0;

  const offsetForState = (state: 'open' | 'peek' | 'collapsed') => {
    const h = getPanelHeight();
    if (!h) return 0;
    if (state === 'open') return 0;
    if (state === 'peek') return Math.max(0, h - H_PEEK);
    return Math.max(0, h - H_COLLAPSED);
  };

  const applyOffset = (px: number) => {
    currentOffsetPx = px;
    el.panel.style.transition = 'none';
    el.panel.style.transform = `translateY(${px}px)`;
  };

  const clearInlineTransform = () => {
    el.panel.style.transition = '';
    el.panel.style.transform = '';
  };

  const snap = () => {
    const h = getPanelHeight();
    if (!h) return;

    const openOffset = 0;
    const peekOffset = Math.max(0, h - H_PEEK);
    const collapsedOffset = Math.max(0, h - H_COLLAPSED);

    const candidates: Array<{ state: 'open' | 'peek' | 'collapsed'; offset: number }> = [
      { state: 'open', offset: openOffset },
      { state: 'peek', offset: peekOffset },
      { state: 'collapsed', offset: collapsedOffset }
    ];

    candidates.sort((a, b) => Math.abs(a.offset - currentOffsetPx) - Math.abs(b.offset - currentOffsetPx));
    const winner = candidates[0];

    el.panel.style.transition = 'transform 180ms ease';
    setSheetState(winner.state);
    requestAnimationFrame(() => {
      clearInlineTransform();
    });
  };

  const onPointerDown = (ev: PointerEvent) => {
    if (!isMobile()) return;
    if (!(ev.target instanceof Element)) return;
    if (!ev.target.closest('.mobileSheetBar')) return;

    dragging = true;
    startY = ev.clientY;
    startOffsetPx = offsetForState(getSheetState());

    el.panel.style.willChange = 'transform';
    el.mobileSheetBar.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!dragging) return;
    const dy = ev.clientY - startY;

    const h = getPanelHeight();
    const min = 0;
    const max = Math.max(0, h - H_COLLAPSED);
    const next = clamp(startOffsetPx + dy, min, max);
    applyOffset(next);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    el.panel.style.willChange = '';
    snap();
  };

  el.mobileSheetBar.addEventListener('pointerdown', onPointerDown, { passive: false } as any);
  window.addEventListener('pointermove', onPointerMove, { passive: true } as any);
  window.addEventListener('pointerup', onPointerUp, { passive: true } as any);

  // clique simples no handle alterna peek/open
  el.mobileSheetBar.addEventListener('click', () => {
    if (!isMobile()) return;
    // se acabou de arrastar, evita click fantasma
    if (Math.abs(currentOffsetPx - startOffsetPx) > 4) return;

    const cur = getSheetState();
    setSheetState(cur === 'open' ? 'peek' : 'open');
  });
})();

// Fecha fácil ao tocar fora do painel (na câmera)
el.cameraContainer?.addEventListener('click', () => {
  if (!isMobile()) return;
  const state = el.panel.getAttribute('data-sheet-state');
  if (state === 'open') setSheetState('peek');
});

// Ajusta o estado do painel ao redimensionar
window.addEventListener('resize', () => {
  if (isMobile()) {
    const state = el.panel.getAttribute('data-sheet-state');
    if (!state) setSheetState('peek');
  } else {
    // desktop: remove atributo e inline styles para não interferir
    el.panel.removeAttribute('data-sheet-state');
    el.panel.style.transform = '';
    el.panel.style.transition = '';
    el.panel.style.willChange = '';
  }
});
