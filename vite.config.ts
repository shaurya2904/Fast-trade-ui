import { defineConfig } from 'vite';

export default defineConfig({
  // SharedArrayBuffer requires these headers.
  // Without Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy,
  // browsers will throw a SecurityError when you try to use SharedArrayBuffer.
  // This is a post-Spectre security requirement. Non-negotiable.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Manual chunking: keep worker code separate from main bundle.
        // Workers are loaded independently — no point bundling them together.
        manualChunks(id) {
          if (id.includes('worker')) return 'workers';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
