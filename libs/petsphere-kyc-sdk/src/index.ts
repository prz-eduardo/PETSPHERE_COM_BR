// Extend the Window interface to include mouthWidthRatioDebug for debugging purposes
declare global {
  interface Window {
    mouthWidthRatioDebug?: number;
  }
}

import type { AlphaValidChallengeType, AlphaValidStartOptions, AlphaValidState } from './types/sdk';
import { ensureHTMLElement } from './utils/dom';
import { startUserCamera, captureVideoFrameToJpegBlob, type CameraHandle } from './core/camera';
import { createOverlay, type OverlayHandle } from './ui/overlay';
import { createFaceDetector, type FaceDetector } from './vision/faceDetector';
import { computeFeedback } from './core/feedback';
import { createOverlayCoxinhaMobile } from './ui/overlayCoxinhaMobile';
import { createUserPreviewCoxinhaUi, type UserPreviewUiHandle, labelsFromStartOptions } from './ui/userPreviewCoxinha';
import { createCameraLoader, type LoaderHandle } from './ui/loader';
import { createCaptureButtonCoxinhaUi, type CaptureButtonUiHandle } from './ui/captureButtonCoxinha';
import { ensureBaseStyles } from './ui/baseStyles';

const DEFAULT_MODEL_PATHS = ['/assets/kyc-face-models', '/kyc-face-models'];

const DEFAULT_CONTAINER_ID = 'cameraContainer';

async function validateModels(modelsPath: string): Promise<string> {
  const files = [
    'face_landmark_68_tiny_model-weights_manifest.json',
    'face_landmark_68_tiny_model-shard1.bin',
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1.bin'
  ];
  for (const file of files) {
    try {
      const res = await fetch(`${modelsPath}/${file}`, { method: 'HEAD' });
      if (!res.ok) throw new Error();
    } catch {
      throw new Error(`\n[AlphaValid] Models não encontrados.\n\nExecute automaticamente:\nnpx petsphere-kyc-sdk setup\n\nOu configure manualmente:\nmodelsPath: '${modelsPath}'\n`);
    }
  }
  return modelsPath;
}

export async function setupModels() {
  const { setupModels } = await import('./setupModels');
  return setupModels();
}

type InternalState = 'idle' | 'running' | 'paused' | 'preview' | 'stopped';

export class AlphaValid {
  private _camera: CameraHandle | null = null;
  private _overlay: OverlayHandle | null = null;
  private _container: HTMLElement | null = null;
  private _faceDetector: FaceDetector = createFaceDetector();
  private _loopTimer: number | null = null;
  private _lastStatusValid = false;
  private _options: AlphaValidStartOptions | null = null;

  private _status: import('./types/sdk').AlphaValidStatus = 'idle';

  private _challengeIndex = 0;
  private _challengeStartedAt: number | null = null;
  private _challengeEnterAt: number | null = null;
  private _challengeCompletedAt: number | null = null;
  private _challengeBaselineSeen = false;
  private _blinkArmed = false;

  private _state: AlphaValidState | null = null;

  // Auto-capture (stability gate)
  private _stableSince: number | null = null;
  private _lastStableCx: number | null = null;
  private _lastStableCy: number | null = null;
  private _lastStableArea: number | null = null;
  private _autoCaptureFired = false;

  // Challenge robustness: keep last good status for a short time during head-turns
  private _lastGoodStatus: import('./types/sdk').FaceDetectionStatus | null = null;
  private _lastGoodAt: number = 0;

  /**
   * Last detected frame status (most recent tick) used specifically for real-time
   * capture button gating (look-forward).
   */
  private _lastStatusForCaptureGate: import('./types/sdk').FaceDetectionStatus | null = null;
  private _lastLookForwardGateOk: boolean | null = null;
  private _forcedHintMessage: string | null = null;

  // Pose progress latch (prevents snapping back to 0 due to detection jitter)
  private _poseLatch: { left: number; right: number; up: number; down: number; at: number } = {
    left: 0,
    right: 0,
    up: 0,
    down: 0,
    at: 0
  };

  private _lastPoseChallenge: AlphaValidChallengeType | null = null;

  // Baseline for mouth<->jaw distances captured during lookForward (neutral)
  private _mouthJawBaseline: { left: number; right: number; at: number } | null = null;

  // Face lost grace: keep last good frame for a short time before declaring FACE_NOT_FOUND
  private _faceLostAt: number | null = null;

  // LookForward hold: require staying valid for some time before accepting the step.
  private _lookForwardOkSince: number | null = null;

  // Blink counter (runs from camera start; independent from challenge progression)
  private _blinkCount: number = 0;
  private _blinkPrevClosed: boolean = false;

  // Cheese (smile) baseline calibration (per session)
  private _cheeseBaseline: number | null = null;
  private _cheeseBaselineSamples = 0;
  private _cheeseBaselineSum = 0;
  private _cheeseBaselineStartedAt: number | null = null;

  // Adiciona controle de hold para todos os challenges
  private _challengeHoldSince: number | null = null;
  private _challengeLastStepOk = false;

  // NEW: expose smooth/robust pose hold progress (0..1) for UI
  private _challengeHoldProgress: number = 0;

  // NEW: smooth UI progress for Coxinha border (0..1), derived from pose progress + hold time
  private _challengeUiProgress: number = 0;

  /** Keep the last start options so the loop/catch/finally always has access (avoids scope issues). */
  private _startOptions: AlphaValidStartOptions | null = null;

  /** Estado de preview: blob da última captura, se em preview. */
  private _previewBlob: Blob | null = null;
  /** Guardar actions do preview para retake/confirm. */
  private _previewActions: { retake: () => void; confirm: () => void } | null = null;

  // Cheese/openMouth baseline para média dinâmica
  private _cheeseWindow: number[] = [];
  private _cheeseWindowStart: number | null = null;
  private _openMouthWindow: number[] = [];
  private _openMouthWindowStart: number | null = null;

  /** Internal SDK lifecycle state machine. */
  private _lifecycle: InternalState = 'idle';

  /** Prevent starting multiple detection loops concurrently. */
  private _loopActive = false;

  /** Internal flag for debug logs (derived from start options). */
  private _debug = false;

  /** Prevent concurrent capture() executions. */
  private _isCapturing = false;

  /** userPreview UI (Coxinha mode only). */
  private _userPreviewUi: UserPreviewUiHandle | null = null;
  private _userPreviewUrl: string | null = null;

  /** Built-in camera/models loader overlay. */
  private _loader: LoaderHandle | null = null;
  private _captureBtn: CaptureButtonUiHandle | null = null;

  // -----------------------------
  // SDK-managed manual capture button (Coxinha Mobile)
  // -----------------------------
  private _disposeCaptureButton() {
    try {
      this._captureBtn?.dispose();
    } catch {}
    this._captureBtn = null;
  }

  private _syncCaptureButton(state?: AlphaValidState | null) {
    const opts = this._options as any;
    if (!opts || !this._container) return;

    const isCoxinha = opts.uiMode === 'Mobile';
    const captureBtnEnabled = opts.captureButton?.enabled !== false;
    const autoCaptureEnabled = opts.autoCapture?.enabled === true;

    // Only in Mobile + manual mode
    const shouldExist = isCoxinha && captureBtnEnabled && !autoCaptureEnabled;
    if (!shouldExist) {
      if (this._captureBtn) this._disposeCaptureButton();
      return;
    }

    if (!this._captureBtn) {
      this._captureBtn = createCaptureButtonCoxinhaUi({
        container: this._container,
        text: opts.captureButton?.text ?? 'Capturar imagem',
        color: opts.captureButton?.color ?? '#00bcd4',
        onClick: () => {
          void this.capture().catch(() => {
            // ignore; UX is driven by SDK feedback/state
          });
        }
      });
    }

    const st = state ?? this._state;

    // Hide while preview is open
    if (this._lifecycle === 'preview') {
      this._captureBtn.hide();
      return;
    }

    // Show only after challenges are completed (if any) and while running
    const challengesCompleted = st?.challenge?.enabled ? st.challenge.completed === true : true;
    const canShow = this._lifecycle === 'running' && challengesCompleted;
    if (canShow) this._captureBtn.show();
    else this._captureBtn.hide();

    const baseReady = st?.isReadyToCapture === true && (st?.challenge?.enabled ? st.challenge.completed === true : true);

    // Optional extra gate: require lookForward at the moment of capture.
    const requireLf = (this._options as any)?.requireLookForwardForCapture === true;

    // IMPORTANT: use the most recent frame status for enabling/disabling the button in real-time.
    const stForGate = this._lastStatusForCaptureGate ?? this._lastGoodStatus ?? ({} as any);
    const lfOk = !requireLf ? true : this._isLookForwardForCapture(stForGate, { requireLf });

    // If the only reason to disable is look-forward, force the hint message.
    if (requireLf && baseReady && !lfOk) {
      this._forcedHintMessage = 'olhe para a camera';
    } else {
      this._forcedHintMessage = null;
    }

    // Debug only when it matters (button decision)
    if (requireLf) {
      // eslint-disable-next-line no-console
      // console.log('[AlphaValid][captureBtn][lookForwardGate]', {
      //   baseReady,
      //   lfOk,
      //   jawTopL: stForGate?.jawTopL,
      //   jawTopR: stForGate?.jawTopR,
      //   leftEyeCenter: stForGate?.leftEyeCenter,
      //   rightEyeCenter: stForGate?.rightEyeCenter,
      //   mouthVsJawMidRaw: (stForGate as any)?.mouthVsJawMidRaw,
      //   poseSource: stForGate?.poseSource
      // });
    }

    this._captureBtn.setEnabled(baseReady && lfOk);
  }

  private _setLifecycle(next: InternalState) {
    // Always log preview-related transitions when debug is enabled.
    if (this._debug) {
      // eslint-disable-next-line no-console
      console.log(`[AlphaValid] lifecycle ${this._lifecycle} → ${next}`);
    }
    this._lifecycle = next;
  }

  /**
   * Pauses the detection loop without stopping the camera stream or clearing options.
   * Safe to call multiple times.
   */
  private async _pause(): Promise<void> {
    if (this._lifecycle !== 'running') return;

    if (this._loopTimer != null) {
      window.clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }

    // Pause the <video> element so the UI looks frozen behind preview (stream stays alive).
    try {
      this._camera?.video?.pause();
    } catch {}

    this._loopActive = false;
    this._setLifecycle('paused');
  }

  /**
   * Resume the detection loop after a preview retake without tearing down/restoring options multiple times.
   * Camera & overlay are recreated by calling start() with the original options.
   */
  private async _retakeFromPreview() {
    // Debug breadcrumbs
    if (this._debug) {
      // eslint-disable-next-line no-console
      console.log('[AlphaValid] preview action: retake()', {
        lifecycle: this._lifecycle,
        hasCamera: !!this._camera,
        hasOptions: !!this._options,
        hasStartOptions: !!this._startOptions
      });
    }

    // Retake should ALWAYS close preview and restart the session.
    // This matches the expected UX: discard photo, re-open camera, resume detection.

    // Clear preview state immediately so UI can hide it.
    this._previewBlob = null;
    this._previewActions = null;

    // Ensure SDK-managed preview UI is closed immediately
    this._hideUserPreviewUi();

    const opts = this._startOptions;
    if (!opts) {
      if (this._debug) {
        // eslint-disable-next-line no-console
        console.warn('[AlphaValid] retake ignored: missing _startOptions (cannot restart)');
      }
      return;
    }

    try {
      // Full reset: stop camera/overlay and start again with the same options.
      await this.stop();
      await this.start(opts);
    } catch (e) {
      if (this._debug) {
        // eslint-disable-next-line no-console
        console.error('[AlphaValid] retake failed', e);
      }
      throw e;
    }
  }

  /**
   * Confirms the preview and finalizes the flow.
   */
  private async _confirmFromPreview() {
    if (this._debug) {
      // eslint-disable-next-line no-console
      console.log('[AlphaValid] preview action: confirm()', {
        lifecycle: this._lifecycle,
        hasBlob: !!this._previewBlob
      });
    }

    if (this._lifecycle !== 'preview') {
      if (this._debug) {
        // eslint-disable-next-line no-console
        console.warn('[AlphaValid] confirm ignored: not in preview', { lifecycle: this._lifecycle });
      }
      return;
    }

    const b = this._previewBlob;
    if (!b) return;

    // If SDK-managed userPreview is enabled, prefer the dedicated callback.
    // Otherwise keep legacy behavior.
    const userPreviewEnabled = Boolean((this._options as any)?.userPreview) && this._options?.uiMode === 'Mobile';
    if (userPreviewEnabled) {
      try {
        (this._options as any)?.onUserPreviewConfirm?.(b);
      } catch {}
    } else {
      // legacy behavior
      this._options?.autoCapture?.onCapture?.(b);
      (this._options as any)?.onCapture?.(b);
    }

    // Close preview UI if any, then stop everything
    this._hideUserPreviewUi();

    this._previewBlob = null;
    this._previewActions = null;
    await this.stop();
  }

  private _hideUserPreviewUi() {
    try {
      this._userPreviewUi?.hide();
    } catch {}
    if (this._userPreviewUrl) {
      try {
        URL.revokeObjectURL(this._userPreviewUrl);
      } catch {}
      this._userPreviewUrl = null;
    }
  }

  private _disposeUserPreviewUi() {
    this._hideUserPreviewUi();
    try {
      this._userPreviewUi?.dispose();
    } catch {}
    this._userPreviewUi = null;
  }

  /**
   * Chama o preview após captura, pausa detecção e exibe opções de retake/confirm.
   */
  private async _showPreview(blob: Blob) {
    if (this._debug) {
      // eslint-disable-next-line no-console
      console.log('[AlphaValid] entering preview', {
        lifecycle: this._lifecycle,
        blobSize: blob?.size
      });
    }

    // Allow preview to be shown from both 'paused' (expected) and 'preview' (idempotent).
    // Some apps may call capture() and immediately render UI; a strict guard can drop the preview.
    if (this._lifecycle !== 'paused' && this._lifecycle !== 'preview') {
      if (this._debug) {
        // eslint-disable-next-line no-console
        console.warn('[AlphaValid] _showPreview ignored due to lifecycle', { lifecycle: this._lifecycle });
      }
      return;
    }

    this._setLifecycle('preview');
    this._previewBlob = blob;

    // Actions para UI
    this._previewActions = {
      retake: () => {
        if (this._debug) {
          // eslint-disable-next-line no-console
          console.log('[AlphaValid] preview action clicked: retake');
        }
        void this._retakeFromPreview();
      },
      confirm: () => {
        if (this._debug) {
          // eslint-disable-next-line no-console
          console.log('[AlphaValid] preview action clicked: confirm');
        }
        void this._confirmFromPreview();
      }
    };

    const opts = this._options;
    const userPreviewEnabled = Boolean((opts as any)?.userPreview) && opts?.uiMode === 'Mobile';

    if (userPreviewEnabled && this._container && opts) {
      // Create UI lazily
      if (!this._userPreviewUi) {
        this._userPreviewUi = createUserPreviewCoxinhaUi({
          container: this._container,
          labels: labelsFromStartOptions(opts),
          onOk: () => this._previewActions?.confirm(),
          onRetake: () => this._previewActions?.retake()
        });
      }

      // Show image
      if (this._userPreviewUrl) {
        try {
          URL.revokeObjectURL(this._userPreviewUrl);
        } catch {}
      }
      this._userPreviewUrl = URL.createObjectURL(blob);
      const meta = `preview: ${(blob.size / 1024).toFixed(1)} KB · ${new Date().toLocaleTimeString()}`;
      this._userPreviewUi.show(this._userPreviewUrl, meta);
      return;
    }

    // Default/legacy path: hand control to app
    opts?.onPreview?.(blob, this._previewActions);
  }

  /** Hide camera until everything is ready (prevents showing video before models/overlay are loaded). */
  private _setVideoVisibility(visible: boolean) {
    const v = this._camera?.video as any;
    if (!v) return;
    try {
      if (visible) {
        // Fade-in for nicer UX
        v.style.visibility = 'visible';
        v.style.opacity = '1';
        v.style.pointerEvents = 'auto';
      } else {
        v.style.visibility = 'hidden';
        v.style.opacity = '0';
        v.style.pointerEvents = 'none';
      }
      if (!v.style.transition) {
        v.style.transition = 'opacity 160ms ease';
      }
    } catch {}
  }

  async start(options: AlphaValidStartOptions): Promise<void> {
    // Guard: prevent invalid transition
    if (this._lifecycle === 'running') return;
    if (this._lifecycle === 'preview') return;

    // derive debug flag early so we can log even if start fails
    this._debug =
      typeof (options as any).debug === 'boolean'
        ? ((options as any).debug as boolean)
        : Boolean((options as any).debug?.enabled);

    const resolvedContainer = options.container ?? document.getElementById(DEFAULT_CONTAINER_ID);
    if (!resolvedContainer) {
      throw new Error(
        `[AlphaValid] Container nao encontrado. Informe options.container ou crie <div id="${DEFAULT_CONTAINER_ID}"></div>.`
      );
    }

    ensureHTMLElement(resolvedContainer, 'options.container');

    // apply livenessPreset into liveness (without overriding explicit values)
    let mergedLiveness = options.liveness;
    if (options.livenessPreset) {
      const preset = options.livenessPreset;
      const base: import('./types/sdk').AlphaValidLivenessOptions = {};

      // Valores atuais considerados como "normal".
      if (preset === 'normal') {
        // manter defaults internos (nao setamos nada aqui)
      } else if (preset === 'easy') {
        base.strictness = 0.3;
        base.lookForwardTolerance = 0.85;
        base.lookForwardYawTol = 0.1;
        base.lookSideTol = 0.08;
        base.lookUpDownTol = 0.16;
        base.poseProgressAccept = 0.55;
      } else if (preset === 'strict') {
        base.strictness = 0.8;
        base.lookForwardTolerance = 0.6;
        base.lookForwardYawTol = 0.04;
        base.lookSideTol = 0.03;
        base.lookUpDownTol = 0.08;
        base.poseProgressAccept = 0.8;
        base.lookForwardHoldMs = 1200;
        base.challengeMinHoldMs = 220;
      }

      mergedLiveness = {
        ...base,
        ...options.liveness
      } as any;
    }

    // store options for loop usage
    const optionsWithContainer = { ...options, container: resolvedContainer, liveness: mergedLiveness } as AlphaValidStartOptions;
    this._startOptions = optionsWithContainer;

    await this.stop();

    // reset session counters
    this._blinkCount = 0;
    this._blinkPrevClosed = false;

    // Merge defaults: modelsPath and loader.src should work out-of-the-box for Angular
    this._options = {
      overlay: true,
      uiMode: 'Mobile',
      guideCircleRatio: 0.72,
      detectionIntervalMs: 50,
      // Default models path: where the CLI copies models for Angular apps
      modelsPath: '/assets/kyc-face-models',
      userPreview: true,
      previewOkText: 'OK',
      previewRetakeText: 'Tirar outra',
      loader: { enabled: true, sizePx: 120, minVisibleMs: 900 },
      captureButton: { enabled: true, text: 'Capturar imagem', color: '#00bcd4' },
      requireLookForwardForCapture: true,
      ...optionsWithContainer
    } as any;

    const startOptions = this._options!;

    this._container = resolvedContainer;
    const container = resolvedContainer;
    if (!container) {
      throw new Error('[AlphaValid] Container nao encontrado apos inicializacao.');
    }

    // Ensure base styles (mobile portrait full-screen) and apply root class
    try {
      ensureBaseStyles(container);
    } catch {}

    // SDK-managed loader (show early)
    if (startOptions.loader?.enabled !== false) {
      this._loader?.dispose();
      this._loader = createCameraLoader(container, startOptions.loader);
      this._loader.show();
    }

    // Ensure capture button is reset for this session
    this._disposeCaptureButton();

    this._status = 'initializing';
    startOptions.onStateChange?.({
      status: this._status,
      feedback: { code: 'INITIALIZING', message: 'Inicializando câmera...' },
      message: 'Inicializando câmera...',
      isReadyToCapture: false,
      challenge: { enabled: false, index: 0, total: 0, completed: false }
    });

    try {
      startOptions.onFeedback?.({ code: 'INITIALIZING', message: 'Inicializando câmera...' });

      this._camera = await startUserCamera(container);

      // Hide camera output until overlay + models are ready.
      this._setVideoVisibility(false);

      const wantsOverlay = startOptions.uiMode !== 'headless' && startOptions.overlay !== false;
      if (wantsOverlay) {
        if (startOptions.uiMode === 'Mobile') {
          this._overlay = createOverlayCoxinhaMobile(container);
        } else {
          this._overlay = createOverlay(container, startOptions.guideCircleRatio);
        }
      }

      let modelsPath = startOptions.modelsPath;

      // Normalize empty string to undefined so we still hit the auto-resolver
      if (modelsPath && modelsPath.trim() === '') {
        modelsPath = undefined as any;
      }

      const tryPaths = async (): Promise<string> => {
        // 1) If user explicitly provided modelsPath, respect it but still allow fallback on failure
        const explicit = modelsPath;
        if (explicit) {
          try {
            await validateModels(explicit);
            return explicit;
          } catch {
            // fall through to autoscan below
          }
        }

        // 2) Autoscan known defaults. Prefer Angular-friendly /assets/ path in messages.
        for (const p of DEFAULT_MODEL_PATHS) {
          try {
            await validateModels(p);
            return p;
          } catch {
            // try next
          }
        }

        // 3) If nothing worked, throw a single, clear error mentioning only the Angular path.
        throw new Error(
          `\n[AlphaValid] Models não encontrados.\n\n` +
            `Execute automaticamente (Angular / Vite):\n` +
            `npx petsphere-kyc-sdk setup\n\n` +
            `Ou configure manualmente no start():\n` +
            `modelsPath: '/assets/kyc-face-models'\n`
        );
      };

      const resolvedModelsPath = await tryPaths();

      if ((options as any).debug) {
        // eslint-disable-next-line no-console
        console.log('[AlphaValid] modelsPath resolvido:', resolvedModelsPath);
      }

      // IMPORTANT: always load the face-api models from the resolved modelsPath
      await this._faceDetector.load(resolvedModelsPath);

      // Ready: hide loader
      this._loader?.hide();

      // Now everything is ready; show camera output.
      this._setVideoVisibility(true);

      // Create/sync capture button (manual mode)
      this._syncCaptureButton(null);

      startOptions.onReady?.();

      this._status = 'running';
      this._setLifecycle('running');
      this.startDetectionLoop();
    } catch (err) {
      // Error: hide loader too
      this._loader?.hide();
      this._disposeCaptureButton();

      // Keep camera hidden on failures
      this._setVideoVisibility(false);

      this._status = 'error';
      const sdkErr = err as any;
      const normalized =
        sdkErr && typeof sdkErr === 'object' && typeof sdkErr.code === 'string' && typeof sdkErr.message === 'string'
          ? sdkErr
          : { code: 'CAMERA_UNKNOWN', message: 'Erro inesperado ao iniciar o SDK.', cause: err };

      this._options?.onError?.(normalized);
      this._options?.onStateChange?.({
        status: this._status,
        feedback: { code: 'FACE_NOT_FOUND', message: 'Centralize seu rosto' },
        message: 'Centralize seu rosto',
        isReadyToCapture: false,
        challenge: { enabled: false, index: 0, total: 0, completed: false }
      });
      await this.stop();
      throw err;
    }

    if (options.debug) {
      console.log('[AlphaValid] SDK iniciado');
      console.log('[AlphaValid] modelsPath:', options.modelsPath);
      // ...log outros status relevantes...
    }
  }

  async stop(): Promise<void> {
    if (this._loopTimer != null) {
      window.clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }

    this._loopActive = false;

    this._lastStatusValid = false;

    if (this._overlay) {
      this._overlay.dispose();
      this._overlay = null;
    }

    if (this._camera) {
      // Hide before stopping to avoid a flash of the last frame
      this._setVideoVisibility(false);
      this._camera.stop();
      this._camera = null;
    }

    // Clear preview state as well
    this._previewBlob = null;
    this._previewActions = null;

    // Dispose SDK-managed preview UI
    this._disposeUserPreviewUi();

    // Dispose capture button
    this._disposeCaptureButton();

    // Dispose loader
    if (this._loader) {
      this._loader.dispose();
      this._loader = null;
    }

    this._container = null;
    this._options = null;
    this._challengeIndex = 0;
    this._challengeStartedAt = null;
    this._challengeEnterAt = null;
    this._challengeCompletedAt = null;
    this._challengeBaselineSeen = false;
    this._blinkArmed = false;
    this._state = null;

    // IMPORTANT: do not return to 'idle' after the SDK has ever started.
    // idle = never started; stopped = finished session.
    if (this._lifecycle === 'idle') {
      this._status = 'idle';
    } else {
      this._status = 'stopped' as any;
    }

    this._stableSince = null;
    this._lastStableCx = null;
    this._lastStableCy = null;
    this._lastStableArea = null;
    this._autoCaptureFired = false;

    this._lastGoodStatus = null;
    this._lastGoodAt = 0;
    this._faceLostAt = null;

    this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
    this._mouthJawBaseline = null;
    this._lookForwardOkSince = null;
    this._challengeHoldSince = null;
    this._challengeLastStepOk = false;
    this._challengeHoldProgress = 0;
    this._challengeUiProgress = 0;

    this._blinkCount = 0;
    this._blinkPrevClosed = false;

    // reset cheese baseline on each start
    this._cheeseBaseline = null;
    this._cheeseBaselineSamples = 0;
    this._cheeseBaselineSum = 0;
    this._cheeseBaselineStartedAt = null;

    this._setLifecycle('stopped');
  }

  /** Indica se está em preview (bloqueia detecção/captura). */
  private get _isInPreview() {
    return this._lifecycle === 'preview';
  }

  async capture(): Promise<Blob> {
    // Guard: capture is only allowed when running
    if (this._lifecycle !== 'running') {
      throw new Error('SDK is not running. Call start() first.');
    }

    if (this._isCapturing) {
      throw new Error('Capture already in progress.');
    }

    this._isCapturing = true;
    try {
      if (!this._camera) throw new Error('Camera not started. Call start() first.');

      // --- NEW: enforce + log lookForward gate at capture time (only when enabled) ---
      const requireLf = (this._options as any)?.requireLookForwardForCapture === true;
      if (requireLf) {
        const st = this._lastStatusForCaptureGate ?? this._lastGoodStatus ?? ({} as any);
        const ok = this._isLookForwardForCapture(st);

        // Log only when capture is attempted (manual click / auto-capture).
        // eslint-disable-next-line no-console
        console.log('[AlphaValid][capture][lookForwardGate]', {
          ok,
          // raw signals (normalized points)
          jawTopL: st?.jawTopL,
          jawTopR: st?.jawTopR,
          leftEyeCenter: st?.leftEyeCenter,
          rightEyeCenter: st?.rightEyeCenter,
          // computed signal used in the gate
          mouthVsJawMidRaw: (st as any)?.mouthVsJawMidRaw,
          // other useful context
          poseSource: st?.poseSource,
          faces: st?.faces
        });

        if (!ok) {
          throw new Error('LookForward gate blocked capture. User is not facing forward.');
        }
      }

      if (!this._lastStatusValid) {
        throw new Error('Face not valid for capture yet. Wait for feedback "Pronto para capturar".');
      }
      if (this._isInPreview) throw new Error('Já existe uma captura em preview.');

      const blob = await captureVideoFrameToJpegBlob(this._camera.video, 0.9);

      // Pause detection loop before entering preview (keeps camera/options intact)
      await this._pause();

      // If userPreview is enabled OR onPreview is defined, enter preview flow.
      const userPreviewEnabled = Boolean((this._options as any)?.userPreview) && this._options?.uiMode === 'Mobile';
      if (userPreviewEnabled || this._options?.onPreview) {
        // Hide manual capture button while preview is on screen
        this._syncCaptureButton({ ...(this._state as any), isReadyToCapture: false } as any);
        await this._showPreview(blob);
      }

      return blob;
    } finally {
      this._isCapturing = false;
    }
  }

  getState(): AlphaValidState | null {
    return this._state;
  }

  /** Reset the challenge progression back to step 0 (does not restart camera/detector). */
  resetChallenges(): void {
    this._challengeIndex = 0;
    this._challengeStartedAt = null;
    this._challengeEnterAt = null;
    this._challengeCompletedAt = null;
    this._challengeBaselineSeen = false;
    this._blinkArmed = false;
    this._stableSince = null;
    this._autoCaptureFired = false;
    this._mouthJawBaseline = null;
    this._lookForwardOkSince = null;
    this._challengeHoldSince = null;
    this._challengeLastStepOk = false;
    this._challengeHoldProgress = 0;
    this._challengeUiProgress = 0;
  }

  private getCurrentChallenge(): AlphaValidChallengeType | null {
    const steps = this._options?.liveness?.challenges;
    if (!steps || steps.length === 0) return null;

    // Do NOT auto-insert lookForward between steps. Use the configured sequence as-is.
    const t = steps[this._challengeIndex]?.type;
    return (t ?? null) as AlphaValidChallengeType | null;
  }

  private markStepCompletedIfNeeded(
    isStepOk: boolean,
    debug?: {
      leftEyeOpenProb?: number;
      rightEyeOpenProb?: number;
      stepPassed?: boolean;
      mouthSmileRatio?: number;
      mouthOpenRatio?: number;
      mouthWidthRatio?: number;
      // NEW: progress from pose latch (0..1)
      poseProgress?: number;
    }
  ): void {
    const options = this._options;
    const steps = options?.liveness?.challenges;
    if (!options || !steps || steps.length === 0) return;

    const current = this.getCurrentChallenge();
    if (!current) return;

    // Parâmetro de hold genérico
    const holdMs = options.liveness?.challengeMinHoldMs ?? 350;
    const now = Date.now();

    // --- NEW: robust hysteresis thresholds for pose challenges ---
    const enterThr = 0.75;
    const exitThr = 0.55;

    // reset UI progress when switching steps
    const uiStepKey = `${this._challengeIndex}:${current}`;
    if ((this as any)._uiStepKey !== uiStepKey) {
      (this as any)._uiStepKey = uiStepKey;
      this._challengeUiProgress = 0;
    }

    // NEW: lookUp/lookDown are validated by feedback.ts; if it says it's ok, honor it.
    // This avoids getting stuck when the progress signal never reaches the generic enterThr.
    const lookUpDownOverrideOk =
      (current === 'lookUp' || current === 'lookDown') && isStepOk === true;

    // Lógica de hold para todos os challenges (exceto lookForward, que já tem lógica própria)
    let useGenericHold = current !== 'lookForward';
    let stepOk = lookUpDownOverrideOk ? true : isStepOk;

    // Blink: lógica especial já existente
    if (current === 'blink') {
      const l = debug?.leftEyeOpenProb;
      const r = debug?.rightEyeOpenProb;
      if (typeof l !== 'number' || typeof r !== 'number') return;
      // Novo: threshold mais sensível para blink challenge
      const blinkChallengeThr = 0.9;
      const isClosedNow = l < blinkChallengeThr && r < blinkChallengeThr;
      if (!this._blinkArmed) {
        // Só arma se ambos estiverem abertos (acima do threshold)
        if (!(l >= blinkChallengeThr && r >= blinkChallengeThr)) return;
        this._blinkArmed = true;
        return;
      }
      if (!isClosedNow) return;
      // Incrementa blinkCount também nesse threshold
      this._blinkCount += 1;
      // Blink challenge: considera válido imediatamente, sem hold
      useGenericHold = false;
      stepOk = true;
    }
    // Cheese: se passar do threshold, considera válido imediatamente
    if (current === 'cheese') {
      const smile = debug?.mouthSmileRatio;
      // Calcula cheeseTarget conforme lógica do state
      const cheeseDeltaThr = this._options?.liveness?.cheeseThreshold ?? 0.08;
      let cheeseTarget: number | undefined = undefined;
      if (this._options?.liveness?.cheeseUseBaseline !== false && this._cheeseBaseline != null) {
        cheeseTarget = this._cheeseBaseline + cheeseDeltaThr;
      } else if (this._options?.liveness?.cheeseUseBaseline === false) {
        cheeseTarget = cheeseDeltaThr;
      }
      if (typeof smile === 'number' && typeof cheeseTarget === 'number' && smile > cheeseTarget) {
        this._challengeIndex += 1;
        this._challengeStartedAt = now;
        this._challengeEnterAt = now;
        this._challengeCompletedAt = now;
        this._challengeBaselineSeen = false;
        this._blinkArmed = false;
        this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
        this._lookForwardOkSince = null;
        this._challengeHoldSince = null;
        this._challengeLastStepOk = false;
        this._cheeseWindow = [];
        this._cheeseWindowStart = null;
        return;
      }
    }
    // OpenMouth: se passar de 0.5, considera válido imediatamente
    if (current === 'openMouth') {
      const ratio = debug?.mouthOpenRatio;
      if (typeof ratio === 'number' && ratio > 0.5) {
        this._challengeIndex += 1;
        this._challengeStartedAt = now;
        this._challengeEnterAt = now;
        this._challengeCompletedAt = now;
        this._challengeBaselineSeen = false;
        this._blinkArmed = false;
        this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
        this._lookForwardOkSince = null;
        this._challengeHoldSince = null;
        this._challengeLastStepOk = false;
        this._openMouthWindow = [];
        this._openMouthWindowStart = null;
        return;
      }
    }
    // MouthWidth: sempre exibe o valor de debug.mouthWidthRatio no console
    if (current === 'mouthWidth') {
      // Log extra para debug
      const width = debug?.mouthWidthRatio;
      window.mouthWidthRatioDebug = width; // também expõe global para inspeção
      console.log('[AlphaValid][mouthWidth][REALTIME] mouthWidthRatio:', width, '| challengeIndex:', this._challengeIndex, '| debug:', debug);
    }
    // Cheese/openMouth: já usam stepPassed
    if ((current === 'cheese' || current === 'openMouth') && !debug?.stepPassed) {
      stepOk = false;
    }

    // Aplica hold genérico para todos os challenges (exceto lookForward e blink)
    if (useGenericHold) {
      const isPose =
        current === 'lookLeft' ||
        current === 'lookRight' ||
        current === 'lookUp' ||
        current === 'lookDown';
      if (isPose) {
        const pRaw = typeof debug?.poseProgress === 'number' ? debug!.poseProgress! : 0;

        // UI: continuous fill/empty as user approaches/leaves target pose.
        // IMPORTANT: For pose challenges, the ring should be able to reach the full circle
        // *just by reaching the correct pose*. Hold is used only to decide when to advance.
        const phaseA = Math.max(0, Math.min(1, pRaw));

        // Require the pose to be essentially fully reached before starting/keeping the hold timer.
        const fullPoseEps = 0.02; // accepts >= 0.98 as "full"
        const poseFullyReached = phaseA >= 1 - fullPoseEps;
        const stepOkForHold = stepOk && poseFullyReached;

        if (!stepOkForHold) {
          this._challengeHoldSince = null;
          this._challengeLastStepOk = false;
          this._challengeHoldProgress = 0;
          // Ring follows the approach progress directly (0..1)
          this._challengeUiProgress = this._challengeUiProgress + (phaseA - this._challengeUiProgress) * 0.22;
          return;
        }

        if (!this._challengeHoldSince) this._challengeHoldSince = now;
        const elapsed = Math.max(0, now - this._challengeHoldSince);
        const holdP = Math.max(0, Math.min(1, holdMs > 0 ? elapsed / holdMs : 1));
        this._challengeHoldProgress = holdP;

        // While holding, keep the ring closed (1.0). Do NOT use hold to fill the ring.
        this._challengeUiProgress = this._challengeUiProgress + (1 - this._challengeUiProgress) * 0.22;

        if (elapsed >= holdMs) {
          this._challengeIndex += 1;
          this._challengeStartedAt = now;
          this._challengeEnterAt = now;
          this._challengeCompletedAt = now;
          this._challengeBaselineSeen = false;
          this._blinkArmed = false;
          this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
          this._lookForwardOkSince = null;
          this._challengeHoldSince = null;
          this._challengeLastStepOk = false;
          this._challengeHoldProgress = 0;
          this._challengeUiProgress = 0;
          return;
        }

        this._challengeLastStepOk = true;
        return;
      }

      // Non-pose: keep old behavior, but smooth UI from hold progress
      if (stepOk) {
        if (!this._challengeHoldSince || !this._challengeLastStepOk) {
          this._challengeHoldSince = now;
        }
        const elapsed = Math.max(0, now - (this._challengeHoldSince ?? now));
        const holdP = Math.max(0, Math.min(1, holdMs > 0 ? elapsed / holdMs : 1));
        this._challengeHoldProgress = holdP;
        this._challengeUiProgress = this._challengeUiProgress + (holdP - this._challengeUiProgress) * 0.25;

        if (elapsed >= holdMs) {
          this._challengeIndex += 1;
          this._challengeStartedAt = now;
          this._challengeEnterAt = now;
          this._challengeCompletedAt = now;
          this._challengeBaselineSeen = false;
          this._blinkArmed = false;
          this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
          this._lookForwardOkSince = null;
          this._challengeHoldSince = null;
          this._challengeLastStepOk = false;
          this._challengeHoldProgress = 0;
          this._challengeUiProgress = 0;
          return;
        }

        this._challengeLastStepOk = true;
      } else {
        this._challengeHoldSince = null;
        this._challengeLastStepOk = false;
        this._challengeHoldProgress = 0;
        this._challengeUiProgress = this._challengeUiProgress + (0 - this._challengeUiProgress) * 0.35;
      }
      return;
    }

    // lookForward: lógica original (já tem hold próprio)
    if (current === 'lookForward') {
      if (this._state?.feedback?.code === 'READY') {
        this._challengeIndex += 1;
        this._challengeStartedAt = now;
        this._challengeEnterAt = now;
        this._challengeCompletedAt = now;
        this._challengeBaselineSeen = false;
        this._blinkArmed = false;
        this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
        this._lookForwardOkSince = null;
        this._challengeHoldSince = null;
        this._challengeLastStepOk = false;
        return;
      }
      if (!isStepOk) {
        this._challengeEnterAt = null;
        this._challengeHoldSince = null;
        this._challengeLastStepOk = false;
        return;
      }
      // Não precisa de hold adicional!
      return;
    }

    // OpenMouth: se passar de 0.5, considera válido imediatamente
    if (current === 'openMouth') {
      const ratio = debug?.mouthOpenRatio;
      if (typeof ratio === 'number' && ratio > 0.5) {
        this._challengeIndex += 1;
        this._challengeStartedAt = now;
        this._challengeEnterAt = now;
        this._challengeCompletedAt = now;
        this._challengeBaselineSeen = false;
        this._blinkArmed = false;
        this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
        this._lookForwardOkSince = null;
        this._challengeHoldSince = null;
        this._challengeLastStepOk = false;
        this._openMouthWindow = [];
        this._openMouthWindowStart = null;
        return;
      }
    }

    // Fallback: se chegou aqui, avança step (caso especial)
    if (stepOk) {
      this._challengeIndex += 1;
      this._challengeStartedAt = now;
      this._challengeEnterAt = now;
      this._challengeCompletedAt = now;
      this._challengeBaselineSeen = false;
      this._blinkArmed = false;
      this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
      this._lookForwardOkSince = null;
      this._challengeHoldSince = null;
      this._challengeLastStepOk = false;
    }
  }

  private mapChallengeToHint(current: AlphaValidChallengeType | null, msg: string) {
    if (!current) return undefined;
    if (current === 'lookLeft') return { type: 'arrow', direction: 'left', label: msg } as const;
    if (current === 'lookRight') return { type: 'arrow', direction: 'right', label: msg } as const;
    if (current === 'lookUp') return { type: 'arrow', direction: 'up', label: msg } as const;
    if (current === 'lookDown') return { type: 'arrow', direction: 'down', label: msg } as const;
    if (current === 'blink') return { type: 'pulse', label: msg } as const;
    if (current === 'cheese') return { type: 'pulse', label: msg } as const;
    if (current === 'openMouth') return { type: 'pulse', label: msg } as const;
    return { type: 'pulse', label: msg } as const;
  }

  private isStableFrame(status: { box?: any; centerX?: number; area?: number }): boolean {
    const box = status.box;
    if (!box) return false;

    const cx = (status.centerX ?? (box.x + box.width / 2)) as number;
    const cy = (box.y + box.height / 2) as number;
    const area = (status.area ?? box.width * box.height) as number;

    // thresholds are normalized (video space)
    const tolCenter = 0.015;
    const tolArea = 0.015;

    if (this._lastStableCx == null || this._lastStableCy == null || this._lastStableArea == null) {
      this._lastStableCx = cx;
      this._lastStableCy = cy;
      this._lastStableArea = area;
      return false;
    }

    const dcx = Math.abs(cx - this._lastStableCx);
    const dcy = Math.abs(cy - this._lastStableCy);
    const da = Math.abs(area - this._lastStableArea);

    const ok = dcx <= tolCenter && dcy <= tolCenter && da <= tolArea;

    // update baseline slowly to avoid being too sticky
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const t = ok ? 0.15 : 0.35;
    this._lastStableCx = lerp(this._lastStableCx, cx, t);
    this._lastStableCy = lerp(this._lastStableCy, cy, t);
    this._lastStableArea = lerp(this._lastStableArea, area, t);

    return ok;
  }

  /**
   * Simple, independent lookForward gate for capture.
   * Intentionally does NOT reuse computeFeedback/lookForward challenge state.
   * Returns true when user is roughly facing the camera.
   */
  private _isLookForwardForCapture(status: any, ctx?: { requireLf?: boolean }): boolean {
    const jawTopL = status?.jawTopL;
    const jawTopR = status?.jawTopR;
    const leftEyeCenter = status?.leftEyeCenter;
    const rightEyeCenter = status?.rightEyeCenter;

    // Compute mouthVsJawMidRaw if not present (some detector outputs don't expose it directly).
    // We can estimate it from mouthLeft/mouthRight and jawLeft/jawRight + face box height.
    let mouthVsJawMidRaw: number | null =
      typeof (status as any)?.mouthVsJawMidRaw === 'number' ? (status as any).mouthVsJawMidRaw : null;

    if (mouthVsJawMidRaw == null) {
      const ml = status?.mouthLeft;
      const mr = status?.mouthRight;
      const jl = status?.jawLeft;
      const jr = status?.jawRight;
      const faceH = status?.box?.height;
      if (ml && mr && jl && jr && typeof faceH === 'number' && faceH > 1e-6) {
        const mouthAvgY = (ml.y + mr.y) / 2;
        const jawMidY = (jl.y + jr.y) / 2;
        mouthVsJawMidRaw = (jawMidY - mouthAvgY) / faceH;
      }
    }

    // When the feature is enabled, FAIL-CLOSED only if we don't have the core landmarks.
    const mustBlockOnMissing = ctx?.requireLf === true;
    if (!jawTopL || !jawTopR || !leftEyeCenter || !rightEyeCenter) {
      return mustBlockOnMissing ? false : true;
    }

    // Symmetry check (robust): jawTop->eye distances should be similar when facing forward.
    const distL = Math.hypot(jawTopL.x - leftEyeCenter.x, jawTopL.y - leftEyeCenter.y);
    const distR = Math.hypot(jawTopR.x - rightEyeCenter.x, jawTopR.y - rightEyeCenter.y);
    const distDiff = Math.abs(distL - distR);
    const maxDist = Math.max(distL, distR, 1e-6);
    const distRelDiff = distDiff / maxDist;

    // Make it more permissive as requested.
    const distOk = distRelDiff <= 0.45;

    // Optional vertical-neutral check (only if we managed to compute it).
    const yOk = typeof mouthVsJawMidRaw === 'number' ? mouthVsJawMidRaw >= -0.75 && mouthVsJawMidRaw <= 0.75 : true;

    return distOk && yOk;
  }

  private startDetectionLoop(): void {
    // Guard: only start the loop while running, and never start a second loop.
    if (this._lifecycle !== 'running') return;
    if (this._loopActive) return;

    this._loopActive = true;

    const tick = async () => {
      // Fail-safe: if loop is not active, do nothing.
      if (!this._loopActive) return;

      // Hard guard: do not process frames outside running.
      if (this._lifecycle !== 'running') {
        this._loopActive = false;
        return;
      }

      // Always read from stored options inside the loop.
      const startOptions = this._startOptions;
      if (!startOptions) {
        this._loopActive = false;
        return;
      }

      // --- CORREÇÃO: inicializa autoMirrored no início do tick ---
      let autoMirrored = false;
      // Se quiser lógica de detecção, adicione aqui
      // Exemplo: autoMirrored = camera.video && getComputedStyle(camera.video).transform.includes('-1');

      try {
        const camera = this._camera;
        const options = this._options;
        if (!camera || !options) {
          this._loopActive = false;
          return;
        }

        // Double-guard: if somehow lifecycle changed mid-tick, skip all processing.
        if (this._lifecycle !== 'running') {
          this._loopActive = false;
          return;
        }

        const steps = options.liveness?.challenges;
        const challengeEnabled = !!steps && steps.length > 0;

        // Total steps are exactly what the user configured.
        const totalSteps = steps?.length ?? 0;

        const completedNow = !challengeEnabled || this._challengeIndex >= totalSteps;

        const rawChallenge = this.getCurrentChallenge();
        const currentChallenge = completedNow ? null : rawChallenge;

        // Only request landmarks when needed:
        // - explicit debug drawing
        // - any current challenge step (including lookForward)
        // - OR lookForward gate for capture is enabled (independent of challenges)
        const requireLfForCapture = (options as any)?.requireLookForwardForCapture === true;
        const needsLandmarks =
          options.debug?.drawLandmarks === true ||
          currentChallenge != null ||
          requireLfForCapture;

        let status = await this._faceDetector.detect(camera.video, { withLandmarks: needsLandmarks });

        // Keep the latest frame for real-time capture button gating.
        this._lastStatusForCaptureGate = status;

        // If user is in a pose challenge and face briefly drops (common when turning), reuse last good status.
        const isPoseChallenge =
          currentChallenge === 'lookLeft' ||
          currentChallenge === 'lookRight' ||
          currentChallenge === 'lookUp' ||
          currentChallenge === 'lookDown';

        const graceMs = options.liveness?.poseGraceMs ?? 900;
        const poseExtendedGraceMs = Math.max(graceMs, 1400);

        // Generic grace when face disappears (any step): avoid instant "FACE_NOT_FOUND".
        const faceLostGraceMs = options.liveness?.faceLostGraceMs ?? 900;
        const nowMs = Date.now();

        if (status.faces === 1 && status.box) {
          this._lastGoodStatus = status;
          this._lastGoodAt = nowMs;
          this._faceLostAt = null;
        } else {
          if (this._faceLostAt == null) this._faceLostAt = nowMs;

          // During the grace window, keep last good status if we have one.
          if (this._lastGoodStatus && nowMs - (this._faceLostAt ?? nowMs) <= faceLostGraceMs) {
            status = this._lastGoodStatus;
          } else if (isPoseChallenge && this._lastGoodStatus && nowMs - this._lastGoodAt <= poseExtendedGraceMs) {
            status = this._lastGoodStatus;
          } else {
            // If we truly lost the face beyond grace, reset pose hold so it doesn't get stuck in "Mantenha".
            if (isPoseChallenge) {
              this._challengeHoldSince = null;
              this._challengeLastStepOk = false;
              this._challengeHoldProgress = 0;
              this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
            }
           }
         }

        // While we are inside the "face lost" grace window, hide landmarks/lines to avoid showing stale points.
        const inFaceLostGrace = this._faceLostAt != null && nowMs - this._faceLostAt <= faceLostGraceMs;

        const fb = computeFeedback(
          status,
          {
            ...options.liveness,
            mouthJawBaselineLeft: this._mouthJawBaseline?.left,
            mouthJawBaselineRight: this._mouthJawBaseline?.right,
            cheeseBaseline: this._cheeseBaseline ?? undefined,
            lookForwardOkSince: this._lookForwardOkSince
          } as any,
          options.liveness?.challenges?.length ? { current: currentChallenge } : undefined
        );

        // Count blinks from the moment the camera is active.
        // Novo: blinkCount também considera threshold mais sensível (0.9)
        const blinkClosedThr = 0.9;
        const lEye = status.leftEyeOpenProb;
        const rEye = status.rightEyeOpenProb;
        const hasEyes = typeof lEye === 'number' && typeof rEye === 'number';
        const closedNow = hasEyes ? (lEye as number) < blinkClosedThr && (rEye as number) < blinkClosedThr : false;
        if (closedNow && !this._blinkPrevClosed) this._blinkCount += 1;
        this._blinkPrevClosed = closedNow;

        // Update lookForward hold timer using *instant* lookForward condition.
        // IMPORTANT: if we use the held flag here, the timer never starts and lookForward never becomes valid.
        const isLookForwardStep = currentChallenge === 'lookForward';
        const lfOkInstantNow = isLookForwardStep && (fb as any)?.debug?.lookForwardOkInstant === true;
        if (lfOkInstantNow) {
          if (this._lookForwardOkSince == null) this._lookForwardOkSince = Date.now();
        } else {
          this._lookForwardOkSince = null;
        }

        // Capture baseline during lookForward when we have mouth/jaw distances and user is centered.
        // IMPORTANT: baseline may be used by other challenges, but it must never become a hidden gate.
        if (currentChallenge === 'lookForward') {
          const mjL = (status as any).mouthJawLeftDist;
          const mjR = (status as any).mouthJawRightDist;
          const lfOk = (fb as any)?.debug?.lookForwardOk;

          if (typeof mjL === 'number' && typeof mjR === 'number' && lfOk) {
            // exponential moving average to stabilize baseline
            const nowMs = Date.now();
            if (!this._mouthJawBaseline) {
              this._mouthJawBaseline = { left: mjL, right: mjR, at: nowMs };
            } else {
              const a = 0.18;
              this._mouthJawBaseline.left = this._mouthJawBaseline.left + (mjL - this._mouthJawBaseline.left) * a;
              this._mouthJawBaseline.right = this._mouthJawBaseline.right + (mjR - this._mouthJawBaseline.right) * a;
              this._mouthJawBaseline.at = nowMs;
            }
          }
        }

        // Latch pose progress (hold peak briefly + slow decay) to avoid regressions due to jitter.
        const now = Date.now();

        if (isPoseChallenge) {
          const p = (fb as any)?.debug;
          const nextLeft = typeof p?.lookLeftProgress === 'number' ? p.lookLeftProgress : 0;
          const nextRight = typeof p?.lookRightProgress === 'number' ? p.lookRightProgress : 0;
          const nextUp = typeof p?.lookUpProgress === 'number' ? p.lookUpProgress : 0;
          const nextDown = typeof p?.lookDownProgress === 'number' ? p.lookDownProgress : 0;

          const dt = this._poseLatch.at ? Math.max(0, now - this._poseLatch.at) : 0;
          const decayPerMs = 0.0009; // faster falloff so progress drops when user moves away (~0.9 per second)
          const decay = dt * decayPerMs;

          // Allow progress to go down (decay) and follow the live signal, but keep it stable against jitter
          // by not dropping faster than `decay` per tick.
          const fall = (prev: number, next: number) => {
            const floor = Math.max(0, prev - decay);
            const v = Math.max(floor, next);
            return Math.max(0, Math.min(1, v));
          };

          this._poseLatch.left = fall(this._poseLatch.left, nextLeft);
          this._poseLatch.right = fall(this._poseLatch.right, nextRight);
          this._poseLatch.up = fall(this._poseLatch.up, nextUp);
          this._poseLatch.down = fall(this._poseLatch.down, nextDown);
          this._poseLatch.at = now;

          // overwrite progress shown in state/debug using the latched values
          if ((fb as any)?.debug) {
            (fb as any).debug.lookLeftProgress = this._poseLatch.left;
            (fb as any).debug.lookRightProgress = this._poseLatch.right;
            (fb as any).debug.lookUpProgress = this._poseLatch.up;
            (fb as any).debug.lookDownProgress = this._poseLatch.down;
          }
        } else {
          this._poseLatch = { left: 0, right: 0, up: 0, down: 0, at: 0 };
        }

        this.markStepCompletedIfNeeded(fb.stepOk, {
          leftEyeOpenProb: status.leftEyeOpenProb,
          rightEyeOpenProb: status.rightEyeOpenProb,
          stepPassed: (fb.debug as any)?.stepPassed,
          mouthOpenRatio: status.mouthOpenNorm,
          mouthWidthRatio: (fb.debug as any)?.mouthWidthRatio,
          // NEW: use poseLatch values as progress source (already smoothed)
          poseProgress:
            currentChallenge === 'lookLeft'
              ? this._poseLatch.left
              : currentChallenge === 'lookRight'
                ? this._poseLatch.right
                : currentChallenge === 'lookUp'
                  ? this._poseLatch.up
                  : currentChallenge === 'lookDown'
                    ? this._poseLatch.down
                    : 0
        } as any);

        // Continuous UI progress for zoom challenges (fill as user approaches the valid size).
        // feedback.ts provides debug.zoomProgress in [0..1].
        if (currentChallenge === 'zoomIn' || currentChallenge === 'zoomOut') {
          const z = (fb.debug as any)?.zoomProgress;
          const zP = typeof z === 'number' ? Math.max(0, Math.min(1, z)) : 0;

          // Phase A: approach progress (0..0.55)
          const approachUi = 0.55 * zP;

          // Phase B: hold progress once fully valid (zP ~ 1 and stepOk true)
          if (fb.stepOk) {
            const holdMs = this._options?.liveness?.challengeMinHoldMs ?? 350;
            const now2 = Date.now();
            if (!this._challengeHoldSince) this._challengeHoldSince = now2;
            const elapsed = Math.max(0, now2 - this._challengeHoldSince);
            const holdP = Math.max(0, Math.min(1, holdMs > 0 ? elapsed / holdMs : 1));
            this._challengeHoldProgress = holdP;

            const targetUi = 0.55 + 0.45 * holdP;
            this._challengeUiProgress = this._challengeUiProgress + (Math.max(approachUi, targetUi) - this._challengeUiProgress) * 0.22;
          } else {
            this._challengeHoldSince = null;
            this._challengeLastStepOk = false;
            this._challengeHoldProgress = 0;
            this._challengeUiProgress = this._challengeUiProgress + (approachUi - this._challengeUiProgress) * 0.22;
          }
        }

        // recompute completion after possivelmente incrementando índice
        const completed = !challengeEnabled || this._challengeIndex >= totalSteps;

        // Auto-capture now waits for stability while READY.
        const wantsAuto = startOptions.autoCapture?.enabled === true;
        const stableMs = startOptions.autoCapture?.stableMs ?? 650;

        let isReady = fb.frameOk && completed;

        // Optional extra gate: require lookForward at the moment of capture.
        const requireLf = (startOptions as any)?.requireLookForwardForCapture === true;
        const gateStatus = this._lastStatusForCaptureGate ?? status;
        const lfOkForCapture = !requireLf ? true : this._isLookForwardForCapture(gateStatus, { requireLf });
        this._lastLookForwardGateOk = lfOkForCapture;
        if (!lfOkForCapture) {
          isReady = false;
        }

        // Log only when we are READY by frame/challenges (centralizado etc) mas bloqueado/passado pelo portão lookForward.
        if (requireLf && fb.frameOk && completed) {
          // eslint-disable-next-line no-console
          console.log('[AlphaValid][readyGate][lookForward]', {
            lfOkForCapture,
            jawTopL: (status as any)?.jawTopL,
            jawTopR: (status as any)?.jawTopR,
            leftEyeCenter: (status as any)?.leftEyeCenter,
            rightEyeCenter: (status as any)?.rightEyeCenter,
            mouthVsJawMidRaw: (status as any)?.mouthVsJawMidRaw,
            poseSource: (status as any)?.poseSource
          });
        }

        if (wantsAuto && isReady) {
          const stableNow = this.isStableFrame(status);
          if (!stableNow) {
            this._stableSince = null;
            isReady = false;
          } else {
            if (this._stableSince == null) this._stableSince = Date.now();
            const elapsed = Date.now() - this._stableSince;
            if (elapsed < stableMs) {
              isReady = false;
            }
          }
        } else {
          this._stableSince = null;
        }

        this._lastStatusValid = isReady;
        this._status = isReady ? 'ready' : 'running';

        // Ajuste: só exibe 'Pronto para capturar' se todos os challenges estiverem completos
        let message: string;
        if (completed) {
          message = fb.feedback.message;
        } else {
          // Se ainda há challenges, nunca exibe 'Pronto para capturar', mesmo que o feedback do step seja READY
          if (fb.feedback.code === 'READY') {
            // Mostra a mensagem do feedback do step atual, exceto 'Pronto para capturar'
            message = 'Siga o desafio';
          } else {
            message = fb.feedback.message;
          }
        }

        // If capture gate is enabled and READY would otherwise be shown but capture is blocked,
        // show a correct hint/message.
        if (requireLf && completed && this._lastLookForwardGateOk === false) {
          message = 'olhe para a camera';
          (fb as any).feedback = { ...(fb as any).feedback, code: 'LOOK_FORWARD', message };
        }

        // Corrigir: garantir que cheeseTarget só é usado se cheeseUseBaseline === true
        const cheeseDeltaThr = startOptions.liveness?.cheeseThreshold ?? 0.08;
        let cheeseTarget: number | undefined = undefined;
        if (startOptions.liveness?.cheeseUseBaseline !== false && this._cheeseBaseline != null) {
          cheeseTarget = this._cheeseBaseline + cheeseDeltaThr;
        } else if (startOptions.liveness?.cheeseUseBaseline === false) {
          cheeseTarget = cheeseDeltaThr;
        }

        const state: AlphaValidState = {
          status: this._status,
          feedback: { ...fb.feedback, message },
          message,
          // Public-facing readiness MUST reflect the actual capture gate.
          isReadyToCapture: isReady,
          challenge: {
            // enabled means "liveness configured", not "has an active step right now"
            enabled: challengeEnabled,
            index: this._challengeIndex,
            total: startOptions.liveness?.challenges?.length ?? 0,
            current: currentChallenge ?? undefined,
            completed
          },
          debug: {
            faces: status.faces,
            centerX: status.centerX,
            box: status.box,
            eyeDist: status.eyeDist,
            yawProxy: status.yawProxy,
            leftEyeOpenProb: status.leftEyeOpenProb,
            rightEyeOpenProb: status.rightEyeOpenProb,
            blinkCount: this._blinkCount,
            blinkClosedNow: closedNow,
            blinkClosedThreshold: blinkClosedThr,
            // DEBUG: Exibe todos os valores de boca possíveis
            mouthDebug: {
              // status (direto do detector)
              mouthPoints: status.mouthPoints,
              mouthLeft: status.mouthLeft,
              mouthRight: status.mouthRight,
              mouthUpper: status.mouthUpper,
              mouthLower: status.mouthLower,
              mouthOpenPx: status.mouthOpenPx,
              mouthOpenNorm: status.mouthOpenNorm,
              mouthJawLeftDist: status.mouthJawLeftDist,
              mouthJawRightDist: status.mouthJawRightDist,
              // fb.debug (valores computados)
              mouthSmileRatio: (fb.debug as any)?.mouthSmileRatio,
              mouthWidthRatio: (fb.debug as any)?.mouthWidthRatio,
              mouthAvg: (fb.debug as any)?.mouthAvg,
              mouthVsJawMidRaw: (fb.debug as any)?.mouthVsJawMidRaw,
              mouthVsJawMidClamped: (fb.debug as any)?.mouthVsJawMidClamped,
              // cheese
              cheeseBaseline: (fb.debug as any)?.cheeseBaseline,
              cheeseTarget: (fb.debug as any)?.cheeseTarget,
              // openMouth
              mouthOpenRatio: (fb.debug as any)?.mouthOpenRatio,
            },
            debugDraw: {
              cheese: (options.debug as any)?.draw?.cheese ?? true
            },
            mouthAvg: (fb.debug as any)?.mouthAvg ?? null,
            jawMid: (fb.debug as any)?.jawMid ?? null,
            faceH: (fb.debug as any)?.faceH ?? null,
            mouthVsJawMidRaw: (fb.debug as any)?.mouthVsJawMidRaw ?? null,
            mouthVsJawMidClamped: (fb.debug as any)?.mouthVsJawMidClamped ?? null,
            currentStep: (fb.debug as any)?.currentStep ?? currentChallenge ?? null,
            stepPassed: (fb.debug as any)?.stepPassed,
            // NEW: hold progress for current challenge (0..1)
            challengeHoldProgress: this._challengeHoldProgress,
          } as any
        };

        this._state = state;
        startOptions.onStateChange?.(state);
        startOptions.onFeedback?.(state.feedback);

        // Sync SDK-managed manual capture button (when enabled)
        this._syncCaptureButton(state);

        // Fire auto-capture once when stable READY
        if (wantsAuto && isReady && !this._autoCaptureFired && !this._isInPreview) {
          this._autoCaptureFired = true;
          try {
            const blob = await this.capture();
            // Se onPreview estiver definido, não chama onCapture direto
            if (!startOptions.onPreview) {
              startOptions.autoCapture?.onCapture?.(blob);
            }
          } catch (e) {
            // allow retry
            this._autoCaptureFired = false;
          }
        }
        if (!isReady) this._autoCaptureFired = false;

        // IMPORTANT: always use the resolved options (with defaults) for debug/draw.
        const drawLandmarks = options.debug?.drawLandmarks === true;
        const drawCfg = options.debug?.draw;
        const anyFineDrawEnabled =
          (drawCfg?.eyes ?? false) ||
          (drawCfg?.mouth ?? false) ||
          (drawCfg?.nose ?? false) ||
          (drawCfg?.jaw ?? false) ||
          (drawCfg?.mouthJaw ?? false);

        const hint = completed ? undefined : this.mapChallengeToHint(currentChallenge, state.feedback.message);

        // Debug pose vector (analog stick):
        // x from yawProxy if available, else from centerX offset; y from centerY offset.
        const yaw = typeof status.yawProxy === 'number' ? status.yawProxy : null;
        const px =
          yaw != null
            ? Math.max(-1, Math.min(1, yaw / 0.22))
            : Math.max(-1, Math.min(1, ((status.centerX ?? 0.5) - 0.5) / 0.18));
        const py = Math.max(
          -1,
          Math.min(1, (((status.box?.y ?? 0) + (status.box?.height ?? 0) / 2 - 0.5) / 0.18))
        );
        const poseLabel = yaw != null ? 'yawProxy' : 'centerX';

        // Exibe no console o valor exato do mouthWidthRatio mostrado nos landmarks
        if (currentChallenge === 'mouthWidth') {
          const mouthWidthRatio = (state.debug as any)?.mouthWidthRatio;
          if (typeof mouthWidthRatio === 'number') {
            console.log('[AlphaValid][landmarks] mouthWidthRatio:', mouthWidthRatio);
          }
        }

        if (this._overlay) {
          // Determina se o challenge atual é zoomIn ou zoomOut
          let challengeDirection: 'zoomIn' | 'zoomOut' | undefined = undefined;
          if (currentChallenge === 'zoomIn') challengeDirection = 'zoomIn';
          if (currentChallenge === 'zoomOut') challengeDirection = 'zoomOut';

          // Coxinha mobile minimal defaults:
          // - hide the orange "pose vector" dot unless explicitly enabled
          // - hide the green progress ring unless explicitly enabled
          const isCoxinha = options.uiMode === 'Mobile';
          const extra = (options as any)?.debug?.extra ?? {};
          const showCoxinhaGuides = extra?.showCoxinhaGuides === true;
          const showCoxinhaProgress = extra?.showCoxinhaProgress === true;

          const renderMessage = this._forcedHintMessage ?? state.feedback.message;

          this._overlay.render({
            message: renderMessage,
            box: status.box,
            valid: isReady,
            hint,
            // NEW: inform overlay about zoom challenges so it can animate the hole size
            challenge: challengeDirection ? { direction: challengeDirection } : undefined,
            debug: {
              blinkClosedNow: closedNow,
              blinkClosedThreshold: blinkClosedThr,
              // Prefer the smooth UI progress for the border ring
              challengeHoldProgress: this._challengeUiProgress,
              // DEBUG: Exibe todos os valores de boca possíveis
              mouthDebug: {
                // status (direto do detector)
                mouthPoints: status.mouthPoints,
                mouthLeft: status.mouthLeft,
                mouthRight: status.mouthRight,
                mouthUpper: status.mouthUpper,
                mouthLower: status.mouthLower,
                mouthOpenPx: status.mouthOpenPx,
                mouthOpenNorm: status.mouthOpenNorm,
                mouthJawLeftDist: status.mouthJawLeftDist,
                mouthJawRightDist: status.mouthJawRightDist,
                // state.debug (valores computados)
                mouthSmileRatio: (state.debug as any)?.mouthSmileRatio,
                mouthWidthRatio: (state.debug as any)?.mouthWidthRatio,
                mouthAvg: (state.debug as any)?.mouthAvg,
                mouthVsJawMidRaw: (state.debug as any)?.mouthVsJawMidRaw,
                mouthVsJawMidClamped: (state.debug as any)?.mouthVsJawMidClamped,
                // cheese
                cheeseBaseline: (state.debug as any)?.cheeseBaseline,
                cheeseTarget: (state.debug as any)?.cheeseTarget,
                // openMouth
                mouthOpenRatio: (state.debug as any)?.mouthOpenRatio,
              },
              debugDraw: {
                cheese: (state.debug as any)?.debugDraw?.cheese
              },
              mouthAvg: (state.debug as any)?.mouthAvg ?? null,
              jawMid: (state.debug as any)?.jawMid ?? null,
              faceH: (state.debug as any)?.faceH ?? null,
              mouthVsJawMidRaw: (state.debug as any)?.mouthVsJawMidRaw ?? null,
              mouthVsJawMidClamped: (state.debug as any)?.mouthVsJawMidClamped ?? null,
              currentStep: (state.debug as any)?.currentStep ?? state.challenge?.current ?? null,
              stepPassed: (state.debug as any)?.stepPassed,
              // repassa o objeto extra do debug
              extra: options.debug?.extra
            } as any,
            video: camera.video,
            mirrored: autoMirrored,
            poseVector: isCoxinha && !showCoxinhaGuides ? undefined : { x: px, y: py, label: poseLabel },
            landmarks:
              (drawLandmarks || anyFineDrawEnabled) && !inFaceLostGrace
                ? {
                    leftEye: status.leftEyePoints,
                    rightEye: status.rightEyePoints,
                    leftEyeCenter: status.leftEyeCenter,
                    rightEyeCenter: status.rightEyeCenter,
                    noseTip: status.noseTip,
                    nosePoints: status.nosePoints,
                    mouthPoints: status.mouthPoints,
                    mouthLeft: status.mouthLeft,
                    mouthRight: status.mouthRight,
                    jawLeft: status.jawLeft,
                    jawRight: status.jawRight,
                    mouthJawLeftDist: status.mouthJawLeftDist,
                    mouthJawRightDist: status.mouthJawRightDist,
                    jawPoints: status.jawPoints,
                    jawCenter: status.jawCenter,
                    mouthUpper: status.mouthUpper,
                    mouthLower: status.mouthLower,
                    mouthOpenPx: status.mouthOpenPx,
                    mouthOpenNorm: status.mouthOpenNorm,
                    jawTopL: status.jawTopL,
                    jawTopR: status.jawTopR
                  }
                : undefined,
            landmarkDraw: drawLandmarks
              ? { eyes: true, mouth: true, nose: true, jaw: true, mouthJaw: true, cheese: true }
              : {
                  eyes: drawCfg?.eyes !== false,
                  mouth: drawCfg?.mouth !== false,
                  nose: drawCfg?.nose !== false,
                  jaw: drawCfg?.jaw !== false,
                  mouthJaw: drawCfg?.mouthJaw !== false,
                  cheese: drawCfg?.cheese === true
                }
         ,
          });
        }
      } catch (err) {
        this._status = 'error';
        const sdkErr = err as any;
        const normalized =
          sdkErr && typeof sdkErr === 'object' && typeof sdkErr.code === 'string' && typeof sdkErr.message === 'string'
            ? sdkErr
            : { code: 'CAMERA_UNKNOWN', message: 'Erro durante detecção/validação.', cause: err };
        startOptions.onError?.(normalized);
        startOptions.onStateChange?.({
          status: this._status,
          feedback: { code: 'FACE_NOT_FOUND', message: 'Centralize seu rosto' },
          message: 'Centralize seu rosto',
          isReadyToCapture: false,
          challenge: this._state?.challenge
        } as any);
      } finally {
        // Schedule next tick only if still running.
        if (this._lifecycle !== 'running') {
          this._loopActive = false;
          return;
        }

        const intervalMs = this._options?.detectionIntervalMs ?? 50;
        this._loopTimer = window.setTimeout(tick, intervalMs);
      }
    };

    void tick();
  }
}

// --- CORREÇÃO: inicializa autoMirrored como false por padrão ---
let autoMirrored = false;
// Se houver lógica para detectar espelhamento, coloque aqui
// Exemplo: autoMirrored = camera.video && getComputedStyle(camera.video).transform.includes('-1');

export type { AlphaValidStartOptions } from './types/sdk';

// Padronização de erros
function error(msg: string): Error {
  return new Error(`[AlphaValid] ${msg}`);
}