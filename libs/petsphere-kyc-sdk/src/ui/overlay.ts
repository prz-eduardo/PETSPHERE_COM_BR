import { resizeToContainer, getVideoToContainerMapper } from '../utils/canvas';

export interface OverlayHandle {
  canvas: HTMLCanvasElement;
  dispose: () => void;
  render: (status: OverlayRenderInput) => void;
}

export interface OverlayRenderInput {
  message: string;
  box?: { x: number; y: number; width: number; height: number };
  valid: boolean;

  /** Optional: current challenge direction for overlays that support it (e.g. Coxinha zoom hole). */
  challenge?: {
    direction?: 'left' | 'right' | 'up' | 'down' | 'zoomIn' | 'zoomOut';
  };

  /** Optional: structured debug info to be printed in an on-screen panel. */
  debug?: {
    status?: string;
    ready?: boolean;
    feedbackCode?: string;
    challenge?: string;
    faces?: number;
    eyeL?: number;
    eyeR?: number;

    /** Total de piscadas detectadas desde que a câmera iniciou (start()). */
    blinkCount?: number;

    /** True quando ambos olhos estão abaixo do limiar de "fechado" (momento atual). */
    blinkClosedNow?: boolean;

    /** Limiar utilizado para considerar olho "fechado". */
    blinkClosedThreshold?: number;

    /** 0..1: progresso de hold do challenge atual (usado por overlays como o Coxinha). */
    challengeHoldProgress?: number;

    // requested mouth/jaw diagnostics
    mouthAvg?: { x: number; y: number } | null;
    jawMid?: { x: number; y: number } | null;
    faceH?: number | null;
    mouthVsJawMidRaw?: number | null;
    mouthVsJawMidClamped?: number | null;

    /** Ratio de sorriso detectado (0..1) */
    mouthSmileRatio?: number;

    /** Ponto base da "queijo" (smile calibration) */
    cheeseBaseline?: number;

    /** Ponto alvo da "queijo" (smile calibration) */
    cheeseTarget?: number;

    /** Optional: allow hiding some debug rows without disabling the whole panel. */
    debugDraw?: {
      cheese?: boolean;
    };

    currentStep?: string | null;
    stepPassed?: boolean;

    /** Distâncias boca->olho (esquerdo/direito) e diferença média (debug opcional). */
    jawEyeDistL?: number;
    jawEyeDistR?: number;
    jawEyeDistDiff?: number;
    jawEyeDiffTol?: number;
    /** Campo extra para flags customizadas vindas do debug do SDK. */
    extra?: any;

    /**
     * Objeto de debug detalhado para todos os valores de boca (mouth)
     */
    mouthDebug?: {
      mouthPoints?: any;
      mouthLeft?: any;
      mouthRight?: any;
      mouthUpper?: any;
      mouthLower?: any;
      mouthOpenPx?: number;
      mouthOpenNorm?: number;
      mouthJawLeftDist?: number;
      mouthJawRightDist?: number;
      mouthSmileRatio?: number;
      mouthWidthRatio?: number;
      mouthAvg?: any;
      mouthVsJawMidRaw?: number;
      mouthVsJawMidClamped?: number;
      cheeseBaseline?: number;
      cheeseTarget?: number;
      mouthOpenRatio?: number;
    };
  };

  /** Optional: visual hint for challenges (e.g. arrow directions). */
  hint?:
    | { type: 'arrow'; direction: 'left' | 'right' | 'up' | 'down'; intensity?: number; label?: string }
    | { type: 'pulse'; label?: string; intensity?: number };

  /**
   * Optional: debug landmark points (normalized [0..1] *in video space*).
   * IMPORTANT: when the <video> is rendered with object-fit: cover, the displayed region is cropped.
   * The overlay must map video-space coordinates to container-space coordinates.
   */
  landmarks?: {
    leftEye?: Array<{ x: number; y: number }>;
    rightEye?: Array<{ x: number; y: number }>;
    leftEyeCenter?: { x: number; y: number };
    rightEyeCenter?: { x: number; y: number };

    /** Optional: nose tip (normalized video space) */
    noseTip?: { x: number; y: number };

    /** Optional: nose ridge/base points (normalized video space) */
    nosePoints?: Array<{ x: number; y: number }>;

    /** Optional: outer mouth points (normalized video space) */
    mouthPoints?: Array<{ x: number; y: number }>;

    /** Optional: mouth corners (normalized video space) */
    mouthLeft?: { x: number; y: number };
    mouthRight?: { x: number; y: number };

    /** Optional: jawline polyline points (normalized video space) */
    jawPoints?: Array<{ x: number; y: number }>;

    /** Optional: jaw side points (normalized video space) */
    jawLeft?: { x: number; y: number };
    jawRight?: { x: number; y: number };

    /** Optional: jaw center (normalized video space) */
    jawCenter?: { x: number; y: number };

    /** Optional: distances (mouth corner to jaw side), normalized by eye distance */
    mouthJawLeftDist?: number;
    mouthJawRightDist?: number;

    /** Pontos centrais do lábio superior (51) e inferior (57) (normalized video space). */
    mouthUpper?: { x: number; y: number };
    mouthLower?: { x: number; y: number };
    /** Distância vertical absoluta (px) e normalizada por eyeDist entre lábio superior e inferior. */
    mouthOpenPx?: number;
    mouthOpenNorm?: number;

    // --- NOVOS PONTOS ---
    jawTopL?: { x: number; y: number };
    jawTopR?: { x: number; y: number };
  };

  /**
   * Optional: provide the underlying <video> element so the overlay can compensate object-fit cropping.
   * If omitted, overlay assumes video fills container 1:1 (may be wrong on cover/contain).
   */
  video?: HTMLVideoElement;

  /** Optional: override objectFit; if omitted we read computedStyle(video).objectFit (fallback: 'cover'). */
  videoObjectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

  /**
   * If true, overlay will mirror X coordinates (use when the underlying <video> preview is mirrored).
   * Default: auto-detect from computedStyle(video).transform.
   */
  mirrored?: boolean;

  /** If provided, draw a small analog-style axis widget showing face direction. */
  poseVector?: {
    /** -1..1: negative=left, positive=right (already in preview semantics if you want). */
    x: number;
    /** -1..1: negative=up, positive=down. */
    y: number;
    /** Optional: label shown under the widget (e.g. 'yawProxy' / 'center'). */
    label?: string;
  };

  /** Fine-grained overlay debug toggles (allows the demo/app to enable only what it needs). */
  landmarkDraw?: {
    eyes?: boolean;
    mouth?: boolean;
    nose?: boolean;
    jaw?: boolean;
    mouthJaw?: boolean;
    cheese?: boolean;
  };
}

export function createOverlay(container: HTMLElement, guideCircleRatio = 0.72): OverlayHandle {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '10'; // Garante que o overlay está acima

  const prevPos = getComputedStyle(container).position;
  if (prevPos === 'static') {
    container.style.position = 'relative';
  }

  container.appendChild(canvas);

  /**
   * Computes mapping from video normalized coords -> container CSS pixels,
   * taking object-fit into account.
   */
  const getVideoToContainerMapper = (
    w: number,
    h: number,
    video?: HTMLVideoElement,
    objectFit?: OverlayRenderInput['videoObjectFit'],
    mirrored?: boolean
  ) => {
    // Default: assume coords are already in container-normalized space
    if (!video || !(video.videoWidth > 0) || !(video.videoHeight > 0)) {
      const mir = !!mirrored;
      return {
        mapPt: (p: { x: number; y: number }) => ({ x: (mir ? (1 - p.x) : p.x) * w, y: p.y * h }),
        mapRect: (r: { x: number; y: number; width: number; height: number }) => ({
          x: (mir ? (1 - (r.x + r.width)) : r.x) * w,
          y: r.y * h,
          width: r.width * w,
          height: r.height * h
        })
      };
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const fit =
      objectFit ??
      ((() => {
        try {
          return (getComputedStyle(video).objectFit as any) || 'cover';
        } catch {
          return 'cover';
        }
      })() as OverlayRenderInput['videoObjectFit']);

    const mir =
      typeof mirrored === 'boolean'
        ? mirrored
        : (() => {
            try {
              const tr = getComputedStyle(video).transform;
              // matrix(-1, 0, 0, 1, 0, 0) or matrix3d(-1, ...)
              return typeof tr === 'string' && tr.includes('-1');
            } catch {
              return false;
            }
          })();

    // Displayed(video) rect inside container (CSS px)
    let dispW = w;
    let dispH = h;

    if (fit === 'fill') {
      dispW = w;
      dispH = h;
    } else if (fit === 'contain' || fit === 'scale-down') {
      const s = Math.min(w / vw, h / vh);
      dispW = vw * s;
      dispH = vh * s;
    } else if (fit === 'none') {
      dispW = Math.min(w, vw);
      dispH = Math.min(h, vh);
    } else {
      // 'cover' (default)
      const s = Math.max(w / vw, h / vh);
      dispW = vw * s;
      dispH = vh * s;
    }

    const offX = (w - dispW) / 2;
    const offY = (h - dispH) / 2;

    const mapPt = (p: { x: number; y: number }) => {
      const nx = mir ? 1 - p.x : p.x;
      return {
        x: offX + nx * dispW,
        y: offY + p.y * dispH
      };
    };

    const mapRect = (r: { x: number; y: number; width: number; height: number }) => {
      // Use mapPt on both corners; mirroring is handled inside mapPt.
      const p0 = mapPt({ x: r.x, y: r.y });
      const p1 = mapPt({ x: r.x + r.width, y: r.y + r.height });

      const x0 = Math.min(p0.x, p1.x);
      const y0 = Math.min(p0.y, p1.y);
      const x1 = Math.max(p0.x, p1.x);
      const y1 = Math.max(p0.y, p1.y);

      return {
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0
      };
    };

    return { mapPt, mapRect };
  };

  const startedAt = performance.now();

  const drawPoseAnalog = (w: number, h: number, vec: { x: number; y: number; label?: string }) => {
    if (!ctx) return;

    const pad = 14;
    const size = Math.max(80, Math.round(Math.min(w, h) * 0.16));
    const x0 = pad;
    const y0 = h - pad - size;

    const cx = x0 + size / 2;
    const cy = y0 + size / 2;
    const r = size / 2;

    const vx = Math.max(-1, Math.min(1, vec.x));
    const vy = Math.max(-1, Math.min(1, vec.y));

    ctx.save();
    ctx.globalAlpha = 0.92;

    // background
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    (ctx as any).roundRect?.(x0, y0, size, size, 10);
    if (!(ctx as any).roundRect) {
      // fallback rect
      ctx.rect(x0, y0, size, size);
    }
    ctx.fill();
    ctx.stroke();

    // axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 8);
    ctx.lineTo(cx, y0 + size - 8);
    ctx.moveTo(x0 + 8, cy);
    ctx.lineTo(x0 + size - 8, cy);
    ctx.stroke();

    // outer circle
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
    ctx.stroke();

    // vector arrow
    const len = (r - 16) * Math.min(1, Math.hypot(vx, vy));
    const ang = Math.atan2(vy, vx);
    const ex = cx + Math.cos(ang) * len;
    const ey = cy + Math.sin(ang) * len;

    ctx.strokeStyle = 'rgba(91, 140, 255, 0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // arrow head
    ctx.fillStyle = 'rgba(91, 140, 255, 0.95)';
    const head = 8;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang - 0.6) * head, ey - Math.sin(ang - 0.6) * head);
    ctx.lineTo(ex - Math.cos(ang + 0.6) * head, ey - Math.sin(ang + 0.6) * head);
    ctx.closePath();
    ctx.fill();

    // numeric debug
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.fillText(`x:${vx.toFixed(2)}  y:${vy.toFixed(2)}`, x0 + 10, y0 + size - 12);
    if (vec.label) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(vec.label, x0 + 10, y0 + 18);
    }

    ctx.restore();
  };

  const drawArrowHint = (
    w: number,
    h: number,
    direction: 'left' | 'right' | 'up' | 'down',
    intensity: number,
    label?: string
  ) => {
    if (!ctx) return;

    const t = (performance.now() - startedAt) / 1000;

    const base = Math.min(w, h);
    const arrowSize = Math.max(34, Math.round(base * 0.10));
    const strokeW = Math.max(3, Math.round(base * 0.008));

    // Breathing + subtle drifting
    const breath = 0.5 + 0.5 * Math.sin(t * 2.2);
    const fade = 0.35 + 0.55 * breath;
    const alpha = Math.max(0, Math.min(1, intensity)) * fade;

    const drift = (0.5 + 0.5 * Math.sin(t * 2.2 + 1.4)) * (arrowSize * 0.18);

    const cx = w / 2;
    const cy = h / 2;

    let dx = 0;
    let dy = 0;
    if (direction === 'left') dx = -drift;
    if (direction === 'right') dx = drift;
    if (direction === 'up') dy = -drift;
    if (direction === 'down') dy = drift;

    const x = cx + dx;
    const y = cy + dy;

    // soft glow
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // shadow glow behind
    ctx.strokeStyle = 'rgba(91, 140, 255, 0.35)';
    ctx.lineWidth = strokeW + 6;

    const drawShape = () => {
      ctx.beginPath();
      if (direction === 'left' || direction === 'right') {
        const s = arrowSize;
        const dir = direction === 'left' ? -1 : 1;
        ctx.moveTo(x - (s * 0.35) * dir, y - s * 0.33);
        ctx.lineTo(x + (s * 0.35) * dir, y);
        ctx.lineTo(x - (s * 0.35) * dir, y + s * 0.33);
      } else {
        const s = arrowSize;
        const dir = direction === 'up' ? -1 : 1;
        ctx.moveTo(x - s * 0.33, y - (s * 0.35) * dir);
        ctx.lineTo(x, y + (s * 0.35) * dir);
        ctx.lineTo(x + s * 0.33, y - (s * 0.35) * dir);
      }
    };

    drawShape();
    ctx.stroke();

    // main arrow
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = strokeW;
    drawShape();
    ctx.stroke();

    // label under arrow
    if (label) {
      const fontSize = Math.max(12, Math.round(base * 0.035));
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, alpha + 0.15)})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, cx, y + arrowSize * 0.52);
    }

    ctx.restore();
  };

  const drawPulseHint = (w: number, h: number, intensity: number, label?: string) => {
    if (!ctx) return;

    const t = (performance.now() - startedAt) / 1000;
    const base = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2;

    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const alpha = Math.max(0, Math.min(1, intensity)) * (0.25 + 0.55 * pulse);
    const r = Math.max(22, base * (0.09 + 0.03 * pulse));

    ctx.save();
    ctx.globalAlpha = alpha;

    // ring
    ctx.strokeStyle = 'rgba(91, 140, 255, 0.9)';
    ctx.lineWidth = Math.max(3, Math.round(base * 0.008));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // label
    if (label) {
      const fontSize = Math.max(12, Math.round(base * 0.035));
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, alpha + 0.15)})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, cx, cy + r + 6);
    }

    ctx.restore();
  };

  const draw = (input: OverlayRenderInput) => {
    if (!ctx) {
      console.warn('Overlay: ctx is null (canvas context not available)');
      return;
    }
    // Forçar tamanho do canvas (mobile fix)
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    // Debug: log dimensões
    console.log('[Overlay] draw', { w: canvas.width, h: canvas.height, containerW: container.offsetWidth, containerH: container.offsetHeight });

    const { w, h } = resizeToContainer(canvas, container, ctx);
    const mapper = getVideoToContainerMapper(w, h, input.video, input.videoObjectFit, input.mirrored);

    // Small helpers for debug markers/labels
    const drawDot = (p: { x: number; y: number }, color: string, radius = 4) => {
      const m = mapper.mapPt(p);
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawLabel = (x: number, y: number, text: string) => {
      ctx.save();
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const pad = 4;
      const metrics = ctx.measureText(text);
      const tw = metrics.width;
      const th = 14;
      ctx.fillRect(x + 6, y - th - 6, tw + pad * 2, th + pad);
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.fillText(text, x + 6 + pad, y - 6);
      ctx.restore();
    };

    ctx.clearRect(0, 0, w, h);

    // Dark backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, w, h);

    // "Hole" circle
    const r = Math.min(w, h) * guideCircleRatio * 0.5;
    const cx = w / 2;
    const cy = h / 2;

    // Hint (behind strokes/text but above backdrop)
    if (input.hint) {
      const intensity = typeof input.hint.intensity === 'number' ? input.hint.intensity : 1;
      if (input.hint.type === 'arrow') {
        drawArrowHint(w, h, input.hint.direction, intensity, input.hint.label);
      } else if (input.hint.type === 'pulse') {
        drawPulseHint(w, h, intensity, input.hint.label);
      }
    }

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Circle stroke
    ctx.lineWidth = Math.max(3, Math.round(Math.min(w, h) * 0.01));
    ctx.strokeStyle = input.valid ? 'rgba(46, 204, 113, 0.98)' : 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Optional face box (video-normalized -> container)
    if (input.box) {
      const rr = mapper.mapRect(input.box);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.85)';
      ctx.strokeRect(rr.x, rr.y, rr.width, rr.height);
    }

    const drawEyes = input.landmarkDraw?.eyes !== false; // default ON
    const drawMouth = input.landmarkDraw?.mouth !== false;
    const drawNose = input.landmarkDraw?.nose !== false;
    const drawJaw = input.landmarkDraw?.jaw !== false;
    const drawMouthJaw = input.landmarkDraw?.mouthJaw !== false;

    // Draw debug landmarks (eyes) (video-normalized -> container)
    if (input.landmarks) {
      if (drawEyes) {
        const pts = [...(input.landmarks.leftEye ?? []), ...(input.landmarks.rightEye ?? [])];
        if (pts.length > 0) {
          const radius = Math.max(2, Math.round(Math.min(w, h) * 0.006));
          ctx.save();
          ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
          for (const p of pts) {
            const m = mapper.mapPt(p);
            ctx.beginPath();
            ctx.arc(m.x, m.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        const centers = [input.landmarks.leftEyeCenter, input.landmarks.rightEyeCenter].filter(Boolean) as Array<{
          x: number;
          y: number;
        }>;
        if (centers.length > 0) {
          const r2 = Math.max(4, Math.round(Math.min(w, h) * 0.012));
          ctx.save();
          ctx.fillStyle = 'rgba(255, 64, 129, 0.95)';
          for (const c of centers) {
            const m = mapper.mapPt(c);
            ctx.beginPath();
            ctx.arc(m.x, m.y, r2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Nose polyline
      if (drawNose) {
        const nosePts = input.landmarks.nosePoints ?? [];
        if (nosePts.length >= 2) {
          ctx.save();
          ctx.strokeStyle = 'rgba(156, 39, 176, 0.9)';
          ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.0035));
          const p0 = mapper.mapPt(nosePts[0]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < nosePts.length; i++) {
            const p = mapper.mapPt(nosePts[i]);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Mouth polyline (closed)
      if (drawMouth) {
        const mouthPts = input.landmarks.mouthPoints ?? [];
        if (mouthPts.length >= 3) {
          // Outline
          ctx.save();
          ctx.strokeStyle = 'rgba(76, 175, 80, 0.9)';
          ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.0035));
          const p0 = mapper.mapPt(mouthPts[0]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < mouthPts.length; i++) {
            const p = mapper.mapPt(mouthPts[i]);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();

          // Points (more granular)
          ctx.save();
          const ptR = Math.max(2, Math.round(Math.min(w, h) * 0.004));
          for (let i = 0; i < mouthPts.length; i++) {
            const mp = mapper.mapPt(mouthPts[i]);
            ctx.fillStyle = 'rgba(76, 175, 80, 0.95)';
            ctx.beginPath();
            ctx.arc(mp.x, mp.y, ptR, 0, Math.PI * 2);
            ctx.fill();

            // Label a few key indices for easier debugging
            if (i === 0 || i === Math.floor(mouthPts.length / 2) || i === mouthPts.length - 1) {
              ctx.fillStyle = 'rgba(0,0,0,0.55)';
              ctx.fillRect(mp.x + 4, mp.y - 12, 18, 14);
              ctx.fillStyle = 'rgba(255,255,255,0.9)';
              ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
              ctx.fillText(String(i), mp.x + 6, mp.y - 10);
            }
          }
          ctx.restore();
        }
      }

      // Jawline
      if (drawJaw) {
        const jaw = input.landmarks.jawPoints ?? [];
        if (jaw.length >= 2) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 193, 7, 0.95)';
          ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.004));
          const p0 = mapper.mapPt(jaw[0]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < jaw.length; i++) {
            const p = mapper.mapPt(jaw[i]);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Nose tip + jaw center
      if (drawNose) {
        const nose = input.landmarks.noseTip;
        if (nose) {
          ctx.save();
          const rr = Math.max(4, Math.round(Math.min(w, h) * 0.010));
          const p = mapper.mapPt(nose);
          ctx.fillStyle = 'rgba(156, 39, 176, 0.95)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Mouth<->Jaw distance debug
      if (drawMouthJaw) {
        const ml = input.landmarks.mouthLeft;
        const mr = input.landmarks.mouthRight;
        const jl = input.landmarks.jawLeft;
        const jr = input.landmarks.jawRight;
        const dL = input.landmarks.mouthJawLeftDist;
        const dR = input.landmarks.mouthJawRightDist;

        // Mouth corner-to-corner distance (requested)
        if (ml && mr) {
          const pL = mapper.mapPt(ml);
          const pR = mapper.mapPt(mr);
          const distPx = Math.hypot(pR.x - pL.x, pR.y - pL.y);

          // Normalization reference: inter-ocular distance when available (more stable across zoom)
          const leC = input.landmarks.leftEyeCenter;
          const reC = input.landmarks.rightEyeCenter;
          const eyeDistPx =
            leC && reC ? Math.hypot(mapper.mapPt(leC).x - mapper.mapPt(reC).x, mapper.mapPt(leC).y - mapper.mapPt(reC).y) : null;
          const distNorm = eyeDistPx && eyeDistPx > 1e-6 ? distPx / eyeDistPx : null;

          ctx.save();
          ctx.strokeStyle = 'rgba(76, 175, 80, 0.85)';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(pL.x, pL.y);
          ctx.lineTo(pR.x, pR.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // emphasize corners
          drawDot(ml, 'rgba(76, 175, 80, 0.95)', 5);
          drawDot(mr, 'rgba(76, 175, 80, 0.95)', 5);

          // label at midpoint
          const midX = (pL.x + pR.x) / 2;
          const midY = (pL.y + pR.y) / 2;
          // small midpoint marker
          ctx.save();
          ctx.fillStyle = 'rgba(76, 175, 80, 0.95)';
          ctx.beginPath();
          ctx.arc(midX, midY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Show normalized value (avg between points = midpoint), not individual px
          drawLabel(midX, midY, `mouthWidth: ${distNorm != null ? distNorm.toFixed(2) + 'xEye' : Math.round(distPx) + 'px'}`);
        }

        // Jaw side-to-side line + midpoint (requested)
        let jawMid: { x: number; y: number } | undefined;
        if (jl && jr) {
          const p1 = mapper.mapPt(jl);
          const p2 = mapper.mapPt(jr);
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 193, 7, 0.85)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.restore();

          jawMid = { x: (jl.x + jr.x) / 2, y: (jl.y + jr.y) / 2 };
          drawDot(jawMid, 'rgba(255, 193, 7, 0.95)', 5);
        }

        // Mouth corner -> jaw midpoint distances (requested)
        if (jawMid && (ml || mr)) {
          const midPx = mapper.mapPt(jawMid);

          const drawMouthToMid = (m: { x: number; y: number }, label: string, color: string) => {
            const mPx = mapper.mapPt(m);
            const distPx = Math.hypot(mPx.x - midPx.x, mPx.y - midPx.y);

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(mPx.x, mPx.y);
            ctx.lineTo(midPx.x, midPx.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            drawDot(m, color.replace('0.55', '0.95'), 4);
            drawLabel(mPx.x, mPx.y, `${label}: ${Math.round(distPx)}px`);
          };

          if (ml) drawMouthToMid(ml, 'mouth->jawMid L', 'rgba(255, 64, 129, 0.70)');
          if (mr) drawMouthToMid(mr, 'mouth->jawMid R', 'rgba(33, 150, 243, 0.70)');

          // Signed vertical signal at jawMid:
          // -1 when average mouth Y is below the jaw line (bigger y in video space)
          // +1 when average mouth Y is above the jaw line (smaller y in video space)
          const mouths = [ml, mr].filter(Boolean) as Array<{ x: number; y: number }>;
          if (mouths.length > 0) {
            const avgM = mouths.reduce(
              (acc, p) => ({ x: acc.x + p.x / mouths.length, y: acc.y + p.y / mouths.length }),
              { x: 0, y: 0 }
            );

            const avgMPx = mapper.mapPt(avgM);
            const dyPx = midPx.y - avgMPx.y; // >0 => mouth above jaw line
            const signed = dyPx >= 0 ? 1 : -1;

            // Use % of face height (approx: jawLeft<->jawRight in px if available, else container min)
            const jawWidthPx = jl && jr ? Math.hypot(mapper.mapPt(jl).x - mapper.mapPt(jr).x, mapper.mapPt(jl).y - mapper.mapPt(jr).y) : Math.min(w, h);
            const norm = jawWidthPx > 0 ? Math.max(-1, Math.min(1, dyPx / (jawWidthPx * 0.18))) : signed;

            // Show both: signed (-1/+1) and normalized value (-1..+1)
            drawLabel(midPx.x, midPx.y, `mouthAvg vs jawMid: ${signed} (norm ${norm.toFixed(2)})`);
          }
        }
      }

      // Eye distance reference (so the user can see what we use to normalize mouth<->jaw distances)
      if (drawEyes) {
        const leC = input.landmarks.leftEyeCenter;
        const reC = input.landmarks.rightEyeCenter;
        if (leC && reC) {
          const p1 = mapper.mapPt(leC);
          const p2 = mapper.mapPt(reC);
          ctx.save();
          ctx.strokeStyle = 'rgba(33, 150, 243, 0.55)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // eyeDist isn't currently carried in landmarks; compute it in normalized video space for display only
          const eyeDistNorm = Math.hypot(leC.x - reC.x, leC.y - reC.y);
          drawLabel((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, `eyeDist(norm): ${eyeDistNorm.toFixed(3)}`);
        }
      }
    }

    // Debug panel (bottom-left)
    if (input.debug && input.debug.extra?.showOverlayTableCanvas) {
      const pad = 12;
      const lineH = 16;
      const panelW = Math.min(520, Math.round(w * 0.62));
      const lines: string[] = [];

      if (typeof input.debug.status === 'string') lines.push(`Status: ${input.debug.status}`);
      if (typeof input.debug.ready === 'boolean') lines.push(`Ready: ${input.debug.ready}`);
      if (typeof input.debug.feedbackCode === 'string') lines.push(`Feedback: ${input.debug.feedbackCode}`);
      if (typeof input.debug.challenge === 'string') lines.push(`Challenge: ${input.debug.challenge}`);

      const faces = typeof input.debug.faces === 'number' ? input.debug.faces : undefined;
      const eyeL = typeof input.debug.eyeL === 'number' ? input.debug.eyeL : undefined;
      const eyeR = typeof input.debug.eyeR === 'number' ? input.debug.eyeR : undefined;
      if (faces != null || eyeL != null || eyeR != null) {
        lines.push(
          `Debug: faces=${faces ?? '-'} | eyeL=${eyeL != null ? eyeL.toFixed(2) : '-'} | eyeR=${eyeR != null ? eyeR.toFixed(2) : '-'}`
        );
      }

      const blinkCount = typeof input.debug.blinkCount === 'number' ? input.debug.blinkCount : undefined;
      const blinkClosedNow = typeof input.debug.blinkClosedNow === 'boolean' ? input.debug.blinkClosedNow : undefined;
      const blinkThr = typeof input.debug.blinkClosedThreshold === 'number' ? input.debug.blinkClosedThreshold : undefined;
      if (blinkCount != null || blinkClosedNow != null || blinkThr != null) {
        lines.push(
          `Blink: count=${blinkCount ?? '-'} | closedNow=${blinkClosedNow ?? '-'} | thr=${blinkThr != null ? blinkThr.toFixed(2) : '-'}`
        );
      }

      // Requested: mouthAvg vs jawMid norm (raw + clamped)
      const raw = input.debug.mouthVsJawMidRaw;
      const clamped = input.debug.mouthVsJawMidClamped;
      if (typeof clamped === 'number' || typeof raw === 'number') {
        lines.push(
          `mouthAvg vs jawMid: ${typeof clamped === 'number' ? clamped.toFixed(2) : '-'} (raw ${typeof raw === 'number' ? raw.toFixed(3) : '-'})`
        );
      }
      const faceH = input.debug.faceH;
      if (typeof faceH === 'number') lines.push(`faceH: ${faceH.toFixed(3)}`);

      if (typeof input.debug.stepPassed === 'boolean') {
        lines.push(`stepPassed(${input.debug.currentStep ?? '-'}) = ${input.debug.stepPassed}`);
      }

      // Smile/cheese debug (optional row)
      const showCheese = input.debug.debugDraw?.cheese !== false;
      if (showCheese) {
        const smileRatio = input.debug.mouthSmileRatio;
        const cheeseBaseline = input.debug.cheeseBaseline;
        const cheeseTarget = input.debug.cheeseTarget;
        if (typeof smileRatio === 'number' || typeof cheeseBaseline === 'number' || typeof cheeseTarget === 'number') {
          lines.push(
            `Cheese: ratio=${typeof smileRatio === 'number' ? smileRatio.toFixed(3) : '-'} | base=${typeof cheeseBaseline === 'number' ? cheeseBaseline.toFixed(3) : '-'} | target=${typeof cheeseTarget === 'number' ? cheeseTarget.toFixed(3) : '-'}`
          );
        }
      }

      // panel background
      const panelH = pad * 2 + lines.length * lineH;
      const x0 = 12;
      const y0 = h - panelH - 88; // keep above the big centered message sheet
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect?.(x0, y0, panelW, panelH, 10);
      if (!(ctx as any).roundRect) ctx.rect(x0, y0, panelW, panelH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x0 + pad, y0 + pad + i * lineH);
      }
      ctx.restore();
    }

    // Text
    if (input.message) {
      const safeBottom = 16;
      const padX = 16;
      const sheetH = Math.max(52, Math.round(h * 0.12));
      const y0 = h - sheetH - safeBottom;

      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath();
      const radius = 14;
      const x0 = padX;
      const ww = w - padX * 2;
      const hh = sheetH;

      ctx.moveTo(x0 + radius, y0);
      ctx.arcTo(x0 + ww, y0, x0 + ww, y0 + hh, radius);
      ctx.arcTo(x0 + ww, y0 + hh, x0, y0 + hh, radius);
      ctx.arcTo(x0, y0 + hh, x0, y0, radius);
      ctx.arcTo(x0, y0, x0 + ww, y0, radius);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'white';
      const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.045));
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(input.message, w / 2, y0 + hh / 2);
    }

    // --- Linha e pontos do openMouth (lábio superior e inferior) ---
    if (input.landmarks) {
      const mouthUpper = input.landmarks.mouthUpper;
      const mouthLower = input.landmarks.mouthLower;
      if (mouthUpper && mouthLower) {
        const pU = mapper.mapPt(mouthUpper);
        const pL = mapper.mapPt(mouthLower);
        // Linha entre os pontos
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 87, 34, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(pU.x, pU.y);
        ctx.lineTo(pL.x, pL.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Pontos de medição destacados
        drawDot(mouthUpper, 'rgba(255, 87, 34, 1)', 7);
        drawDot(mouthLower, 'rgba(255, 87, 34, 1)', 7);
        // Label no meio
        const midX = (pU.x + pL.x) / 2;
        const midY = (pU.y + pL.y) / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 87, 34, 0.95)';
        ctx.beginPath();
        ctx.arc(midX, midY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Mostrar valor normalizado (mouthOpenNorm) se disponível
        const mouthOpenNorm = input.landmarks.mouthOpenNorm;
        drawLabel(midX, midY, `mouthOpen: ${mouthOpenNorm != null ? mouthOpenNorm.toFixed(2) + 'xEye' : Math.round(Math.abs(pU.y - pL.y)) + 'px'}`);
      }

      // --- JawTopL/JawTopR e linhas até os olhos ---
      const jawTopL = input.landmarks.jawTopL;
      const jawTopR = input.landmarks.jawTopR;
      const leftEyeCenter = input.landmarks.leftEyeCenter;
      const rightEyeCenter = input.landmarks.rightEyeCenter;
      if (jawTopL && leftEyeCenter) {
        const p1 = mapper.mapPt(jawTopL);
        const p2 = mapper.mapPt(leftEyeCenter);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawDot(jawTopL, 'rgba(255,0,0,1)', 8);
        // Calcular valor se não vier do debug
        let val = input.debug?.jawEyeDistL;
        if (val == null) {
          val = Math.hypot(jawTopL.x - leftEyeCenter.x, jawTopL.y - leftEyeCenter.y);
        }
        drawLabel((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, `jawTopL→eyeL: ${val != null ? val.toFixed(3) : '-'}`);
      }
      if (jawTopR && rightEyeCenter) {
        const p1 = mapper.mapPt(jawTopR);
        const p2 = mapper.mapPt(rightEyeCenter);
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawDot(jawTopR, 'rgba(0,0,255,1)', 8);
        // Calcular valor se não vier do debug
        let val = input.debug?.jawEyeDistR;
        if (val == null) {
          val = Math.hypot(jawTopR.x - rightEyeCenter.x, jawTopR.y - rightEyeCenter.y);
        }
        drawLabel((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, `jawTopR→eyeR: ${val != null ? val.toFixed(3) : '-'}`);
      }
    }
  };

  const render = (input: OverlayRenderInput) => draw(input);

  const dispose = () => {
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
  };

  return { canvas, dispose, render };
}
