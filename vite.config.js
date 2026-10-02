import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', strictPort: false },
  preview: { host: '127.0.0.1', strictPort: false },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
  },
  // ESM worker + glsl-as-string friendly defaults
  assetsInclude: ['**/*.glsl'],
});
