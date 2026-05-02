export function ensureBaseStyles(container?: HTMLElement) {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('alphavalid-base-styles')) {
    const style = document.createElement('style');
    style.id = 'alphavalid-base-styles';
    style.textContent = `
      /* Reset basics for full-screen portrait mobile UX */
      html, body { height: 100%; min-height: 100svh; margin: 0; padding: 0; }
      body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

      /* Root container for SDK camera. By default we assume mobile/portrait usage */
      .alphavalid-root {
        position: relative !important;
        width: 100vw !important;
        height: 100svh !important;
        max-width: none !important;
        margin: 0 !important;
        background: #000 !important;
        overflow: hidden !important;
        touch-action: manipulation !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }

      /* Ensure video fills container */
      .alphavalid-root video {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        transform-origin: center !important;
      }

      /* Make sure loader and preview cover the area */
      .alphavalid-camera-loader { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 999; }
      .alphavalid-userPreview { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; z-index: 9999; }

      /* Capture button sensible defaults */
      .alphavalid-captureBtn { -webkit-tap-highlight-color: transparent; }

      /* Mobile-friendly font sizing for messages on small screens */
      @media (max-width: 420px) {
        .alphavalid-userPreview .alphavalid-userPreview-meta { font-size: 0.95rem; }
      }

    `;
    document.head.appendChild(style);
  }

  if (container) {
    try {
      container.classList.add('alphavalid-root');
    } catch {}
  }
}
