import type {
  AlphaValidFeedback,
  AlphaValidFeedbackCode,
  AlphaValidLivenessOptions,
  AlphaValidChallengeType,
  FaceDetectionStatus
} from '../types/sdk';
import { clamp, clamp01 } from '../utils/canvas';

export interface FeedbackResult {
  feedback: AlphaValidFeedback;
  valid: boolean;
  frameOk: boolean;
  stepOk: boolean;
  debug?: {
    strict: number;
    lfTol: number;
    forwardTol: number;
    lookSideTol: number;
    lookUpDownTol: number;
    ratio: number;
    eyeDist: number;
    noseDx: number | null;
    yawProxy?: number;
    lookForwardYawTol?: number;
    leftEyeOpenProb?: number;
    rightEyeOpenProb?: number;
    blinkClosedThreshold?: number;
    blinkIsClosed?: boolean;
    mouthSmileRatio?: number;
    cheeseThreshold?: number;
    mouthOpenRatio?: number;
    openMouthThreshold?: number;

    // extra pose/challenge debug
    cx?: number;
    cy?: number;
    centerTol?: number;
    lookForwardOk?: boolean;
    lookLeftDx?: number;
    lookRightDx?: number;
    lookUpDy?: number;
    lookDownDy?: number;
    lookLeftRatio?: number;
    lookRightRatio?: number;
    lookLeftRule?: string;
    lookRightRule?: string;
    lookLeftActualTarget?: string;
    lookRightActualTarget?: string;

    // continuous challenge progress (0..1)
    lookLeftProgress?: number;
    lookRightProgress?: number;
    lookUpProgress?: number;
    lookDownProgress?: number;

    /** Which signal was used for pose progress (yawProxy | mouthJaw | centerX). */
    poseProgressSource?: 'yawProxy' | 'mouthJaw' | 'centerX';

    // mouth<->jaw debug
    mouthJawLeftDist?: number;
    mouthJawRightDist?: number;
    mouthJawSigned?: number;
    mouthJawThr?: number;
    mouthJawRatioNormLeft?: number;
    mouthJawRatioNormRight?: number;
    mouthJawRatioNowLeftOverRight?: number;
    mouthJawRatioNowRightOverLeft?: number;
    mouthJawRatioBaseLeftOverRight?: number;
    mouthJawRatioBaseRightOverLeft?: number;

    // baseline debug
    mouthJawBaselineLeft?: number;
    mouthJawBaselineRight?: number;
    mouthJawDeltaLeft?: number;
    mouthJawDeltaRight?: number;
    mouthJawAbsDelta?: number;
    mouthJawAbsDeltaThr?: number;

    // mouth/jaw diagnostic metrics (requested)
    mouthAvg?: { x: number; y: number } | null;
    jawMid?: { x: number; y: number } | null;
    faceH?: number | null;
    mouthVsJawMidRaw?: number | null;
    mouthVsJawMidClamped?: number | null;

    // step diagnostics
    currentStep?: AlphaValidChallengeType | null;
    stepPassed?: boolean;
    lookForwardOkInstant?: boolean;
    lookForwardHeld?: boolean;
    lookForwardHoldMs?: number;
    lookForwardHeldMs?: number;
    // --- NOVOS CAMPOS PARA LOOKFORWARD ---
    jawTopL?: { x: number; y: number };
    jawTopR?: { x: number; y: number };
    leftEyeCenter?: { x: number; y: number };
    rightEyeCenter?: { x: number; y: number };
    jawEyeDistL?: number;
    jawEyeDistR?: number;
    jawEyeDistDiff?: number;
    jawEyeDistRelDiff?: number;
    jawEyeRelTol?: number;
    yOk?: boolean;
    distOk?: boolean;
    lookForwardOkSince?: number | null;
  };
}

function fb(code: AlphaValidFeedbackCode, message: string): AlphaValidFeedback {
  return { code, message };
}

function smooth01(prev: number | undefined, next: number, alpha: number) {
  const prevVal = typeof prev === 'number' ? prev : 0;
  return clamp01(prevVal + (next - prevVal) * clamp(alpha, 0, 1));
}

function getStrict(options?: AlphaValidLivenessOptions) {
  return clamp01(options?.strictness ?? 0.5);
}

function getLookForwardTol(options?: AlphaValidLivenessOptions) {
  const strict = getStrict(options);
  const tol = options?.lookForwardTolerance;
  if (typeof tol === 'number') return clamp01(tol);
  return clamp01(1 - strict);
}

export function computeFeedback(
  status: FaceDetectionStatus,
  liveness?: AlphaValidLivenessOptions & {
    // provided by index.ts at runtime
    mouthJawBaselineLeft?: number;
    mouthJawBaselineRight?: number;

    // runtime hold state for lookForward
    lookForwardOkSince?: number | null;
  },
  challenge?: { current?: AlphaValidChallengeType | null }
): FeedbackResult {
  const inChallenge = !!challenge?.current;
  const currentStep = (challenge?.current ?? null) as AlphaValidChallengeType | null;

  // If the preview is mirrored (selfie UX), swap left/right semantics.
  // Default to mirrored to match the SDK preview transform.
  const mirrorMode = liveness?.mirrorMode ?? 'mirrored';
  const isMirrored = mirrorMode === 'mirrored';

  if (status.faces === 0) {
    return { feedback: fb('FACE_NOT_FOUND', 'Centralize seu rosto'), valid: false, frameOk: false, stepOk: false };
  }

  if (status.faces > 1) {
    return { feedback: fb('MULTIPLE_FACES', 'Apenas 1 rosto por vez'), valid: false, frameOk: false, stepOk: false };
  }

  if (!status.box) {
    return { feedback: fb('FACE_NOT_FOUND', 'Centralize seu rosto'), valid: false, frameOk: false, stepOk: false };
  }

  const strict = getStrict(liveness);
  const lfTol = getLookForwardTol(liveness);

  const { x, y, width, height } = status.box;
  const cx = x + width / 2;
  const cy = y + height / 2;

  // Prefer detector-provided centerX if present (landmarks path sets it).
  const centerX = status.centerX ?? cx;
  const centerY = cy;

  const faceArea = status.area ?? width * height;
  const ratio = width / Math.max(1e-6, height);

  // Size thresholds
  const minArea = 0.07 + strict * 0.02;
  const maxArea = 0.22 - strict * 0.03;

  // Centering thresholds
  const centerTol = 0.12 - strict * 0.03 + (inChallenge ? 0.16 : 0);

  // Challenge thresholds
  const lookSideTol = liveness?.lookSideTol ?? (0.18 - strict * 0.05);
  const lookUpDownTol = liveness?.lookUpDownTol ?? (0.12 - strict * 0.03);

  const zoomInMinArea = liveness?.zoomInMinArea ?? (0.16 + strict * 0.02);
  const zoomOutMaxArea = liveness?.zoomOutMaxArea ?? (0.12 - strict * 0.02);

  // NEW: Avoid conflicting instructions during zoom challenges.
  // When current step is zoomIn/zoomOut, do NOT run the generic size/center early-returns,
  // otherwise the user sees alternating messages (e.g. "Aproxime-se" vs "Aproxime o rosto").
  if (currentStep === 'zoomIn') {
    const ok = faceArea >= zoomInMinArea;
    // Progress should start increasing as the user gets closer to the target area.
    // 0 when at/under zoomOutMaxArea, 1 when reaching zoomInMinArea (then stays 1).
    const zoomProgress = clamp01((faceArea - zoomOutMaxArea) / Math.max(1e-6, zoomInMinArea - zoomOutMaxArea));
    return {
      feedback: fb('ZOOM_IN', ok ? 'Mantenha...' : 'Aproxime-se da câmera'),
      valid: ok,
      frameOk: true,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol: 0,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist: status.eyeDist ?? 0,
        noseDx: status.noseTip ? status.noseTip.x - centerX : null,
        cx,
        cy,
        centerTol,
        faceArea,
        zoomInMinArea,
        zoomOutMaxArea,
        zoomProgress
      } as any
    };
  }

  if (currentStep === 'zoomOut') {
    const ok = faceArea <= zoomOutMaxArea;
    // Progress should start increasing as the user gets closer to being far enough.
    // 0 when at/above zoomInMinArea, 1 when reaching zoomOutMaxArea (then stays 1).
    const zoomProgress = clamp01((zoomInMinArea - faceArea) / Math.max(1e-6, zoomInMinArea - zoomOutMaxArea));
    return {
      feedback: fb('ZOOM_OUT', ok ? 'Mantenha...' : 'Afaste-se da câmera'),
      valid: ok,
      frameOk: true,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol: 0,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist: status.eyeDist ?? 0,
        noseDx: status.noseTip ? status.noseTip.x - centerX : null,
        cx,
        cy,
        centerTol,
        faceArea,
        zoomInMinArea,
        zoomOutMaxArea,
        zoomProgress
      } as any
    };
  }

  // Blink threshold: eye open probabilities here typically don't reach 0.
  // Treat "closed" as both eyes below this threshold.
  const blinkThr = liveness?.blinkClosedThreshold ?? 0.65; // mais sensível
  const cheeseThr = liveness?.cheeseThreshold ?? 0.05; // mais sensível
  const openMouthThr = liveness?.openMouthThreshold ?? 0.5; // mais permissivo

  const eyeDist = status.eyeDist ?? 0;
  const noseDx = status.noseTip ? status.noseTip.x - centerX : null;

  const forwardTolBase = 0.10 - strict * 0.02;
  const forwardTol =
    typeof liveness?.lookForwardCenterTol === 'number'
      ? clamp01(liveness.lookForwardCenterTol)
      : clamp01(forwardTolBase + lfTol * 0.08);

  if (faceArea < minArea) {
    return {
      feedback: fb('FACE_TOO_FAR', 'Aproxime o rosto'),
      valid: false,
      frameOk: false,
      stepOk: false,
      debug: { strict, lfTol, forwardTol, lookSideTol, lookUpDownTol, ratio, eyeDist, noseDx }
    };
  }
  if (faceArea > maxArea) {
    return {
      feedback: fb('FACE_TOO_CLOSE', 'Afaste o rosto'),
      valid: false,
      frameOk: false,
      stepOk: false,
      debug: { strict, lfTol, forwardTol, lookSideTol, lookUpDownTol, ratio, eyeDist, noseDx }
    };
  }

  if (Math.abs(cx - 0.5) > centerTol || Math.abs(cy - 0.5) > centerTol) {
    return {
      feedback: fb('FACE_OFF_CENTER', 'Centralize seu rosto'),
      valid: false,
      frameOk: false,
      stepOk: false,
      debug: { strict, lfTol, forwardTol, lookSideTol, lookUpDownTol, ratio, eyeDist, noseDx }
    };
  }

  // Look-forward (STRICT per request): ONLY validated when current step is 'lookForward'.
  // Criteria (ONLY these 3 checks):
  // 1) mouthJawLeftDistPx  in (500..1000)
  // 2) mouthJawRightDistPx in (500..1000)
  // 3) (jawMid.y - mouthAvg.y) / faceH within [-0.5..+0.5]
  // Additionally must be held for >= 1000ms.
  const ml = status.mouthLeft;
  const mr = status.mouthRight;
  const jl = status.jawLeft;
  const jr = status.jawRight;

  const mouthAvg = ml && mr ? { x: (ml.x + mr.x) / 2, y: (ml.y + mr.y) / 2 } : null;
  const jawMid = jl && jr ? { x: (jl.x + jr.x) / 2, y: (jl.y + jr.y) / 2 } : null;

  const faceH = status.box?.height ?? null;
  const mouthVsJawMidRaw =
    mouthAvg && jawMid && typeof faceH === 'number' && faceH > 1e-6 ? (jawMid.y - mouthAvg.y) / faceH : null;
  const mouthVsJawMidClamped = mouthVsJawMidRaw != null ? clamp(mouthVsJawMidRaw, -1, 1) : null;

  const dLpx = typeof status.mouthJawLeftDistPx === 'number' ? status.mouthJawLeftDistPx : null;
  const dRpx = typeof status.mouthJawRightDistPx === 'number' ? status.mouthJawRightDistPx : null;

  const distMinPx = 500;
  const distMaxPx = 1000;

  const jawMouthDistOk =
    dLpx != null && dRpx != null ? dLpx > distMinPx && dLpx < distMaxPx && dRpx > distMinPx && dRpx < distMaxPx : false;

  const yNeutralOk = mouthVsJawMidRaw != null ? mouthVsJawMidRaw >= -0.5 && mouthVsJawMidRaw <= 0.5 : false;

  const lookForwardOkInstant = jawMouthDistOk && yNeutralOk;

  const lookForwardHoldMs = 1000;
  const since = typeof liveness?.lookForwardOkSince === 'number' ? liveness.lookForwardOkSince : null;
  const lookForwardHeld = lookForwardOkInstant && since != null ? Date.now() - since >= lookForwardHoldMs : false;
  const lookForwardOk = lookForwardHeld;

  // IMPORTANT: do not block globally by default; only enforce lookForward when it's the current challenge step.
  const enforceLookForwardGlobally = false;

  if (enforceLookForwardGlobally && !lookForwardOk) {
    return {
      feedback: fb('LOOK_FORWARD', 'Olhe para a câmera'),
      valid: false,
      frameOk: false,
      stepOk: false
    };
  }

  const frameOk = true;

  const current = challenge?.current ?? null;
  if (!current) {
    return {
      feedback: fb('READY', 'Pronto para capturar'),
      valid: true,
      frameOk,
      stepOk: true,
      debug: { strict, lfTol, forwardTol, lookSideTol, lookUpDownTol, ratio, eyeDist, noseDx }
    };
  }

  // Pose acceptance knobs
  const poseAccept = clamp01(liveness?.poseProgressAccept ?? 0.65);

  // Pose progress (lookLeft/lookRight) based strictly on mouth<->jaw distances.
  const mjL = typeof status.mouthJawLeftDist === 'number' ? status.mouthJawLeftDist : null;
  const mjR = typeof status.mouthJawRightDist === 'number' ? status.mouthJawRightDist : null;

  const bL = typeof liveness?.mouthJawBaselineLeft === 'number' ? liveness.mouthJawBaselineLeft : null;
  const bR = typeof liveness?.mouthJawBaselineRight === 'number' ? liveness.mouthJawBaselineRight : null;

  const hasMouthJaw = mjL != null && mjR != null;
  const hasBaseline = bL != null && bR != null;

  // Deltas: when turning LEFT (raw coords):
  //   right distance decreases (deltaR negative)
  //   left distance increases  (deltaL positive)
  const dL = hasMouthJaw && hasBaseline ? mjL! - bL! : null;
  const dR = hasMouthJaw && hasBaseline ? mjR! - bR! : null;

  // STRICT RULES requested by user:
  // - lookLeft:  mjL < nearThr  AND mjR > farThr
  // - lookRight: mjR < nearThr  AND mjL > farThr
  // These are absolute thresholds in normalized units (mouthJaw dist is normalized by inter-ocular distance).
  const nearThr = liveness?.lookSideNearThr ?? 0.30;
  const farThr = liveness?.lookSideFarThr ?? 1.00;

  // NOTE: mjL/mjR are computed in raw video coords. If preview is mirrored, swap semantics.
  const effL = hasMouthJaw ? (isMirrored ? mjR! : mjL!) : null;
  const effR = hasMouthJaw ? (isMirrored ? mjL! : mjR!) : null;

  const leftOkStrict = effL != null && effR != null && effL < nearThr && effR > farThr;
  const rightOkStrict = effL != null && effR != null && effR < nearThr && effL > farThr;

  // NEW: continuous progress for lookLeft/lookRight (0..1).
  // We treat each strict constraint as a partial progress, then combine with min().
  // - For "near" constraint (x < nearThr), progress is 0 when x >= farThr, 1 when x <= nearThr.
  // - For "far" constraint  (x > farThr),  progress is 0 when x <= nearThr, 1 when x >= farThr.
  // This makes progress increase smoothly as the user approaches the strict target.
  const sideSpan = Math.max(1e-6, farThr - nearThr);
  const nearSideProgress = (v: number) => clamp01((farThr - v) / sideSpan);
  const farSideProgress = (v: number) => clamp01((v - nearThr) / sideSpan);

  const leftProgress =
    effL != null && effR != null ? Math.min(nearSideProgress(effL), farSideProgress(effR)) : 0;
  const rightProgress =
    effL != null && effR != null ? Math.min(nearSideProgress(effR), farSideProgress(effL)) : 0;

  const poseProgressSource: 'yawProxy' | 'mouthJaw' | 'centerX' = 'mouthJaw';

  // NOTE: we already applied mirroring when computing effL/effR, so DO NOT swap again here

  // lookUp / lookDown signal:
  // Use the continuous mouth-vs-jawMid signal directly (not just its sign).
  // +1 => strong up, -1 => strong down, ~0 => neutral.
  const upDownSignal = mouthVsJawMidClamped != null ? mouthVsJawMidClamped : null;

  // Make up/down behave like other pose challenges: compute continuous progress 0..1,
  // and only pass when it reaches 1 (with epsilon).
  const fullScaleEps =
    typeof (liveness as any)?.lookUpDownFullScaleEps === 'number' ? (liveness as any).lookUpDownFullScaleEps : 0.02;

  // Threshold where progress becomes 1. Default is very strict (needs to hit the clamp edge),
  // but we expose it to allow tuning if needed.
  const upDownFullThr =
    typeof (liveness as any)?.lookUpDownFullThr === 'number' ? clamp((liveness as any).lookUpDownFullThr, 0.1, 1) : 1;

  const upProgress =
    upDownSignal != null && upDownSignal > 0 ? clamp01((upDownSignal - 0) / Math.max(1e-6, upDownFullThr)) : 0;
  const downProgress =
    upDownSignal != null && upDownSignal < 0 ? clamp01(((-upDownSignal) - 0) / Math.max(1e-6, upDownFullThr)) : 0;

  const upFull = upProgress >= 1 - fullScaleEps;
  const downFull = downProgress >= 1 - fullScaleEps;

  if (current === 'lookForward') {
    // Critério: altura da boca vs jawMid "média" e distâncias jawTopL→eyeL e jawTopR→eyeR "médias" (parecidas)
    const jawTopL = (status as any).jawTopL;
    const jawTopR = (status as any).jawTopR;
    const leftEyeCenter = (status as any).leftEyeCenter;
    const rightEyeCenter = (status as any).rightEyeCenter;
    let distL = undefined, distR = undefined, distDiff = undefined, distRelDiff = undefined;
    if (jawTopL && leftEyeCenter && jawTopR && rightEyeCenter) {
      distL = Math.hypot(jawTopL.x - leftEyeCenter.x, jawTopL.y - leftEyeCenter.y);
      distR = Math.hypot(jawTopR.x - rightEyeCenter.x, jawTopR.y - rightEyeCenter.y);
      distDiff = Math.abs(distL - distR);
      const maxDist = Math.max(distL, distR, 1e-6);
      distRelDiff = distDiff / maxDist;
    }
    // Critérios principais
    const yOk = mouthVsJawMidRaw != null ? mouthVsJawMidRaw >= -0.5 && mouthVsJawMidRaw <= 0.5 : false;
    const distOk = typeof distRelDiff === 'number' ? distRelDiff <= 0.25 : false;
    // Margem extra para tolerar pequenos movimentos
    const yOkMargin = mouthVsJawMidRaw != null ? mouthVsJawMidRaw >= -0.6 && mouthVsJawMidRaw <= 0.6 : false;
    const distOkMargin = typeof distRelDiff === 'number' ? distRelDiff <= 0.30 : false;
    const allOkInstant = yOk && distOk;
    const allOkMargin = yOkMargin && distOkMargin;

    // Hold logic com tolerância
    const holdMs = typeof liveness?.lookForwardHoldMs === 'number' ? liveness.lookForwardHoldMs : 1000;
    let since = typeof liveness?.lookForwardOkSince === 'number' ? liveness.lookForwardOkSince : null;
    if (!allOkMargin) {
      since = null; // saiu da margem, reinicia hold
    } else if (allOkInstant && since == null) {
      since = Date.now(); // entrou nos critérios, inicia hold
    }
    // Não resetar since ao completar o hold, só quando sair da margem!
    const heldMs = allOkInstant && since != null ? Date.now() - since : 0;
    const held = allOkInstant && since != null ? heldMs >= holdMs : false;

    // Mensagens:
    // - Fora da margem: instrução clara para alinhar/olhar para frente.
    // - Dentro da margem mas ainda não segurou: "Mantenha".
    // - Completo: pronto.
    let feedbackMsg = '';
    if (held) {
      feedbackMsg = 'Pronto para capturar';
    } else if (allOkMargin) {
      feedbackMsg = 'Mantenha...';
    } else {
      feedbackMsg = 'Olhe para frente';
    }

    return {
      feedback: fb(held ? 'READY' : 'LOOK_FORWARD', feedbackMsg),
      valid: held,
      frameOk: held,
      stepOk: held,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        jawTopL,
        jawTopR,
        leftEyeCenter,
        rightEyeCenter,
        jawEyeDistL: distL,
        jawEyeDistR: distR,
        jawEyeDistDiff: distDiff,
        jawEyeDistRelDiff: distRelDiff,
        jawEyeRelTol: 0.25,
        mouthAvg,
        jawMid,
        faceH,
        mouthVsJawMidRaw,
        yOk,
        distOk,
        lookForwardOkInstant: allOkInstant,
        lookForwardHeld: held,
        lookForwardHoldMs: holdMs,
        lookForwardHeldMs: heldMs,
        lookForwardOkSince: since, // <-- Atualiza o campo para persistir o hold
        currentStep,
        stepPassed: held
      }
    };
  }

  // lookUp/lookDown: based on mouthAvg vs jawMid signal.
  // Provide continuous progress (0..1) and stepOk when above/below threshold.
  if (currentStep === 'lookUp' || currentStep === 'lookDown') {
    const sig = mouthVsJawMidClamped;

    // More permissive threshold, but with a real deadzone so neutral doesn't count as progress/valid.
    // Can be tuned via liveness.lookUpDownThreshold.
    const thr =
      typeof (liveness as any)?.lookUpDownThreshold === 'number'
        ? clamp(Math.abs((liveness as any).lookUpDownThreshold), 0.02, 0.9)
        : 0.06;

    const ok =
      currentStep === 'lookUp'
        ? (typeof sig === 'number' ? sig >= thr : false)
        : (typeof sig === 'number' ? sig <= -thr : false);

    // Continuous progress should start *after* the deadzone threshold.
    // 0 when |sig|<=thr, 1 when reaching the clamp edge (1.0).
    const prog =
      typeof sig !== 'number'
        ? 0
        : currentStep === 'lookUp'
          ? clamp01((sig - thr) / Math.max(1e-6, 0.1 - thr))
          : clamp01(((-sig) - thr) / Math.max(1e-6, 0.1 - thr));

    return {
      feedback: ok
        ? fb(currentStep === 'lookUp' ? 'LOOK_UP' : 'LOOK_DOWN', 'Mantenha...')
        : currentStep === 'lookUp'
          ? fb('LOOK_UP', 'Olhe para cima')
          : fb('LOOK_DOWN', 'Olhe para baixo'),
      valid: ok,
      frameOk: ok,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        cx: centerX,
        cy: centerY,
        centerTol,
        currentStep,
        stepPassed: ok,
        mouthAvg,
        jawMid,
        faceH,
        mouthVsJawMidRaw,
        mouthVsJawMidClamped,
        lookUpProgress: currentStep === 'lookUp' ? prog : 0,
        lookDownProgress: currentStep === 'lookDown' ? prog : 0,
        lookUpDownThreshold: thr,
        poseProgressSource: 'mouthJaw'
      } as any
    };
  }

  if (current === 'lookLeft') {
    const ok = leftOkStrict;
    return {
      feedback: fb('LOOK_LEFT', 'Olhe para a esquerda'),
      valid: ok,
      frameOk,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        cx,
        cy,
        centerTol,
        lookForwardOk,
        lookLeftProgress: leftProgress,
        lookRightProgress: rightProgress,
        lookLeftRule: `L<${nearThr.toFixed(2)} && R>${farThr.toFixed(2)}`,
        lookRightRule: `R<${nearThr.toFixed(2)} && L>${farThr.toFixed(2)}`,
        lookLeftActualTarget: `L:${(effL ?? 0).toFixed(3)}/${nearThr.toFixed(2)}  R:${(effR ?? 0).toFixed(3)}/${farThr.toFixed(2)}`,
        mouthJawLeftDist: mjL ?? undefined,
        mouthJawRightDist: mjR ?? undefined,
        mouthJawBaselineLeft: bL ?? undefined,
        mouthJawBaselineRight: bR ?? undefined,
        mouthJawDeltaLeft: dL ?? undefined,
        mouthJawDeltaRight: dR ?? undefined,
        mouthJawThr: undefined,
        mouthJawRatioNormLeft: undefined,
        mouthJawRatioNormRight: undefined,
        mouthJawRatioNowLeftOverRight: undefined,
        mouthJawRatioNowRightOverLeft: undefined,
        mouthJawRatioBaseLeftOverRight: undefined,
        mouthJawRatioBaseRightOverLeft: undefined
      }
    };
  }

  if (current === 'lookRight') {
    const ok = rightOkStrict;
    return {
      feedback: fb('LOOK_RIGHT', 'Olhe para a direita'),
      valid: ok,
      frameOk,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        cx,
        cy,
        centerTol,
        lookForwardOk,
        lookLeftProgress: leftProgress,
        lookRightProgress: rightProgress,
        lookLeftRule: `L<${nearThr.toFixed(2)} && R>${farThr.toFixed(2)}`,
        lookRightRule: `R<${nearThr.toFixed(2)} && L>${farThr.toFixed(2)}`,
        lookRightActualTarget: `R:${(effR ?? 0).toFixed(3)}/${nearThr.toFixed(2)}  L:${(effL ?? 0).toFixed(3)}/${farThr.toFixed(2)}`,
        mouthJawLeftDist: mjL ?? undefined,
        mouthJawRightDist: mjR ?? undefined,
        mouthJawBaselineLeft: bL ?? undefined,
        mouthJawBaselineRight: bR ?? undefined,
        mouthJawDeltaLeft: dL ?? undefined,
        mouthJawDeltaRight: dR ?? undefined,
        mouthJawThr: undefined,
        mouthJawRatioNormLeft: undefined,
        mouthJawRatioNormRight: undefined,
        mouthJawRatioNowLeftOverRight: undefined,
        mouthJawRatioNowRightOverLeft: undefined,
        mouthJawRatioBaseLeftOverRight: undefined,
        mouthJawRatioBaseRightOverLeft: undefined
      }
    };
  }

  // Zoom challenges: should be responsive even if the generic size gate would normally block.
  // We keep frameOk = true here so the step can be completed based on faceArea thresholds.
  // NOTE: zoomIn/zoomOut are handled earlier via `currentStep` to avoid conflicting messages.
  // (Do not add a second `current === 'zoomIn'/'zoomOut'` block here.)

  if (current === 'blink') {
    const l = status.leftEyeOpenProb;
    const r = status.rightEyeOpenProb;
    const hasEyes = typeof l === 'number' && typeof r === 'number';

    // Blink is considered when both eyes are below threshold ("closed").
    const closed = hasEyes && (l as number) < blinkThr && (r as number) < blinkThr;
    const ok = !!closed;

    return {
      feedback: fb('BLINK', 'Pisque'),
      valid: ok,
      frameOk,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        leftEyeOpenProb: typeof l === 'number' ? l : undefined,
        rightEyeOpenProb: typeof r === 'number' ? r : undefined,
        blinkClosedThreshold: blinkThr,
        blinkIsClosed: !!closed
      }
    };
  }

  if (current === 'cheese') {
    const mouth = status.mouthPoints;
    const hasMouth = Array.isArray(mouth) && mouth.length >= 8;

    let smileRatio = 0;
    if (hasMouth) {
      // use outer mouth extremes: approximate left/right and top/bottom
      const xs = mouth!.map((p) => p.x);
      const ys = mouth!.map((p) => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
      smileRatio = w / h;
    }

    // Per-user baseline support (if provided by the SDK loop).
    // When baseline is available, validate by delta: ratio >= baseline + threshold.
    const useBaseline = liveness?.cheeseUseBaseline !== false;
    const baseline = typeof (liveness as any)?.cheeseBaseline === 'number' ? ((liveness as any).cheeseBaseline as number) : undefined;
    const thr = liveness?.cheeseThreshold ?? 0.05; // mais sensível
    let target: number;
    if (useBaseline && typeof baseline === 'number') {
      target = baseline + thr;
    } else {
      target = thr;
    }

    // Se cheeseUseBaseline: false, só considera válido se passar do threshold absoluto
    // (ex: 1.0). Se cheeseUseBaseline: true, usa baseline + delta.
    const ok = hasMouth && smileRatio >= target;

    return {
      feedback: fb('CHEESE', 'Sorria'),
      valid: ok,
      frameOk,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        mouthSmileRatio: hasMouth ? smileRatio : undefined,
        cheeseThreshold: thr,
        cheeseBaseline: typeof baseline === 'number' ? baseline : undefined,
        cheeseTarget: target
      } as any
    };
  }

  if (current === 'openMouth') {
    const mouth = status.mouthPoints;
    const hasMouth = Array.isArray(mouth) && mouth.length >= 8;

    let openRatio = 0;

    if (hasMouth) {
      const xs = mouth!.map((p) => p.x);
      const ys = mouth!.map((p) => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));

      // openness: vertical / horizontal
      openRatio = h / Math.max(1e-6, w);
    }

    // Novo: usar pontos centrais do lábio superior e inferior (landmarks 51 e 57)
    const mouthUpper = (status as any).mouthUpper;
    const mouthLower = (status as any).mouthLower;
    const mouthOpenPx = (status as any).mouthOpenPx;
    const mouthOpenNorm = (status as any).mouthOpenNorm;

    // Preferir a métrica mouthOpenNorm (distância vertical normalizada por eyeDist)
    // Só considera válido se ambos os pontos existem e a distância é maior que o threshold
    const openValue = typeof mouthOpenNorm === 'number' && mouthUpper && mouthLower ? mouthOpenNorm : openRatio;
    const openOk = hasMouth && mouthUpper && mouthLower && openValue >= openMouthThr;

    return {
      feedback: fb('OPEN_MOUTH', 'Abra a boca'),
      valid: openOk,
      frameOk,
      stepOk: openOk,
      debug: {
      strict,
      lfTol,
      forwardTol,
      lookSideTol,
      lookUpDownTol,
      ratio,
      eyeDist,
      noseDx,
      mouthOpenRatio: hasMouth && mouthUpper && mouthLower ? openValue : undefined,
      openMouthThreshold: openMouthThr,
      // Adicione os campos extras como "any" para evitar erro de tipagem
      ...(typeof mouthUpper !== 'undefined' ? { mouthUpper } : {}),
      ...(typeof mouthLower !== 'undefined' ? { mouthLower } : {}),
      ...(typeof mouthOpenPx !== 'undefined' ? { mouthOpenPx } : {}),
      ...(typeof mouthOpenNorm !== 'undefined' ? { mouthOpenNorm: openValue } : {})
      } as any // Força o tipo para aceitar campos extras
    };
  }

  if (current === 'mouthWidth') {
    const mouth = status.mouthPoints;
    const hasMouth = Array.isArray(mouth) && mouth.length >= 8;
    let widthRatio = 0;
    if (hasMouth) {
      const xs = mouth!.map((p) => p.x);
      const w = Math.max(...xs) - Math.min(...xs);
      widthRatio = eyeDist > 1e-6 ? w / eyeDist : 0;
    }
    // Threshold para sorriso (ajuste conforme necessário)
    const smileThreshold = 0.55;
    const ok = hasMouth && widthRatio > smileThreshold;
    return {
      feedback: fb('CHEESE', 'Sorria (abra a boca lateralmente)'),
      valid: ok,
      frameOk: ok,
      stepOk: ok,
      debug: {
        strict,
        lfTol,
        forwardTol,
        lookSideTol,
        lookUpDownTol,
        ratio,
        eyeDist,
        noseDx,
        mouthWidthRatio: hasMouth ? widthRatio : undefined,
        smileThreshold
      } as any
    };
  }

  return {
    feedback: fb('READY', 'Pronto para capturar'),
    valid: true,
    frameOk,
    stepOk: true,
    debug: { strict, lfTol, forwardTol, lookSideTol, lookUpDownTol, ratio, eyeDist, noseDx, cx, cy, centerTol, lookForwardOk }
  };
}
