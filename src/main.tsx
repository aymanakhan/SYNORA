import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
// Self-hosted pixel font (SIL OFL 1.1), used only for branding and short headings.
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-600.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the production build only (dev server stays uncached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        // Once idle, warm the cache with the optional gesture files (~18 MB) so
        // camera gestures also work on a later offline visit.
        const warm = () => {
          void import('@mediapipe/tasks-vision').catch(() => undefined);
          for (const f of ['mediapipe/vision_wasm_internal.js', 'mediapipe/vision_wasm_internal.wasm', 'models/gesture_recognizer.task']) {
            void fetch(`${import.meta.env.BASE_URL}${f}`).catch(() => undefined);
          }
        };
        const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
        if (w.requestIdleCallback) w.requestIdleCallback(warm);
        else setTimeout(warm, 3000);
      })
      .catch(() => {
        /* offline reload unavailable; the app still works online */
      });
  });
}
