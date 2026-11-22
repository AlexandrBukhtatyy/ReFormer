/**
 * Харнесс страницы — одинаковый для всех реализаций.
 *
 * Монтирует форму, сам определяет готовность по DOM-контракту (`screens.ts`), ставит отметки
 * `bench:ready` и публикует `window.__bench` — API для e2e: перемонтирование с замером, ожидание
 * покоя, управление fake API, отправленные payload.
 */
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ComponentType } from 'react';
import { serverConfig, serverControl } from '../api/server';
import { apiInspect } from '../api/client';
import { expectedScreen, isScreenReady, type FormId } from './screens';
import { frameEnd, idle, untilFrame, type IdleOptions } from './timing';
import '../ui/bench.css';

export interface BenchWindowApi {
  id: string;
  form: FormId;
  /** Момент готовности первого монтирования (от `timeOrigin`), `null` — ещё не готово. */
  readyAt: number | null;
  ready: Promise<number>;
  /**
   * Смонтировать форму заново. `sync` — синхронный рендер + commit + эффекты (`flushSync`, без
   * квантования кадром); `ready` — до конца кадра, в котором DOM-контракт выполнен (включает
   * асинхронную догрузку реализации). Оба — мс.
   */
  mount(): Promise<{ sync: number; ready: number }>;
  unmount(): Promise<void>;
  idle(opts?: IdleOptions): Promise<number>;
  frame(): Promise<number>;
  api: {
    config: typeof serverConfig;
    calls: Record<string, number>;
    flush(): number;
    pending(): number;
    resetCalls(): void;
    peekCaptcha(): string;
  };
  submissions: unknown[];
}

declare global {
  interface Window {
    __bench?: BenchWindowApi;
  }
}

/** id участника — первый сегмент пути (`/<id>/<form>/`), на dev-сервере тоже. */
function benchId(): string {
  return location.pathname.split('/').filter(Boolean)[0] ?? 'unknown';
}

export function mountBench(form: FormId, App: ComponentType): BenchWindowApi {
  const container = document.getElementById('root');
  if (!container) throw new Error('#root not found');
  let root: Root | null = null;
  let generation = 0;
  const expectation = expectedScreen(form);
  const isReady = () => isScreenReady(container, expectation);

  const render = () => {
    root ??= createRoot(container);
    generation++;
    root.render(<App key={generation} />);
  };

  const bench: BenchWindowApi = {
    id: benchId(),
    form,
    readyAt: null,
    ready: Promise.resolve(0),
    async mount() {
      const start = performance.now();
      flushSync(render);
      const sync = performance.now() - start;
      const end = await untilFrame(isReady);
      return { sync, ready: end - start };
    },
    async unmount() {
      root?.unmount();
      root = null;
      await frameEnd();
    },
    idle,
    frame: frameEnd,
    api: {
      config: serverConfig,
      calls: serverControl.calls,
      flush: serverControl.flush,
      pending: serverControl.pending,
      resetCalls: serverControl.resetCalls,
      peekCaptcha: apiInspect.peekCaptcha,
    },
    submissions: apiInspect.submissions,
  };

  render();
  bench.ready = untilFrame(isReady, 30_000).then((t) => {
    performance.mark('bench:ready', { startTime: t });
    bench.readyAt = t;
    return t;
  });
  window.__bench = bench;
  return bench;
}
