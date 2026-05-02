export interface LoaderHandle {
  show(): void;
  hide(): void;
  dispose(): void;
}

export interface LoaderOptions {
  /** Image URL for the loader (gif). Omit or leave empty for spinner-only. */
  src?: string;
  /** Size in pixels. */
  sizePx?: number;
  /** Minimum visible time in ms (prevents flicker). */
  minVisibleMs?: number;
}

function createBuiltInSpinner(sizePx: number): HTMLDivElement {
  const s = document.createElement('div');
  s.className = 'alphavalid-camera-loader__spinner';
  s.style.width = `${sizePx}px`;
  s.style.height = `${sizePx}px`;
  s.style.borderRadius = '999px';
  s.style.boxSizing = 'border-box';
  s.style.border = '6px solid rgba(255,255,255,0.35)';
  s.style.borderTopColor = 'rgba(0, 188, 212, 0.95)';
  s.style.animation = 'alphavalid-spin 0.85s linear infinite';

  const styleId = 'alphavalid-camera-loader-style';
  if (!document.getElementById(styleId)) {
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `@keyframes alphavalid-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(st);
  }

  return s;
}

export function createCameraLoader(container: HTMLElement, opts: LoaderOptions = {}): LoaderHandle {
  const useGif = typeof opts.src === 'string' && opts.src.length > 0;
  const sizePx = opts.sizePx ?? 120;
  const minVisibleMs = opts.minVisibleMs ?? 900;

  let node: HTMLDivElement | null = null;
  let shownAt = 0;
  let hideTimer: number | null = null;

  const ensureContainerPosition = () => {
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
  };

  const ensure = () => {
    if (node) return node;
    ensureContainerPosition();

    node = document.createElement('div');
    node.className = 'alphavalid-camera-loader';
    node.style.position = 'absolute';
    node.style.inset = '0';
    node.style.display = 'flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.background = 'transparent';
    node.style.zIndex = '999';

    const spinner = createBuiltInSpinner(sizePx);
    node.appendChild(spinner);

    if (useGif) {
      const img = document.createElement('img');
      img.alt = 'Carregando...';
      img.style.width = `${sizePx}px`;
      img.style.height = `${sizePx}px`;
      img.style.display = 'none';

      img.onload = () => {
        spinner.style.display = 'none';
        img.style.display = 'block';
      };

      img.onerror = () => {
        img.style.display = 'none';
      };

      img.src = opts.src as string;
      node.appendChild(img);
    }

    container.appendChild(node);
    return node;
  };

  const show = () => {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    ensure();
    shownAt = Date.now();
    if (node) node.style.display = 'flex';
  };

  const hide = () => {
    if (!node) return;
    const elapsed = Date.now() - shownAt;
    const wait = Math.max(0, minVisibleMs - elapsed);
    if (wait > 0) {
      if (hideTimer != null) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        hideTimer = null;
        if (node) node.style.display = 'none';
      }, wait);
      return;
    }
    node.style.display = 'none';
  };

  const dispose = () => {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    node?.remove();
    node = null;
  };

  return { show, hide, dispose };
}
