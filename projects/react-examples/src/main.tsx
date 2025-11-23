import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // В StackBlitz моки работают через proxy к mock-server (см. npm run dev:stackblitz)
  // Service Worker не поддерживается в StackBlitz WebContainers
  const isStackBlitz =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('stackblitz') ||
      window.location.hostname.includes('webcontainer'));

  if (isStackBlitz) {
    console.log('[MSW] Running in StackBlitz mode - using proxy to mock server');
    return;
  }

  const { worker } = await import('./mocks/browser.ts');
  return worker.start();
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
