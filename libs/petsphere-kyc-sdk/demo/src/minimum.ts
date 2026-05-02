import { AlphaValid } from '../../src/index';

const sdk = new AlphaValid();

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('[minimum]', ...args);
}

async function main() {
  await sdk.start({
    // Minimal liveness challenges sequence
    liveness: {
      // Keep it simple and deterministic
      challenges: [
        { type: 'lookForward' },
        { type: 'blink' },
        { type: 'lookLeft' },
        { type: 'lookRight' }
      ]
    },

    // Auto-capture when READY
    autoCapture: {
      enabled: true,
      stableMs: 650,
      holdStillMessage: 'Não se mova...'
    },

    // Final confirmed result (when user taps OK)
    onUserPreviewConfirm: (blob) => {
      log('confirmed blob', { bytes: blob.size, type: blob.type });
      // At this point the SDK stops (current behavior). Your app can upload the blob.
    },

    onError: (err) => {
      log('error', err);
    },

    onStateChange: (state) => {
    }
  });
}

main().catch((e) => {
  log('fatal', e);
});

// Hot reload safety (vite)
const hmr = (import.meta as any).hot as undefined | { dispose: (cb: () => void) => void };
if (hmr) {
  hmr.dispose(() => {
    void sdk.stop();
  });
}
