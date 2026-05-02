import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'custom',

  publicDir: false,

  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AlphaValid',
      formats: ['es', 'umd'],
      fileName: (format) => `petsphere-kyc-sdk.${format}.js`
    },
    rollupOptions: {
      external: []
    }
  }
});
