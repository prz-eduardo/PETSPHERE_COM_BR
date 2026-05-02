export type CaptureButtonUiHandle = {
  show: () => void;
  hide: () => void;
  dispose: () => void;
  setEnabled: (enabled: boolean) => void;
};

function ensureContainerPositioned(container: HTMLElement) {
  const pos = getComputedStyle(container).position;
  if (pos === 'static') container.style.position = 'relative';
}

export function createCaptureButtonCoxinhaUi(params: {
  container: HTMLElement;
  text?: string;
  color?: string;
  onClick: () => void;
}): CaptureButtonUiHandle {
  const { container, text, color, onClick } = params;

  ensureContainerPositioned(container);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'alphavalid-captureBtn';
  btn.textContent = text ?? 'Capturar imagem';

  btn.style.position = 'absolute';
  btn.style.left = '50%';
  // Keep button in a bottom band, away from hint text.
  btn.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 24px)';
  btn.style.transform = 'translateX(-50%)';
  btn.style.width = '88%';
  btn.style.maxWidth = '340px';
  btn.style.height = '56px';
  btn.style.borderRadius = '18px';
  btn.style.border = 'none';
  btn.style.background = color ?? '#00bcd4';
  btn.style.color = '#fff';
  btn.style.fontWeight = '800';
  btn.style.fontSize = '1.05rem';
  btn.style.cursor = 'pointer';
  btn.style.zIndex = '999998';
  btn.style.boxShadow = '0 10px 22px rgba(0,0,0,0.28)';
  (btn.style as any).touchAction = 'manipulation';
  (btn.style as any)['-webkit-tap-highlight-color'] = 'transparent';

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (btn.disabled) return;
    onClick();
  });

  container.appendChild(btn);

  return {
    show: () => {
      btn.style.display = 'block';
    },
    hide: () => {
      btn.style.display = 'none';
    },
    dispose: () => {
      btn.remove();
    },
    setEnabled: (enabled: boolean) => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.55';
    }
  };
}
