/**
 * Харнесс страницы — одинаковый для всех реализаций бенчмарка.
 *
 * Монтирует React-компонент формы и отдаёт его общей сборке `window.__bench` (`bench.ts`): она сама
 * определяет готовность по DOM-контракту (`screens.ts`), ставит отметки `bench:ready` и публикует
 * API для e2e — перемонтирование с замером, ожидание покоя, управление fake API, отправленные
 * payload.
 */
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ComponentType } from 'react';
import { installBench, type BenchWindowApi } from './bench';
import type { FormId } from './screens';
import '../ui/bench.css';

export type { BenchWindowApi } from './bench';

export function mountBench(form: FormId, App: ComponentType): BenchWindowApi {
  const container = document.getElementById('root');
  if (!container) throw new Error('#root not found');
  let root: Root | null = null;
  let generation = 0;

  const render = () => {
    root ??= createRoot(container);
    generation++;
    root.render(<App key={generation} />);
  };

  return installBench(form, container, {
    // `flushSync` — синхронный рендер + commit + эффекты: замер без квантования кадром.
    mount: (sync) => (sync ? flushSync(render) : render()),
    unmount: () => {
      root?.unmount();
      root = null;
    },
  });
}
