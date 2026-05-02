import { OverlayHandle, OverlayRenderInput as BaseOverlayRenderInput } from './overlay';
import { resizeToContainer, getVideoToContainerMapper } from '../utils/canvas';

// Extend OverlayRenderInput to include optional challenge property
type OverlayRenderInput = BaseOverlayRenderInput & {
  challenge?: {
    direction?: 'left' | 'right' | 'up' | 'down' | 'zoomIn' | 'zoomOut';
  };
  debug?: {
    drawLandmarks?: boolean;
    cheeseBaseline?: number;
    cheeseTarget?: number;
    // Add any other debug properties used in this file if needed
    [key: string]: any;
  };
  landmarkDraw?: {
    eyes?: boolean;
    mouth?: boolean;
    nose?: boolean;
    jaw?: boolean;
    mouthJaw?: boolean;
    cheese?: boolean; // Added cheese property
    [key: string]: any;
  };
};

/**
 * Overlay "Coxinha Mobile" (inverted teardrop):
 * - Máscara em formato de gota invertida, topo e base arredondados
 * - Linhas guias centralizadas (vertical e horizontal)
 * - Fundo glassmorphism
 * - Pronto para integração com landmarks para checagem de alinhamento
 */
export function createOverlayCoxinhaMobile(container: HTMLElement): OverlayHandle {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // NEW: keep last input so drawTeardropOverlay can read hold progress
  let lastRenderInput: OverlayRenderInput | null = null;

  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  container.appendChild(canvas);

  // Utilitário: path da coxinha invertida (gota) para CanvasRenderingContext2D
  function teardropPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.78); // topo
    ctx.bezierCurveTo(
      cx + r * 1.15, cy - r * 0.78,
      cx + r * 0.65, cy + r * 1.10,
      cx, cy + r * 1.18
    );
    ctx.bezierCurveTo(
      cx - r * 0.65, cy + r * 1.10,
      cx - r * 1.15, cy - r * 0.78,
      cx, cy - r * 0.78
    );
    ctx.closePath();
  }

  // Utilitário: retorna Path2D da coxinha invertida (gota)
  function teardropPath2D(cx: number, cy: number, r: number): Path2D {
    const path = new Path2D();
    path.moveTo(cx, cy - r * 0.78);
    path.bezierCurveTo(
      cx + r * 1.15, cy - r * 0.78,
      cx + r * 0.65, cy + r * 1.10,
      cx, cy + r * 1.18
    );
    path.bezierCurveTo(
      cx - r * 0.65, cy + r * 1.10,
      cx - r * 1.15, cy - r * 0.78,
      cx, cy - r * 0.78
    );
    path.closePath();
    return path;
  }

  // NEW: approximate the teardrop border as polyline points for progress stroke
  function teardropBorderPoints(cx: number, cy: number, r: number, segments = 80) {
    // We sample the two cubic Béziers that form the shape; this matches teardropPath2D().
    const top = { x: cx, y: cy - r * 0.78 };
    const bottom = { x: cx, y: cy + r * 1.18 };

    const rightC1 = { x: cx + r * 1.15, y: cy - r * 0.78 };
    const rightC2 = { x: cx + r * 0.65, y: cy + r * 1.1 };

    const leftC1 = { x: cx - r * 0.65, y: cy + r * 1.1 };
    const leftC2 = { x: cx - r * 1.15, y: cy - r * 0.78 };

    const cubic = (p0: any, p1: any, p2: any, p3: any, t: number) => {
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      const uuu = uu * u;
      const ttt = tt * t;
      return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
      };
    };

    const pts: Array<{ x: number; y: number }> = [];
    const seg1 = Math.max(2, Math.floor(segments / 2));
    const seg2 = Math.max(2, segments - seg1);

    // top -> bottom (right side)
    for (let i = 0; i <= seg1; i++) {
      const t = i / seg1;
      pts.push(cubic(top, rightC1, rightC2, bottom, t));
    }
    // bottom -> top (left side)
    for (let i = 1; i <= seg2; i++) {
      const t = i / seg2;
      pts.push(cubic(bottom, leftC1, leftC2, top, t));
    }

    return pts;
  }

  // NEW: draw green progress over the yellow border
  function drawTeardropProgress(ctx: CanvasRenderingContext2D, w: number, h: number, progress01: number) {
    const p = Math.max(0, Math.min(1, progress01));
    if (p <= 0) return;

    const cx = w / 2;
    const cy = h * 0.36;
    const r = Math.min(w, h) * 0.46 * guideScale;

    const segments = 80;
    const pts = teardropBorderPoints(cx, cy, r, segments);
    const n = pts.length;
    const to = Math.max(1, Math.floor(p * (n - 1)));

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 5; // slightly thicker than base border
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2ee59d'; // green over yellow
    ctx.shadowColor = '#2ee59d';
    ctx.shadowBlur = p >= 0.999 ? 14 : 8;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= to; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawTeardropOverlay(w: number, h: number) {
    if (!ctx) return;
    // Fundo glassmorphism
    drawGlassBg(ctx, w, h);
    // Máscara (recorte)
    ctx.save();
    const cx = w / 2, cy = h * 0.36, r = Math.min(w, h) * 0.46 * guideScale;
    teardropPath(ctx, cx, cy, r);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    // Borda colorida por cima de tudo
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 4;
    ctx.strokeStyle = getOverlayColor();
    ctx.shadowColor = getOverlayColor();
    ctx.shadowBlur = 10;
    teardropPath(ctx, cx, cy, r);
    ctx.stroke();
    ctx.restore();

    // NEW: progress ring (green) over the base border
    // We only show progress while holding a step; when completed it will naturally go to 1.
    // The SDK passes this through input.debug.challengeHoldProgress (0..1).
    const holdP = typeof (lastRenderInput as any)?.debug?.challengeHoldProgress === 'number'
      ? (lastRenderInput as any).debug.challengeHoldProgress
      : 0;
    if (holdP > 0) drawTeardropProgress(ctx, w, h, holdP);
  }

  function drawGuides(w: number, h: number) {
    if (!ctx) return;
    ctx.save();
    const cx = w / 2, cy = h * 0.36, r = Math.min(w, h) * 0.46 * guideScale;
    ctx.save();
    teardropPath(ctx, cx, cy, r);
    ctx.clip();
    ctx.strokeStyle = '#fff'; // Sempre branco
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    // Parâmetros de curvatura
    const bendX = guideBend.x * r * 0.45;
    const bendY = guideBend.y * r * 0.45;
    // Vertical (curva invertida, dobra para esquerda/direita)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.78);
    ctx.bezierCurveTo(
      cx + bendX * 0.5, cy - r * 0.25 + bendY * 0.2,
      cx + bendX * 0.5, cy + r * 0.65 + bendY * 0.2,
      cx, cy + r * 1.18
    );
    ctx.stroke();
    // Horizontal (curva invertida, dobra para cima/baixo)
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.95, cy);
    ctx.bezierCurveTo(
      cx - r * 0.25, cy + r * 0.10 + bendY,
      cx + r * 0.25, cy + r * 0.10 + bendY,
      cx + r * 0.95, cy
    );
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // Estado para animação suave das linhas guias
  let guideBend = { x: 0, y: 0 };
  let guideBendVel = { x: 0, y: 0 }; // velocidade para efeito mola
  let targetBend = { x: 0, y: 0 };
  let lastTimestamp = 0;

  // Estado para boomerang: 'idle' | 'hold' | 'boomerang' | 'centerHold'
  let bendState: 'idle' | 'hold' | 'boomerang' | 'centerHold' = 'idle';
  let holdTimer = 0;
  let lastDir = { x: 0, y: 0 };

  // Parâmetros do ciclo
  const BEND_STRENGTH = 1.25; // mais forte
  const HOLD_TIME = 0.7; // tempo parado na posição (s) - mais rápido
  const CENTER_HOLD_TIME = 0.28; // tempo parado no centro (s) - mais rápido

  // Atualiza o alvo de curvatura conforme o challenge ativo
  function updateGuideBend(input: OverlayRenderInput, dt: number) {
    // Detecta direção alvo
    let dirX = 0, dirY = 0;
    // Agora aceita challenge.direction também para zoom e setas
    let dir: string | undefined = input.challenge?.direction;
    if (!dir && input.hint?.type === 'arrow') {
      dir = input.hint.direction;
    }
    if (dir === 'left') dirX = -1;
    else if (dir === 'right') dirX = 1;
    else if (dir === 'up') dirY = -1;
    else if (dir === 'down') dirY = 1;
    // Mudou de direção?
    const changed = dirX !== lastDir.x || dirY !== lastDir.y;
    if (changed) {
      bendState = 'hold';
      holdTimer = 0;
      lastDir.x = dirX;
      lastDir.y = dirY;
    }
    // Se direção ativa
    if (dirX !== 0 || dirY !== 0) {
      if (bendState === 'hold') {
        targetBend.x = dirX * BEND_STRENGTH;
        targetBend.y = dirY * BEND_STRENGTH;
        holdTimer += dt;
        if (holdTimer > HOLD_TIME) {
          bendState = 'boomerang';
          holdTimer = 0;
        }
      } else if (bendState === 'boomerang') {
        // Volta suavemente para o centro
        targetBend.x = 0;
        targetBend.y = 0;
        holdTimer += dt;
        if (holdTimer > CENTER_HOLD_TIME) {
          bendState = 'hold';
          holdTimer = 0;
        }
      } else {
        // idle/centerHold: mantém centro
        targetBend.x = 0;
        targetBend.y = 0;
      }
    } else {
      // Sem challenge: volta para centro
      targetBend.x = 0;
      targetBend.y = 0;
      bendState = 'idle';
    }
  }

  // Interpola suavemente o valor atual para o alvo (ease-in-out)
  function animateGuideBend(dt: number) {
    // speed maior para resposta rápida e smooth
    const speed = 8.5; // era 1.1, agora bem mais rápido e suave
    guideBend.x += (targetBend.x - guideBend.x) * Math.min(1, dt * speed);
    guideBend.y += (targetBend.y - guideBend.y) * Math.min(1, dt * speed);
  }

  // Estado para animação de escala (zoom)
  let guideScale = 1;
  let targetScale = 1;

  // Parâmetros do ciclo de zoom
  const ZOOM_IN_SCALE = 1.28;
  const ZOOM_OUT_SCALE = 0.72;
  const ZOOM_SPEED = 3.8; // suavidade da animação (bem mais rápido)

  function updateGuideZoom(input: OverlayRenderInput) {
    // Força o zoom pelo feedbackCode também
    const feedback = input.debug?.feedbackCode;
    if (input.challenge?.direction === 'zoomIn' || feedback === 'ZOOM_IN') {
      targetScale = ZOOM_IN_SCALE;
    } else if (input.challenge?.direction === 'zoomOut' || feedback === 'ZOOM_OUT') {
      targetScale = ZOOM_OUT_SCALE;
    } else {
      targetScale = 1;
    }
  }

  function animateGuideZoom(dt: number) {
    // Interpola suavemente para o targetScale
    guideScale += (targetScale - guideScale) * Math.min(1, dt * ZOOM_SPEED);
    if (Math.abs(guideScale - targetScale) < 0.001) guideScale = targetScale;
  }

  // 1. Definição dos estados possíveis do fluxo
  const OverlayState = {
    IDLE: 'IDLE',
    CAMERA_ON: 'CAMERA_ON',
    FACE_DETECTED: 'FACE_DETECTED',
    ALIGNED: 'ALIGNED',
    SUCCESS: 'SUCCESS',
    FAIL: 'FAIL',
  } as const;
  type OverlayStateType = typeof OverlayState[keyof typeof OverlayState];

  // 2. Variável de estado
  let overlayState: OverlayStateType = OverlayState.IDLE;

  // 3. Função para atualizar o estado com base nas condições
  function updateOverlayState(input: OverlayRenderInput) {
    // IDLE: aguardando início (sem vídeo)
    if (!input.video) {
      overlayState = OverlayState.IDLE;
      return;
    }
    // CAMERA_ON: vídeo ativo, aguardando rosto
    if (!input.box) {
      overlayState = OverlayState.CAMERA_ON;
      return;
    }
    // FACE_DETECTED: rosto detectado, aguardando alinhamento
    if (input.box && !input.valid) {
      overlayState = OverlayState.FACE_DETECTED;
      return;
    }
    // ALIGNED: rosto alinhado, aguardando confirmação
    if (input.box && input.valid) {
      overlayState = OverlayState.ALIGNED;
      // Sucesso/falha podem ser definidos por lógica externa, mas podemos sugerir:
      if (input.debug?.stepPassed === true) {
        overlayState = OverlayState.SUCCESS;
        return;
      }
      if (input.debug?.stepPassed === false) {
        overlayState = OverlayState.FAIL;
        return;
      }
      return;
    }
    // fallback
    overlayState = OverlayState.IDLE;
  }

  // Checa se um ponto está dentro da máscara (para integração com landmarks)
  function isInsideTeardrop(x: number, y: number, w: number, h: number) {
    const cx = w / 2, cy = h * 0.36, r = Math.min(w, h) * 0.46 * guideScale;
    const path = teardropPath2D(cx, cy, r);
    return ctx?.isPointInPath(path, x, y) ?? false;
  }

  // Fundo glassmorphism (simples e barato) — mantém comportamento anterior
  function drawGlassBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Função utilitária para cor do overlay conforme estado
  function getOverlayColor(): string {
    switch (overlayState) {
      case OverlayState.FACE_DETECTED:
        return '#FF9800'; // laranja
      case OverlayState.ALIGNED:
        return '#FFD44D'; // amarelo
      case OverlayState.SUCCESS:
        return '#2ee59d'; // verde
      default:
        return '#FFD44D'; // padrão: amarelo
    }
  }

  // Substituir o loop de renderização para garantir dt consistente
  function render(input: OverlayRenderInput) {
    lastRenderInput = input;
    // Atualiza o estado do overlay
    updateOverlayState(input);
    const { w, h } = resizeToContainer(canvas, container, ctx || undefined);
    if (!ctx) return;
    // --- Mapper igual overlay padrão ---
    const mapper = getVideoToContainerMapper(w, h, input.video, input.videoObjectFit, input.mirrored ? false : true);
    // --- animação das linhas guias ---
    let now = performance.now();
    let dt = lastTimestamp ? (now - lastTimestamp) / 1000 : 0.016;
    if (dt > 0.1) dt = 0.016; // limita dt para evitar pulos grandes
    lastTimestamp = now;
    // Landmark draw toggles (default ON)
    const drawEyes = input.landmarkDraw?.eyes !== false;
    const drawMouth = input.landmarkDraw?.mouth !== false;
    const drawNose = input.landmarkDraw?.nose !== false;
    const drawJaw = input.landmarkDraw?.jaw !== false;
    const drawMouthJaw = input.landmarkDraw?.mouthJaw !== false;
    const drawCfg = input.landmarkDraw || {};
    // --- animação das linhas guias ---
    updateGuideBend(input, dt);
    animateGuideBend(dt);
    updateGuideZoom(input);
    animateGuideZoom(dt);
    // Debug: loga challenge e escala
    if (input.challenge?.direction === 'zoomIn' || input.challenge?.direction === 'zoomOut') {
      console.log('challenge.direction:', input.challenge.direction, 'guideScale:', guideScale, 'targetScale:', targetScale);
    }
    // ---
    drawTeardropOverlay(w, h);
    drawGuides(w, h);
    // Mensagem
    if (input.message) {
      ctx.save();
      ctx.font = '600 1.1rem system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#222';
      ctx.shadowBlur = 8;
      // Keep message safely above the manual capture button area.
      // On small screens, 0.76 avoids overlap.
      ctx.fillText(input.message, w / 2, h * 0.76);
      ctx.restore();
    }
    // Exemplo de integração: desenhar ponto do centro do rosto se landmarks disponíveis
    const shouldDrawCenter = drawEyes || drawMouth || drawNose || drawJaw || drawMouthJaw;
    const showCenterDot = input.debug?.extra?.showCoxinhaCenterDot === true;
    if (input.box && shouldDrawCenter && showCenterDot) {
      const cx = input.box.x + input.box.width / 2;
      const cy = input.box.y + input.box.height / 2;
      const pt = mapper.mapPt({ x: cx, y: cy });
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = isInsideTeardrop(pt.x, pt.y, w, h) ? '#4caf50' : '#ff5252';
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.restore();
    }
    // --- Landmarks e debug overlays ---
    const lm = input.landmarks;
    if (lm) {
      // Olhos
      if (drawEyes && (lm.leftEye || lm.rightEye)) {
        ctx.save();
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        if (lm.leftEye) {
          ctx.beginPath();
          lm.leftEye.forEach((pt, i) => {
            const p = mapper.mapPt(pt);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
        }
        if (lm.rightEye) {
          ctx.beginPath();
          lm.rightEye.forEach((pt, i) => {
            const p = mapper.mapPt(pt);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
      // Boca
      if (drawMouth && lm.mouthPoints) {
        ctx.save();
        ctx.strokeStyle = '#ffb300';
        ctx.lineWidth = 2;
        ctx.beginPath();
        lm.mouthPoints.forEach((pt, i) => {
          const p = mapper.mapPt(pt);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      // Jaw
      if (drawJaw && lm.jawPoints) {
        ctx.save();
        ctx.strokeStyle = '#81c784';
        ctx.lineWidth = 2;
        ctx.beginPath();
        lm.jawPoints.forEach((pt, i) => {
          const p = mapper.mapPt(pt);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      }
      // Nariz
      if (drawNose && lm.nosePoints) {
        ctx.save();
        ctx.strokeStyle = '#ba68c8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        lm.nosePoints.forEach((pt, i) => {
          const p = mapper.mapPt(pt);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      }
      // Boca↔Jaw (linhas)
      if (drawMouthJaw && lm.mouthLeft && lm.jawLeft) {
        ctx.save();
        ctx.strokeStyle = '#e57373';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const p1 = mapper.mapPt(lm.mouthLeft);
        const p2 = mapper.mapPt(lm.jawLeft);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }
      if (drawMouthJaw && lm.mouthRight && lm.jawRight) {
        ctx.save();
        ctx.strokeStyle = '#e57373';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const p1 = mapper.mapPt(lm.mouthRight);
        const p2 = mapper.mapPt(lm.jawRight);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }
    }
    // Cheese debug panel (painel de sorriso)
    if (drawCfg.cheese && input.debug?.cheeseBaseline != null) {
      ctx.save();
      ctx.font = 'bold 1rem system-ui, sans-serif';
      ctx.fillStyle = '#FFD44D';
      ctx.shadowColor = '#222';
      ctx.shadowBlur = 6;
      ctx.fillText(`cheese baseline: ${input.debug.cheeseBaseline.toFixed(3)}`, w / 2, h * 0.08);
      if (input.debug.cheeseTarget != null) {
        ctx.fillText(`cheese target: ${input.debug.cheeseTarget.toFixed(3)}`, w / 2, h * 0.13);
      }
      ctx.restore();
    }
    // Debug panel (bottom-left, igual overlay default)
    if (input.debug && input.debug.extra?.showOverlayTableCanvas) {
      const pad = 12;
      const lineH = 16;
      const panelW = Math.min(520, Math.round(w * 0.62));
      const lines: string[] = [];

      // --- Adiciona status dos desenhos, igual overlay padrão ---
      lines.push(`drawLandmarks: ${input.debug.drawLandmarks !== false ? 'ON' : 'OFF'}`);
      lines.push(`draw: eyes=${drawEyes ? 'ON' : 'OFF'} | mouth=${drawMouth ? 'ON' : 'OFF'} | jaw=${drawJaw ? 'ON' : 'OFF'} | nose=${drawNose ? 'ON' : 'OFF'} | mouth↔jaw=${drawMouthJaw ? 'ON' : 'OFF'}`);
      lines.push(`cheese panel: ${drawCfg.cheese ? 'ON' : 'OFF'}`);
      lines.push('');
      // NOVO: Exibe o estado atual do overlay
      lines.push(`Overlay State: ${overlayState}`);

      // Replicando exatamente o overlay padrão:
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

      // Fallback visual se não houver linhas
      if (lines.length === 0) {
        lines.push('Debug ativo (nenhum dado)');
      }

      // panel background
      const panelH = pad * 2 + lines.length * lineH;
      const x0 = 12;
      const y0 = Math.max(8, h - panelH - 88); // nunca deixa sair da tela
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeStyle = '#FFD44D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x0, y0, panelW, panelH, 10);
      } else {
        ctx.rect(x0, y0, panelW, panelH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x0 + pad, y0 + pad + i * lineH);
      }
      ctx.restore();
    }
  }

  function dispose() {
    canvas.remove();
  }

  return {
    canvas,
    dispose,
    render,
  };
}
