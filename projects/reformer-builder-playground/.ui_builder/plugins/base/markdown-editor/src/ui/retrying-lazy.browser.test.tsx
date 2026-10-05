/**
 * Отложенный компонент после отказа загрузки — в настоящем React.
 *
 * Проверяется то, ради чего обёртка написана: отказ не остаётся в компоненте навсегда,
 * и при этом выключенная сеть не превращается в бесконечные запросы.
 *
 * @module plugins/base/markdown-editor/ui/retrying-lazy.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { Component, Suspense, type ReactNode } from 'react';
import { renderReact } from '../../../../.shared/render';
import { retryingLazy } from './retrying-lazy';

/** Граница ошибок, как у вкладки оболочки: показывает отказ вместо упавшего содержимого. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  // Отказ ожидаемый: он и есть предмет теста, в консоль его не дублируем.
  componentDidCatch(): void {}

  render(): ReactNode {
    return this.state.failed ? <p>не загрузилось</p> : this.props.children;
  }
}

const Body = (): ReactNode => <p>тело предпросмотра</p>;

/** Загрузчик, который отказывает, пока «сеть» выключена, и считает обращения. */
function loader() {
  const state = { online: false, calls: 0 };
  const load = (): Promise<{ default: typeof Body }> => {
    state.calls += 1;
    return state.online
      ? Promise.resolve({ default: Body })
      : Promise.reject(new Error('сеть недоступна'));
  };
  return { state, load };
}

const RETRY_AFTER_MS = 150;

const mount = (Lazy: (props: object) => ReactNode) =>
  renderReact(
    <Boundary>
      <Suspense fallback={<p>загрузка</p>}>
        <Lazy />
      </Suspense>
    </Boundary>
  );

describe('отложенный компонент после отказа загрузки', () => {
  it('показывает ошибку и не запрашивает файл по кругу', async () => {
    const { state, load } = loader();
    const Lazy = retryingLazy(load, { retryAfterMs: RETRY_AFTER_MS });
    // React сообщает об ошибке в консоль сам — это не предмет проверки.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mount(Lazy);

    await expect.element(page.getByText('не загрузилось')).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS * 2));
    // Пока человек ничего не делает, новых попыток нет — сколько бы ни прошло времени.
    expect(state.calls).toBe(1);
    quiet.mockRestore();
  });

  it('открыли заново, когда сеть вернулась, — компонент загружается', async () => {
    const { state, load } = loader();
    const Lazy = retryingLazy(load, { retryAfterMs: RETRY_AFTER_MS });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const first = mount(Lazy);
    await expect.element(page.getByText('не загрузилось')).toBeVisible();
    first.unmount();

    state.online = true;
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS + 50));
    mount(Lazy);

    await expect.element(page.getByText('тело предпросмотра')).toBeVisible();
    expect(state.calls).toBe(2);
    quiet.mockRestore();
  });

  it('загруженный компонент повторно не запрашивается', async () => {
    const { state, load } = loader();
    state.online = true;
    const Lazy = retryingLazy(load, { retryAfterMs: RETRY_AFTER_MS });

    const first = mount(Lazy);
    await expect.element(page.getByText('тело предпросмотра')).toBeVisible();
    first.unmount();
    mount(Lazy);

    await expect.element(page.getByText('тело предпросмотра')).toBeVisible();
    expect(state.calls).toBe(1);
  });
});
