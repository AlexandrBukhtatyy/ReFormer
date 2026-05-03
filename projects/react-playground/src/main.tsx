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

  // Отключение MSW для E2E-тестов: параметр URL ?mocks=off или window.__DISABLE_MSW__.
  // Когда page.route() в Playwright должен иметь приоритет над Service Worker,
  // MSW полностью отключается через этот флаг.
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (params.get('mocks') === 'off' || (window as any).__DISABLE_MSW__) {
      console.log('[MSW] Disabled via URL param or window flag');
      return;
    }
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
