/**
 * Сборка `window.__bench` — API страницы для e2e: готовность по DOM-контракту (`screens.ts`),
 * отметка `bench:ready`, перемонтирование с замером, ожидание покоя, управление fake API,
 * отправленные payload.
 *
 * Слоя представления здесь нет: как форма монтируется и снимается, говорит хост ({@link BenchHost}).
 * Страницы бенчмарка монтируют React-компонент через `mount.tsx`; страницы кросс-фреймворк
 * проверки (React, Vue, Angular) зовут `installBench` сами и подключают свои стили.
 */
import { serverConfig, serverControl } from '../api/server';
import { apiInspect } from '../api/client';
import { expectedScreen, isScreenReady, type FormId, type ScreenMarkup } from './screens';
import { frameEnd, idle, untilFrame, type IdleOptions } from './timing';

export interface BenchWindowApi {
  id: string;
  form: FormId;
  /** Момент готовности первого монтирования (от `timeOrigin`), `null` — ещё не готово. */
  readyAt: number | null;
  ready: Promise<number>;
  /**
   * Смонтировать форму заново. `sync` — синхронный рендер + commit + эффекты (без квантования
   * кадром); `ready` — до конца кадра, в котором DOM-контракт выполнен (включает асинхронную
   * догрузку реализации). Оба — мс.
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

/** Как страница монтирует и снимает форму. */
export interface BenchHost {
  /**
   * Смонтировать форму заново: и первый показ, и перемонтирование. `sync` — рендер, запись в DOM
   * и эффекты должны закончиться до возврата (замер `mount().sync`); без него хост монтирует
   * своим обычным способом.
   */
  mount(sync: boolean): void;
  unmount(): void;
}

/**
 * id участника — сегмент пути перед формой (`/<id>/<form>/`), на dev-сервере тоже. Не первый: под
 * префиксом публикации на сайте (`/ReFormer/benchmark-apps/<id>/<form>/`) первым идёт префикс.
 */
function benchId(): string {
  const segments = location.pathname.split('/').filter((s) => s && s !== 'index.html');
  return segments.at(-2) ?? segments[0] ?? 'unknown';
}

/**
 * Смонтировать форму хостом, дождаться готовности первого экрана в `container` и опубликовать
 * `window.__bench`.
 *
 * @param markup - Разметка страницы, где она отличается от разметки бенчмарка (мастер китов).
 */
export function installBench(
  form: FormId,
  container: ParentNode,
  host: BenchHost,
  markup: ScreenMarkup = {}
): BenchWindowApi {
  const expectation = expectedScreen(form, markup);
  const isReady = () => isScreenReady(container, expectation);

  const bench: BenchWindowApi = {
    id: benchId(),
    form,
    readyAt: null,
    ready: Promise.resolve(0),
    async mount() {
      const start = performance.now();
      host.mount(true);
      const sync = performance.now() - start;
      const end = await untilFrame(isReady);
      return { sync, ready: end - start };
    },
    async unmount() {
      host.unmount();
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

  host.mount(false);
  bench.ready = untilFrame(isReady, 30_000).then((t) => {
    performance.mark('bench:ready', { startTime: t });
    bench.readyAt = t;
    return t;
  });
  window.__bench = bench;
  return bench;
}
