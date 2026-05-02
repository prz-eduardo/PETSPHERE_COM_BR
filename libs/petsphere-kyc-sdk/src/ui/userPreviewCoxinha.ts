import type { AlphaValidStartOptions } from '../types/sdk';

export type UserPreviewUiHandle = {
  show: (srcUrl: string, metaText?: string) => void;
  hide: () => void;
  dispose: () => void;
};

function ensureContainerPositioned(container: HTMLElement) {
  const pos = getComputedStyle(container).position;
  if (pos === 'static') container.style.position = 'relative';
}

export function createUserPreviewCoxinhaUi(params: {
  container: HTMLElement;
  labels?: { ok?: string; retake?: string };
  onOk: () => void;
  onRetake: () => void;
}): UserPreviewUiHandle {
  const { container, labels, onOk, onRetake } = params;

  ensureContainerPositioned(container);

  const wrap = document.createElement('div');
  wrap.className = 'alphavalid-userPreview';
  wrap.style.position = 'absolute';
  wrap.style.inset = '0';
  wrap.style.display = 'none';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '10px';
  wrap.style.background = 'rgba(0,0,0,0.45)';
  (wrap.style as any).backdropFilter = 'blur(2px)';
  wrap.style.zIndex = '999999';
  wrap.style.pointerEvents = 'auto';
  (wrap.style as any).touchAction = 'manipulation';

  const img = document.createElement('img');
  img.className = 'alphavalid-userPreview-img';
  img.alt = 'preview';
  img.style.width = '88%';
  img.style.maxWidth = '360px';
  img.style.maxHeight = '70%';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '16px';
  img.style.boxShadow = '0 10px 28px rgba(0,0,0,0.35)';

  const meta = document.createElement('div');
  meta.className = 'alphavalid-userPreview-meta';
  meta.style.color = '#fff';
  meta.style.fontWeight = '600';
  meta.style.textAlign = 'center';
  meta.style.fontSize = '0.95rem';
  meta.style.padding = '0 16px';

  const actions = document.createElement('div');
  actions.className = 'alphavalid-userPreview-actions';
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.marginTop = '6px';
  actions.style.pointerEvents = 'auto';
  actions.style.zIndex = '1000000';

  const btnRetake = document.createElement('button');
  btnRetake.type = 'button';
  btnRetake.className = 'alphavalid-userPreview-retake';
  btnRetake.textContent = labels?.retake ?? 'Tirar outra';
  btnRetake.style.padding = '10px 14px';
  btnRetake.style.borderRadius = '12px';
  btnRetake.style.border = '1px solid rgba(255,255,255,0.35)';
  btnRetake.style.background = 'rgba(0,0,0,0.35)';
  btnRetake.style.color = '#fff';
  btnRetake.style.fontWeight = '700';
  btnRetake.style.cursor = 'pointer';
  btnRetake.style.pointerEvents = 'auto';
  (btnRetake.style as any).touchAction = 'manipulation';

  const btnOk = document.createElement('button');
  btnOk.type = 'button';
  btnOk.className = 'alphavalid-userPreview-ok';
  btnOk.textContent = labels?.ok ?? 'OK';
  btnOk.style.padding = '10px 16px';
  btnOk.style.borderRadius = '12px';
  btnOk.style.border = '1px solid rgba(255,255,255,0.35)';
  btnOk.style.background = '#ffffff';
  btnOk.style.color = '#111';
  btnOk.style.fontWeight = '800';
  btnOk.style.cursor = 'pointer';
  btnOk.style.pointerEvents = 'auto';
  (btnOk.style as any).touchAction = 'manipulation';

  btnRetake.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onRetake();
  });

  btnOk.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onOk();
  });

  actions.appendChild(btnRetake);
  actions.appendChild(btnOk);

  wrap.appendChild(img);
  wrap.appendChild(meta);
  wrap.appendChild(actions);

  container.appendChild(wrap);

  return {
    show: (srcUrl: string, metaText?: string) => {
      img.src = srcUrl;
      meta.textContent = metaText ?? '';
      wrap.style.display = 'flex';
    },
    hide: () => {
      wrap.style.display = 'none';
      img.removeAttribute('src');
      meta.textContent = '';
    },
    dispose: () => {
      wrap.remove();
    }
  };
}

export function labelsFromStartOptions(options: AlphaValidStartOptions) {
  return {
    ok: options.previewOkText,
    retake: (options as any).previewRetakeText as string | undefined
  };
}
