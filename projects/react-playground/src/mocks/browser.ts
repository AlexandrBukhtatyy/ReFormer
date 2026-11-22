import { setupWorker } from 'msw/browser';
import { handlers } from './_generated/msw-handlers';
import { formSchemaHandlers } from './form-schema-handlers';

// Рукописные обработчики идут ПЕРВЫМИ: MSW берёт первый подошедший, и так наши маршруты не
// перехватит случайный шаблон из сгенерированного набора.
export const worker = setupWorker(...formSchemaHandlers, ...handlers);

/** Как часто страница напоминает о себе воркеру — в такт собственному keepalive MSW. */
const REACTIVATE_INTERVAL_MS = 5000;

/**
 * Не даёт мокам молча отключиться, пока страница открыта.
 *
 * Service Worker MSW помнит страницы с включёнными моками только в памяти (`activeClientIds`), а
 * браузер останавливает простаивающий воркер: вкладка ушла в фон и таймеры keepalive замедлились,
 * компьютер уснул, в DevTools нажали Stop. Перезапущенный воркер начинает с пустым списком и
 * пропускает ВСЕ запросы в сеть: `/api/*` попадает на dev-сервер, тот отвечает `index.html` с кодом
 * 200, и формы падают на разборе JSON — «Unexpected token '<'». Помогала только перезагрузка.
 *
 * Сам MSW страницу повторно не объявляет: `MOCK_ACTIVATE` уходит один раз из `worker.start()`, а
 * его keepalive список не восстанавливает. Поэтому объявляем сами — по таймеру и сразу при
 * возврате на вкладку. Сообщение идемпотентно (воркер кладёт идентификатор в `Set`), а ответ
 * `MOCKING_ENABLED` клиент MSW слушает через `once` и повторный пропускает.
 *
 * `MOCK_ACTIVATE` — внутренний протокол `public/mockServiceWorker.js`: при обновлении msw сверить.
 */
export function keepMockingActive(): void {
  const activate = (): void => {
    navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE');
  };
  window.setInterval(activate, REACTIVATE_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') activate();
  });
}
