// Centralized canvas and math utilities for overlays

// Clamp a value between a and b
export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

// Clamp a value between 0 and 1
export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

// Resize canvas to match container size and device pixel ratio
export function resizeToContainer(canvas: HTMLCanvasElement, container: HTMLElement, ctx?: CanvasRenderingContext2D) {
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== pxW) canvas.width = pxW;
  if (canvas.height !== pxH) canvas.height = pxH;
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: cssW, h: cssH };
}

// Map video coordinates to container coordinates
export function getVideoToContainerMapper(
  w: number,
  h: number,
  video?: HTMLVideoElement,
  objectFit?: string,
  mirrored?: boolean
) {
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
  const fit = objectFit ?? 'cover';
  const mir = typeof mirrored === 'boolean' ? mirrored : false;
  let dispW = w, dispH = h;
  if (fit === 'fill') {
    dispW = w; dispH = h;
  } else if (fit === 'contain' || fit === 'scale-down') {
    const s = Math.min(w / vw, h / vh);
    dispW = vw * s; dispH = vh * s;
  } else if (fit === 'none') {
    dispW = Math.min(w, vw); dispH = Math.min(h, vh);
  } else {
    const s = Math.max(w / vw, h / vh);
    dispW = vw * s; dispH = vh * s;
  }
  const offX = (w - dispW) / 2;
  const offY = (h - dispH) / 2;
  const mapPt = (p: { x: number; y: number }) => {
    const nx = mir ? 1 - p.x : p.x;
    return { x: offX + nx * dispW, y: offY + p.y * dispH };
  };
  const mapRect = (r: { x: number; y: number; width: number; height: number }) => {
    const p0 = mapPt({ x: r.x, y: r.y });
    const p1 = mapPt({ x: r.x + r.width, y: r.y + r.height });
    const x0 = Math.min(p0.x, p1.x);
    const y0 = Math.min(p0.y, p1.y);
    const x1 = Math.max(p0.x, p1.x);
    const y1 = Math.max(p0.y, p1.y);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  };
  return { mapPt, mapRect };
}
