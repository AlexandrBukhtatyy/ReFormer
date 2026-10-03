import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { DEFAULT_LANG, loadLocale } from './i18n';

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

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// Локаль догружается до первого рендера: провайдер находит её в кэше загрузчика и рисует дерево
// сразу на нужном языке, без пустого кадра. Отказ загрузки приложение не останавливает — провайдер
// запросит локаль сам, а до тех пор компоненты скажут встроенным английским.
const localeReady = loadLocale.preload(DEFAULT_LANG).catch((error: unknown) => {
  console.error('[i18n] Не удалось загрузить локаль до старта:', error);
});

// Приложение рендерится ДАЖЕ если моки не поднялись. Без catch любой отказ worker.start()
// (заблокированный Service Worker в e2e, отозванная регистрация, отсутствующий mockServiceWorker.js)
// не давал бы дойти до createRoot — и вместо внятной ошибки получался бы белый экран.
const mocksReady = enableMocking().catch((error: unknown) => {
  console.error('[MSW] Не удалось запустить моки, приложение стартует без них:', error);
});

Promise.all([localeReady, mocksReady]).finally(render);
