/**
 * Монтирование React в браузерном прогоне.
 *
 * Библиотеки-обёртки здесь нет намеренно: одна зависимость (`@vitest/browser`) вместо трёх,
 * а всё, ради чего обычно берут обёртку, у браузерного прогона уже есть — поиск по ролям и
 * ввод с клавиатуры приходят из `@vitest/browser/context` и работают через playwright.
 *
 * ## `act` не используется
 *
 * Ввод в браузерном прогоне — настоящие события через CDP, и обернуть их в `act` нельзя:
 * React о них узнаёт снаружи своего цикла. Поэтому утверждения пишутся повторяющимися
 * (`expect.element`, `vi.waitFor`), а не «отрисовал — сразу проверил». Это не слабость теста:
 * ровно так же ведёт себя приложение.
 *
 * @module testing/render
 */

import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

export interface Mounted {
  /** Контейнер, в который смонтирован узел. */
  readonly container: HTMLElement;
  /** Снимает монтаж досрочно. Повторный вызов безвреден. */
  unmount(): void;
}

interface Entry {
  readonly root: Root;
  readonly host: HTMLElement;
}

const mounted = new Set<Entry>();

/**
 * Монтирует узел в свежий контейнер внутри `document.body`.
 *
 * Контейнер свежий на каждый вызов: остатки прошлого теста в `body` — самая частая причина
 * «тест зелёный в одиночку и красный в наборе».
 */
export function renderReact(node: ReactNode): Mounted {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  root.render(node);
  const entry: Entry = { root, host };
  mounted.add(entry);
  return {
    container: host,
    unmount: () => {
      if (!mounted.delete(entry)) return;
      root.unmount();
      host.remove();
    },
  };
}

/** Снимает всё смонтированное. Зовётся из `afterEach` в setup-файле. */
export function cleanupRendered(): void {
  for (const entry of [...mounted]) {
    mounted.delete(entry);
    entry.root.unmount();
    entry.host.remove();
  }
}
