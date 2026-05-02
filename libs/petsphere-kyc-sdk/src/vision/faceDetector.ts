import * as faceapi from 'face-api.js';
import type { FaceDetectionStatus, AlphaValidSdkError } from '../types/sdk';

export interface FaceDetector {
  load: (modelsPath: string, opts?: { timeoutMs?: number }) => Promise<void>;
  detect: (video: HTMLVideoElement, opts?: { withLandmarks?: boolean }) => Promise<FaceDetectionStatus>;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function eyeAspectRatio(pts: faceapi.Point[]) {
  // Using 6 points: p1..p6
  const d = (a: faceapi.Point, b: faceapi.Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const p1 = pts[0], p2 = pts[1], p3 = pts[2], p4 = pts[3], p5 = pts[4], p6 = pts[5];
  const ear = (d(p2, p6) + d(p3, p5)) / (2 * d(p1, p4));
  return ear;
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number, onTimeout: () => AlphaValidSdkError): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(onTimeout()), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function createFaceDetector(): FaceDetector {
  let loaded = false;

  const load = async (modelsPath: string, opts?: { timeoutMs?: number }) => {
    if (loaded) return;

    try {
      const timeoutMs = opts?.timeoutMs ?? 15000;

      await withTimeout(faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath), timeoutMs, () => ({
        code: 'MODEL_LOAD_TIMEOUT',
        message: `Timeout ao carregar modelo TinyFaceDetector em: ${modelsPath}`
      }));

      // IMPORTANT: faceLandmark68TinyNet expects files named: face_landmark_68_tiny_model-weights_manifest.json + shard(s)
      await withTimeout(faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelsPath), timeoutMs, () => ({
        code: 'MODEL_LOAD_TIMEOUT',
        message: `Timeout ao carregar modelo faceLandmark68TinyNet em: ${modelsPath}`
      }));

      loaded = true;
    } catch (err) {
      const sdkErr: AlphaValidSdkError =
        (err as any)?.code === 'MODEL_LOAD_TIMEOUT'
          ? (err as AlphaValidSdkError)
          : {
              code: 'MODEL_LOAD_FAILED',
              message: `Falha ao carregar modelos face-api.js em: ${modelsPath}`,
              cause: err
            };
      throw sdkErr;
    }
  };

  const detect = async (
    video: HTMLVideoElement,
    opts?: { withLandmarks?: boolean }
  ): Promise<FaceDetectionStatus> => {
    if (!loaded) return { faces: 0 };

    // NOTE: Using too high inputSize can cause frame drops / slow inference and increases the chance
    // of losing the face while the user moves. We keep it moderate and rely on a slightly higher
    // scoreThreshold + temporal smoothing in index.ts.
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.45
    });

    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;

    const toBoxStatus = (box: faceapi.Box): FaceDetectionStatus => {
      const nx = box.x / vw;
      const ny = box.y / vh;
      const nw = box.width / vw;
      const nh = box.height / vh;
      return {
        faces: 1,
        box: { x: nx, y: ny, width: nw, height: nh },
        centerX: clamp01(nx + nw / 2),
        area: nw * nh,
        poseSource: 'bbox'
      };
    };

    // Best-effort multi-try detection: if first run returns nothing (common on head turns), try a second time.
    const detectFaces = async () => {
      const r1 = await faceapi.detectAllFaces(video, detectorOptions);
      if (r1 && r1.length > 0) return r1;
      return await faceapi.detectAllFaces(video, detectorOptions);
    };

    // --- LANDMARK PATH (preferred) ---
    if (opts?.withLandmarks) {
      // Some frames will produce a face box but landmarks can fail; fallback to bbox-only.
      let results: Array<any> = [];
      try {
        results = await faceapi.detectAllFaces(video, detectorOptions).withFaceLandmarks(true);
      } catch {
        results = [];
      }

      if (!results || results.length === 0) {
        // Fallback: at least return bbox to avoid UX 'face lost' flicker.
        const faces = await detectFaces();
        if (!faces || faces.length === 0) return { faces: 0 };
        if (faces.length > 1) return { faces: faces.length };
        return toBoxStatus(faces[0].box);
      }
      if (results.length > 1) return { faces: results.length };

      const box = results[0].detection.box;
      const lm = results[0].landmarks;

      const leftEye = lm.getLeftEye();
      const rightEye = lm.getRightEye();
      const nose = lm.getNose();
      const jaw = lm.getJawOutline();
      const mouth = lm.getMouth();

      const toNormPoints = (pts: faceapi.Point[]) =>
        pts.map((p) => ({ x: clamp01(p.x / vw), y: clamp01(p.y / vh) }));

      const toNormPoint = (p: faceapi.Point) => ({ x: clamp01(p.x / vw), y: clamp01(p.y / vh) });

      const avg = (pts: faceapi.Point[]) =>
        pts.reduce(
          (acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }),
          { x: 0, y: 0 }
        );

      const leftEyeCenter = avg(leftEye);
      const rightEyeCenter = avg(rightEye);
      const eyeDistPx = Math.hypot(leftEyeCenter.x - rightEyeCenter.x, leftEyeCenter.y - rightEyeCenter.y);

      const jawCenterPx = avg(jaw);
      const noseTipPx = nose && nose.length > 0 ? nose[Math.floor(nose.length / 2)] : undefined;

      // Robust yaw proxy (best-effort): nose offset relative to eye midpoint, normalized by inter-ocular distance.
      // Sign: >0 means nose is to the right of the eye midpoint (in raw video coords).
      const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
      const yawProxy = noseTipPx ? (noseTipPx.x - eyeMidX) / Math.max(1e-6, eyeDistPx) : undefined;

      // EAR thresholds are heuristic: open ~0.25-0.35, closed ~<0.18 (varies)
      const leftEAR = eyeAspectRatio(leftEye);
      const rightEAR = eyeAspectRatio(rightEye);

      // Convert EAR to an open probability (rough)
      const earToProb = (ear: number) => clamp01((ear - 0.16) / (0.12));

      const nx = box.x / vw;
      const ny = box.y / vh;
      const nw = box.width / vw;
      const nh = box.height / vh;

      // Mouth corners + jaw sides (best-effort for mouth->jaw distance proxy)
      const mouthLeftPx =
        mouth && mouth.length > 0
          ? mouth.reduce((a: faceapi.Point, p: faceapi.Point) => (p.x < a.x ? p : a), mouth[0] as faceapi.Point)
          : undefined;
      const mouthRightPx =
        mouth && mouth.length > 0
          ? mouth.reduce((a: faceapi.Point, p: faceapi.Point) => (p.x > a.x ? p : a), mouth[0] as faceapi.Point)
          : undefined;

      // Jaw outline is ordered left->right; pick near the ends but lower on the jaw.
      // Using indices closer to the chin reduces noise from cheek movement.
      const jawLeftPx = jaw && jaw.length > 0 ? jaw[Math.max(0, Math.min(jaw.length - 1, 4))] : undefined;
      const jawRightPx = jaw && jaw.length > 0 ? jaw[Math.max(0, Math.min(jaw.length - 1, jaw.length - 5))] : undefined;

      // Corrigir: usar os índices corretos dos landmarks 68 pontos para lábio superior (51) e inferior (57)
      // https://ibug.doc.ic.ac.uk/resources/facial-point-annotations/
      // O array retornado por getMouth() tem 20 pontos, do 49 ao 68 (índices 0 a 19)
      // 51 = índice 2, 57 = índice 8
      const mouthUpperPx = mouth && mouth.length >= 9 ? mouth[2] : undefined; // 51
      const mouthLowerPx = mouth && mouth.length >= 9 ? mouth[8] : undefined; // 57
      const mouthUpper = mouthUpperPx ? toNormPoint(mouthUpperPx) : undefined;
      const mouthLower = mouthLowerPx ? toNormPoint(mouthLowerPx) : undefined;
      const mouthOpenPx = mouthUpperPx && mouthLowerPx ? Math.abs(mouthUpperPx.y - mouthLowerPx.y) : 0;
      const mouthOpenNorm = eyeDistPx > 1e-6 ? mouthOpenPx / eyeDistPx : 0;

      const dist = (a?: faceapi.Point, b?: faceapi.Point) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);
      const mouthJawLeftDistPx = dist(mouthLeftPx, jawLeftPx);
      const mouthJawRightDistPx = dist(mouthRightPx, jawRightPx);

      // Normalize by inter-ocular distance to be scale invariant
      const mouthJawLeftNorm = eyeDistPx > 1e-6 ? mouthJawLeftDistPx / eyeDistPx : 0;
      const mouthJawRightNorm = eyeDistPx > 1e-6 ? mouthJawRightDistPx / eyeDistPx : 0;

      // Ponto mais alto do jaw esquerdo (menor y em jaw[0..metade])
      let jawTopL = undefined, jawTopR = undefined;
      if (jaw && jaw.length >= 2) {
        // Esquerda: menor y entre os primeiros 5 pontos
        jawTopL = jaw.slice(0, 5).reduce((a: faceapi.Point, p: faceapi.Point) => (p.y < a.y ? p : a), jaw[0] as faceapi.Point);
        // Direita: menor y entre os últimos 5 pontos
        jawTopR = jaw.slice(-5).reduce(
          (a: faceapi.Point, p: faceapi.Point) => (p.y < a.y ? p : a),
          jaw[jaw.length - 1] as faceapi.Point
        );
      }
      const jawTopLNorm = jawTopL ? toNormPoint(jawTopL) : undefined;
      const jawTopRNorm = jawTopR ? toNormPoint(jawTopR) : undefined;

      return {
        faces: 1,
        box: { x: nx, y: ny, width: nw, height: nh },
        centerX: clamp01(nx + nw / 2),
        area: nw * nh,
        leftEyeOpenProb: earToProb(leftEAR),
        rightEyeOpenProb: earToProb(rightEAR),
        // New metrics
        leftEyeCenter: { x: clamp01(leftEyeCenter.x / vw), y: clamp01(leftEyeCenter.y / vh) },
        rightEyeCenter: { x: clamp01(rightEyeCenter.x / vw), y: clamp01(rightEyeCenter.y / vh) },
        eyeDist: clamp01(eyeDistPx / Math.max(vw, vh)),
        yawProxy,
        mouthLeft: mouthLeftPx ? toNormPoint(mouthLeftPx) : undefined,
        mouthRight: mouthRightPx ? toNormPoint(mouthRightPx) : undefined,
        jawLeft: jawLeftPx ? toNormPoint(jawLeftPx) : undefined,
        jawRight: jawRightPx ? toNormPoint(jawRightPx) : undefined,
        mouthUpper,
        mouthLower,
        mouthOpenPx,
        mouthOpenNorm,
        mouthJawLeftDist: mouthJawLeftNorm,
        mouthJawRightDist: mouthJawRightNorm,
        jawTopL: jawTopLNorm,
        jawTopR: jawTopRNorm,
        // Absolute px distances (useful for strict thresholds)
        mouthJawLeftDistPx,
        mouthJawRightDistPx,
        leftEyePoints: toNormPoints(leftEye),
        rightEyePoints: toNormPoints(rightEye),
        noseTip: noseTipPx ? { x: clamp01(noseTipPx.x / vw), y: clamp01(noseTipPx.y / vh) } : undefined,
        nosePoints: nose ? toNormPoints(nose) : undefined,
        mouthPoints: mouth ? toNormPoints(mouth) : undefined,
        jawPoints: jaw ? toNormPoints(jaw) : undefined,
        jawCenter: { x: clamp01(jawCenterPx.x / vw), y: clamp01(jawCenterPx.y / vh) },
        poseSource: 'landmarks'
      };
    }

    // --- BBOX ONLY PATH ---
    const result = await detectFaces();
    if (!result || result.length === 0) return { faces: 0 };
    if (result.length > 1) return { faces: result.length };

    return toBoxStatus(result[0].box);
  };

  return { load, detect };
}
