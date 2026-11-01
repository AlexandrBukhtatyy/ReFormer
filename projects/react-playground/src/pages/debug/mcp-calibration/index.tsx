/**
 * Формы калибровки MCP: каждая папка `<кейс>-<таргет>/` — модуль, собранный из ответа
 * `generate_form` (`packages/reformer-mcp/eval/calibration/runtime.mjs`), и страница `Page.tsx`
 * калибровочного стенда вокруг него.
 *
 * Страницы находятся сами (`import.meta.glob`) и грузятся лениво: сгенерированный модуль может
 * оказаться сломанным, и его ошибка обязана остаться на его странице, а не уронить приложение.
 *
 * Адреса: кредитная заявка — `/mcp-credit-application-<таргет>-vcal`, их ждут проекты `iter-*`
 * e2e (`MCP_ITER_VERSION=cal`); остальное — `/mcp-calibration/<папка>`.
 */

import { lazy, Suspense, type ComponentType } from 'react';

const pages = import.meta.glob<{ default: ComponentType }>('./*/Page.tsx');

export interface CalibrationRoute {
  readonly id: string;
  readonly path: string;
  readonly Component: ComponentType;
}

export const calibrationRoutes: CalibrationRoute[] = Object.entries(pages).map(([file, load]) => {
  const id = file.split('/')[1];
  const credit = id.match(/^credit-(.+)$/);
  const Page = lazy(load);
  return {
    id,
    path: credit ? `/mcp-credit-application-${credit[1]}-vcal` : `/mcp-calibration/${id}`,
    Component: () => (
      <Suspense fallback={<p>Загрузка формы калибровки…</p>}>
        <Page />
      </Suspense>
    ),
  };
});
