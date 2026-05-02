export type AlphaValidChallengeType =
  | 'lookForward'
  | 'lookUp'
  | 'lookDown'
  | 'lookLeft'
  | 'lookRight'
  | 'zoomIn'
  | 'zoomOut'
  | 'blink'
  | 'cheese'
  | 'openMouth'
  | 'mouthWidth';

/** Um passo de desafio (liveness) na sequência configurada. */
export interface AlphaValidChallengeStep {
  /** Tipo do desafio a ser executado pelo usuário. */
  type: AlphaValidChallengeType;
  /** Timeout (ms) opcional para este step. Ao estourar, o step é reiniciado/reativado. */
  timeoutMs?: number;
}

/**
 * Opções de validação/liveness.
 *
 * Notas importantes:
 * - Se `challenges` for informado, a sequência é executada exatamente como definida.
 * - O SDK não “injeta” `lookForward` automaticamente entre steps; se quiser, inclua como step explícito.
 * - Alguns desafios requerem landmarks (ex.: `blink`); o SDK solicita landmarks automaticamente quando há um step ativo.
 */
export interface AlphaValidLivenessOptions {
  /**
   * Força look-forward como regra global (para todos os frames).
   * Recomendação: prefira usar `challenges: [{ type: 'lookForward' }]` quando quiser um passo explícito.
   */
  requireLookForward?: boolean;

  /** Sequência opcional de desafios. Quando presente, determina o progresso de `state.challenge`. */
  challenges?: AlphaValidChallengeStep[];

  /** 0..1: controla sensibilidade geral (quando omitido, defaults internos são derivados). */
  strictness?: number;

  /** 0..1. Maior = mais tolerante no lookForward (mais fácil passar). */
  lookForwardTolerance?: number;

  /** Tolerância (normalizada) de centralização para lookForward usando bbox/centerX. */
  lookForwardCenterTol?: number;

  /**
   * Tolerância de yaw para lookForward quando `yawProxy` (landmarks) está disponível.
   * Menor = mais estrito. Default é derivado de `strictness`.
   */
  lookForwardYawTol?: number;

  /**
   * Período de graça (ms) após o rosto desaparecer antes de emitir FACE_NOT_FOUND.
   * Durante essa janela, landmarks no overlay podem ser ocultados para evitar pontos “stale”.
   * Default: 900
   */
  faceLostGraceMs?: number;

  /**
   * LookForward via geometria boca/mandíbula.
   * Se informado, pode ter precedência sobre yawProxy/centerX dependendo da implementação.
   * Unidades: pixels do frame de vídeo.
   */
  lookForwardJawMouthDistMinPx?: number;
  lookForwardJawMouthDistMaxPx?: number;

  /** Tolerância (0..1, normalizado) para o eixo Y da boca vs jawMid ser considerado neutro. */
  lookForwardMouthVsJawMidYAbsTol?: number;

  /**
   * Por quanto tempo (ms) o lookForward deve permanecer ok para ser aceito como stepOk.
   * Default: 1000
   */
  lookForwardHoldMs?: number;

  /** Tolerância para lookLeft/lookRight quando usando sinais simples (centerX etc). */
  lookSideTol?: number;

  /** Tolerância para lookUp/lookDown quando usando sinais simples (centerY/box). */
  lookUpDownTol?: number;

  zoomInMinArea?: number;
  zoomOutMaxArea?: number;

  /**
   * Threshold de “olhos fechados” para blink.
   * Observação: como os valores de eye open prob aqui normalmente não chegam a 0, o default é mais alto.
   * Default: 0.65 (mais sensível)
   */
  blinkClosedThreshold?: number;

  /** Threshold de “olhos abertos” para armar o blink (evita completar com olhos semicerrados). */
  blinkOpenThreshold?: number;

  /** Tempo mínimo (ms) que um challenge deve permanecer válido para ser aceito. Default: 150 */
  challengeMinHoldMs?: number;

  /** Delay mínimo (ms) depois de completar um challenge antes que o próximo possa completar. Default: 400 */
  challengeCooldownMs?: number;

  /**
   * Threshold (delta) para sorriso (cheese).
   *
   * Quando `cheeseUseBaseline === true` (default), o SDK calcula um baseline do usuário (boca neutra)
   * e considera “sorrindo” quando:
   * `mouthSmileRatio >= (cheeseBaseline + cheeseThreshold)`
   *
   * Menor = mais sensível.
   * Default: 0.05 (delta acima do baseline, mais sensível)
   */
  cheeseThreshold?: number;

  /**
   * Se `true` (default), calibra um baseline de sorriso por usuário (boca neutra) e valida por delta.
   * Se `false`, valida por threshold absoluto (sem baseline).
   * Default: true
   */
  cheeseUseBaseline?: boolean;

  /**
   * Janela (ms) para coletar baseline neutro do sorriso após iniciar ou ao entrar no step `cheese`.
   * Default: 1200
   */
  cheeseBaselineWindowMs?: number;

  /**
   * Quantidade mínima de amostras para aceitar um baseline.
   * Default: 8
   */
  cheeseBaselineMinSamples?: number;

  /** Threshold (0..1) para boca aberta. Maior = exige abrir mais. Default: 0.5 (mais permissivo) */
  openMouthThreshold?: number;

  /** Progresso (0..1) para aceitar pose challenges. Default: 0.65 */
  poseProgressAccept?: number;

  /** Por quanto tempo (ms) pode reutilizar o último status bom durante head-turns quando a detecção oscila. Default: 900 */
  poseGraceMs?: number;

  /** Define a semântica esquerda/direita quando o preview é espelhado. Default: 'mirrored'. */
  mirrorMode?: 'mirrored' | 'raw';

  /**
   * Threshold (ratio) para assimetria boca<->mandíbula em lookLeft/lookRight quando `poseProgressSource` usa mouthJaw.
   * Default: 0.12 (≈12%).
   */
  lookSideRatioThr?: number;

  /** Delta absoluto mínimo (ratio/unidade interna) entre lados em mouthJaw para evitar passar por jitter. Default: 0.10 */
  lookSideAbsDeltaThr?: number;

  /**
   * Seleciona qual sinal será usado para computar progresso de pose.
   * - 'auto' (default): yawProxy -> mouthJaw -> centerX
   * - 'yawProxy': landmarks yawProxy (fallback p/ centerX)
   * - 'mouthJaw': assimetria mouth<->jaw (fallback p/ centerX)
   * - 'centerX': apenas bbox/centerX
   */
  poseProgressSource?: 'auto' | 'yawProxy' | 'mouthJaw' | 'centerX';

  /** Thresholds absolutos para validação estrita via mouthJaw. */
  lookSideNearThr?: number;
  lookSideFarThr?: number;

  /**
   * Quanto tempo (ms) o usuário deve manter lookForward quando ele aparece como gate neutro no fluxo.
   * Default: 350
   */
  neutralHoldMs?: number;
}

export type AlphaValidErrorCode =
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_NOT_READABLE'
  | 'CAMERA_OVERCONSTRAINED'
  | 'CAMERA_NOT_SUPPORTED'
  | 'CAMERA_UNKNOWN'
  | 'MODEL_LOAD_FAILED'
  | 'MODEL_LOAD_TIMEOUT';

export interface AlphaValidSdkError {
  code: AlphaValidErrorCode;
  message: string;
  cause?: unknown;
}

export type AlphaValidStatus = 'idle' | 'initializing' | 'running' | 'ready' | 'error';

export type AlphaValidFeedbackCode =
  | 'INITIALIZING'
  | 'FACE_NOT_FOUND'
  | 'MULTIPLE_FACES'
  | 'FACE_TOO_FAR'
  | 'FACE_TOO_CLOSE'
  | 'FACE_OFF_CENTER'
  | 'LOOK_FORWARD'
  | 'LOOK_UP'
  | 'LOOK_DOWN'
  | 'LOOK_LEFT'
  | 'LOOK_RIGHT'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'BLINK'
  | 'CHEESE'
  | 'OPEN_MOUTH'
  | 'READY';

export type AlphaValidFeedbackMessage =
  | 'Inicializando câmera...'
  | 'Centralize seu rosto'
  | 'Aproxime o rosto'
  | 'Afaste o rosto'
  | 'Ajuste a iluminação'
  | 'Apenas 1 rosto por vez'
  | 'Rosto detectado'
  | 'Pronto para capturar'
  | 'Olhe para a câmera'
  | 'Olhe para cima'
  | 'Olhe para baixo'
  | 'Olhe para a esquerda'
  | 'Olhe para a direita'
  | 'Aproxime-se da câmera'
  | 'Afaste-se da câmera'
  | 'Pisque'
  | 'Sorria'
  | 'Abra a boca';

export type AlphaValidFeedback = {
  code: AlphaValidFeedbackCode;
  message: AlphaValidFeedbackMessage | string;
};

export interface AlphaValidState {
  /** Estado de alto nível do SDK (idle/initializing/running/ready/error). */
  status: AlphaValidStatus;

  /** Feedback atual (código + mensagem) para UX. */
  feedback: AlphaValidFeedback;

  /** Alias textual para UX (atualmente igual a feedback.message). */
  message: string;

  /** Indica se o SDK considera o frame pronto para captura (após liveness, se configurado). */
  isReadyToCapture: boolean;

  /** Progresso de desafios (quando `liveness.challenges` está ativo). */
  challenge?: {
    enabled: boolean;
    /** Índice atual na lista de desafios (0..total). */
    index: number;
    /** Total de passos configurados. */
    total: number;
    /** Step atual (quando ainda não completou todos). */
    current?: AlphaValidChallengeType;
    /** True quando não há step ativo (sequência concluída). */
    completed: boolean;
  };

  /** Informações de debug (opcionais) para diagnóstico e overlay. */
  debug?: {
    faces?: number;
    centerX?: number;
    box?: { x: number; y: number; width: number; height: number };
    eyeDist?: number;
    yawProxy?: number;
    leftEyeOpenProb?: number;
    rightEyeOpenProb?: number;

    /** Qual sinal foi usado para o progresso de pose (yawProxy | mouthJaw | centerX). */
    poseProgressSource?: 'yawProxy' | 'mouthJaw' | 'centerX';

    /** Debug interno do motor de validação/feedback (thresholds, razões, valores intermediários). */
    fb?: any;

    /** 0..1 progressos para desafios de pose. */
    progress?: {
      lookLeft?: number;
      lookRight?: number;
      lookUp?: number;
      lookDown?: number;
    };

    /** Sorriso (cheese): width/height da boca (heurística). */
    mouthSmileRatio?: number;

    /** Sorriso (cheese): baseline neutro (por usuário/sessão), quando `cheeseUseBaseline` está habilitado. */
    cheeseBaseline?: number;

    /** Sorriso (cheese): alvo calculado (baseline + delta) quando aplicável. */
    cheeseTarget?: number;

    /** Tempo (ms) que o lookForward deve ser mantido para ser aceito. */
    lookForwardHoldMs?: number;
    /** Tempo (ms) já mantido dentro dos critérios principais do lookForward. */
    lookForwardHeldMs?: number;
    /** Timestamp (ms) do início do hold do lookForward (ou null se não está segurando). */
    lookForwardOkSince?: number | null;

    /** 0..1: progresso do hold do challenge atual (para UX/overlay). */
    challengeHoldProgress?: number;
  };
}

export interface AlphaValidStartOptions {
  /**
   * Container onde o SDK vai montar o vídeo e (opcionalmente) o overlay.
   * Se omitido, usa o elemento com id 'cameraContainer'.
   */
  container?: HTMLElement;

  /** Preset de liveness de alto nivel (sem precisar mexer em todos os thresholds). */
  livenessPreset?: 'easy' | 'normal' | 'strict';

  /** Callback chamado quando câmera/overlay (se houver) estão prontos e modelos foram carregados. */
  onReady?: () => void;

  /** Callback leve: emite o feedback atual (ideal para textos/UI do app). */
  onFeedback?: (feedback: AlphaValidFeedback) => void;

  /** Callback de erro normalizado. */
  onError?: (error: AlphaValidSdkError) => void;

  /** Controla se o overlay deve ser renderizado. Default: true (quando `uiMode` não é headless). */
  overlay?: boolean;

  /** Proporção do círculo guia (0..1). Default: 0.72 */
  guideCircleRatio?: number;

  /** Intervalo (ms) entre detecções. Default: 50 */
  detectionIntervalMs?: number;

  /** Caminho público (URL) de onde os models do face-api serão carregados. Default: '/assets/kyc-face-models' */
  modelsPath?: string;

  /** Opções de liveness/heurísticas e sequência de desafios. */
  liveness?: AlphaValidLivenessOptions;

  /**
   * Exige um "lookForward" válido (checar se está olhando para a câmera) no momento de habilitar captura.
   * - Quando true, o botão de captura (manual) só habilita se o usuário estiver alinhado/olhando para frente.
   * - Quando true, o autoCapture só dispara se o usuário estiver alinhado/olhando para frente.
   *
   * Observação: esta validação é intencionalmente simples e independente da pipeline de challenges.
   * Default: false
   */
  requireLookForwardForCapture?: boolean;

  /**
   * Callback completo do estado (status + debug + challenge progress). */
  onStateChange?: (state: AlphaValidState) => void;

  /** Modo UI: 'headless' desabilita overlay. */
  uiMode?: 'default' | 'headless' | 'Mobile';

  /** Debug do SDK. */
  debug?: {
    /** Se true, solicita landmarks ao detector e desenha no overlay (custo maior). */
    drawLandmarks?: boolean;

    /**
     * Toggles finos para o desenho de landmarks no overlay.
     * Se omitido, `drawLandmarks` controla tudo (comportamento antigo).
     */
    draw?: {
      /** Mostra pontos/centros dos olhos. */
      eyes?: boolean;
      /** Mostra polilinha/pontos da boca. */
      mouth?: boolean;
      /** Mostra nariz (ponta + linha) quando disponível. */
      nose?: boolean;
      /** Mostra a jaw line (polilinha). */
      jaw?: boolean;
      /** Mostra linhas/labels mouth<->jaw (diagnóstico). */
      mouthJaw?: boolean;

      /** Mostra/oculta as linhas de debug do sorriso (cheese) no painel do overlay. */
      cheese?: boolean;
    };
    /**
     * Campo extra para flags customizadas de debug (ex: showOverlayTable).
     */
    extra?: any;
  };

  /**
   * Auto-capture embutido: espera `READY` + estabilidade, captura 1x e chama `onCapture`.
   * Útil para evitar duplicar lógica de estabilidade no app consumidor.
   */
  autoCapture?: {
    enabled?: boolean;
    /** Tempo mínimo (ms) que o rosto deve ficar estável antes de capturar. Default: 650 */
    stableMs?: number;
    /** Mensagem exibida enquanto segura estabilidade (quando aplicável). */
    holdStillMessage?: string;
    /** Callback disparado com o Blob (JPEG) assim que capturar. */
    onCapture?: (blob: Blob) => void;
  };

  /**
   * Botão de captura manual gerenciado pelo SDK.
   * - Default: enabled (true)
   * - Quando `autoCapture.enabled === false`, o SDK pode exibir um botão para o usuário capturar.
   */
  captureButton?: {
    enabled?: boolean;
    /** Texto do botão. Default: 'Capturar imagem' */
    text?: string;
    /** Cor de fundo (CSS color). Default: '#00bcd4' */
    color?: string;
  };

  /**
   * Callback chamado após uma captura (manual ou auto), antes de finalizar o fluxo.
   * Recebe o blob da foto e ações para retomar ou confirmar.
   */
  onPreview?: (blob: Blob, actions: { retake: () => void; confirm: () => void }) => void;

  /**
   * Ativa o preview "fácil" gerenciado pelo SDK (UI + botões OK/Recapturar).
   * - Só será aplicado quando `uiMode === 'Mobile'`.
   * - Quando true, o SDK mostra o preview após qualquer captura (manual ou auto)
   *   e resolve OK/Recapturar internamente.
   */
  userPreview?: boolean;

  /**
   * Callback disparado quando o usuário confirma (OK) no `userPreview`.
   * Observação: só é chamado quando `userPreview === true`.
   */
  onUserPreviewConfirm?: (blob: Blob) => void;

  /** Texto do botão OK no preview (default: 'OK'). */
  previewOkText?: string;

  /** Texto do botão "Tirar outra" no preview (default: 'Tirar outra'). */
  previewRetakeText?: string;

  /**
   * Loader do SDK (spinner sobre o container enquanto inicializa câmera/models).
   * Defina `src` apenas se quiser sobrepor com imagem/GIF.
   */
  loader?: {
    enabled?: boolean;
    /** URL opcional de imagem/GIF do loader (omitir = apenas spinner). */
    src?: string;
    /** Tamanho (px). Default: 120 */
    sizePx?: number;
    /** Tempo mínimo visível (ms). Default: 900 */
    minVisibleMs?: number;
  };
}

export interface FaceDetectionStatus {
  faces: number;
  box?: { x: number; y: number; width: number; height: number };

  centerX?: number;
  area?: number;

  leftEyeOpenProb?: number;
  rightEyeOpenProb?: number;
  leftEyeCenter?: { x: number; y: number };
  rightEyeCenter?: { x: number; y: number };
  eyeDist?: number;

  /** Best-effort yaw proxy from landmarks: (noseX - eyeMidX) / interOcularDistance. */
  yawProxy?: number;

  /** Mouth corners (normalized video space). */
  mouthLeft?: { x: number; y: number };
  mouthRight?: { x: number; y: number };

  /** Jaw side points (normalized video space). */
  jawLeft?: { x: number; y: number };
  jawRight?: { x: number; y: number };

  /** Distances between mouth corners and jaw sides, normalized by inter-ocular distance (scale invariant). */
  mouthJawLeftDist?: number;
  mouthJawRightDist?: number;

  /** Absolute distances (in pixels of the underlying video frame). */
  mouthJawLeftDistPx?: number;
  mouthJawRightDistPx?: number;

  leftEyePoints?: Array<{ x: number; y: number }>;
  rightEyePoints?: Array<{ x: number; y: number }>;
  noseTip?: { x: number; y: number };
  nosePoints?: Array<{ x: number; y: number }>;
  mouthPoints?: Array<{ x: number; y: number }>;
  jawPoints?: Array<{ x: number; y: number }>;
  jawCenter?: { x: number; y: number };

  /** Pontos centrais do lábio superior (51) e inferior (57) (normalized video space). */
  mouthUpper?: { x: number; y: number };
  mouthLower?: { x: number; y: number };
  /** Distância vertical absoluta (px) e normalizada por eyeDist entre lábio superior e inferior. */
  mouthOpenPx?: number;
  mouthOpenNorm?: number;

  /** Jaw top points (normalized video space). */
  jawTopL?: { x: number; y: number };
  jawTopR?: { x: number; y: number };

  poseSource?: 'landmarks' | 'bbox';
}
