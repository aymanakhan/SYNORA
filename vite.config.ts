/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Serve MediaPipe's WebAssembly runtime from our own origin (dev) and copy it
 * into the build, so camera gestures never load code from a CDN.
 */
function mediapipeWasm(): Plugin {
  const dir = path.resolve('node_modules/@mediapipe/tasks-vision/wasm');
  const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];
  return {
    name: 'synora-mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use('/mediapipe/', (req, res, next) => {
        const f = (req.url ?? '').replace(/^\//, '').split('?')[0];
        if (!files.includes(f)) return next();
        res.setHeader('Content-Type', f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        fs.createReadStream(path.join(dir, f)).pipe(res);
      });
    },
    generateBundle() {
      for (const f of files) {
        this.emitFile({ type: 'asset', fileName: `mediapipe/${f}`, source: fs.readFileSync(path.join(dir, f)) });
      }
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: './',
  plugins: [react(), tailwindcss(), mediapipeWasm()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
