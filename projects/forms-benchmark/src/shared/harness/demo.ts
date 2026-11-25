/**
 * Вход моста к демо на сайте (`/benchmark/frameworks/demo`): страница формы в `iframe` с `?demo`
 * публикует наверх значения модели и состояние формы (`./demo-bridge.ts`).
 *
 * Мост есть только в сборке для демо: `build-frameworks.mjs --demo` задаёт
 * `globalThis.__BENCH_DEMO__ = true`, сборка для замеров — `false`. Тогда тело `connectDemo`
 * вырезается, а модуль моста остаётся без использований и выпадает из бандла. Импорт статический
 * намеренно: динамический `import()` бандлеры видят до вырезания мёртвого кода — Vite добавлял
 * помощник предзагрузки, а Angular (esbuild) выпускал чанк моста и выносил общий с ним код в
 * отдельный чанк основного бандла. На серверах разработки флага нет — мост выключен.
 */
import type { FormBundle } from '@reformer/core';
import { connectBridge } from './demo-bridge';

declare global {
  // Флаг сборки страниц стеков (`define`), см. описание модуля.
  var __BENCH_DEMO__: boolean | undefined;
}

/** Подключить сборку формы к демо. Перемонтирование подключает новую сборку вместо прежней. */
export function connectDemo<T>(bundle: FormBundle<T>): void {
  if (!globalThis.__BENCH_DEMO__) return;
  if (window.parent === window || !new URLSearchParams(window.location.search).has('demo')) return;
  connectBridge(bundle);
}
