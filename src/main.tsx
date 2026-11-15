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
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline reload unavailable; the app still works online */
    });
  });
}
