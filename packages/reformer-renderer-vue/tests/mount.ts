/**
 * Монтирование компонента Vue в тестах: без `@vue/test-utils`, на голом `createApp`.
 */
import { createApp, nextTick, type Component } from 'vue';

export interface Mounted {
  /** Корень, в который смонтировано приложение. */
  root: HTMLElement;
  /** Дождаться перерисовки после записи в сигнал. */
  settle(): Promise<void>;
  unmount(): void;
}

const mounted = new Set<Mounted>();

/** Смонтировать компонент в документ. */
export function mount(component: Component, props?: Record<string, unknown>): Mounted {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const app = createApp(component, props);
  app.mount(root);
  const handle: Mounted = {
    root,
    settle: () => nextTick(),
    unmount: () => {
      if (!mounted.delete(handle)) return;
      app.unmount();
      root.remove();
    },
  };
  mounted.add(handle);
  return handle;
}

/** Снять всё, что смонтировал тест. */
export function unmountAll(): void {
  for (const handle of [...mounted]) handle.unmount();
}

/** Элемент по `data-testid`; `null` — такого нет. */
export function byTestId<E extends Element = HTMLElement>(root: ParentNode, id: string): E | null {
  return root.querySelector<E>(`[data-testid="${id}"]`);
}
