/**
 * Сторож класс-токенов: тревога только когда форма нарисована без токенов.
 *
 * Браузерный, потому что сторож живёт на `MutationObserver` и кадрах — в node их нет, а подделка
 * проверяла бы подделку. Главный случай — первый: форма появляется ПОЗЖЕ монтирования (так рисует
 * компилирующая поверхность), и прежняя проверка «через кадр» на нём давала ложную тревогу
 * (ReFormer-twlf).
 *
 * @module plugins/editor-schema/live/live-sentry.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@reformer/builder-plugin-api';
import { encodeNodeToken } from '@reformer/builder-stack-reformer/form-model';
import { watchNodeTokens } from './live-sentry';

const FIELD = 'abcd1234' as NodeId;

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function surface(): HTMLElement {
  const element = document.createElement('div');
  document.body.append(element);
  cleanup.push(() => {
    element.remove();
  });
  return element;
}

/** Разметка поля, какой её оставляет рендерер: обёртка с классом и контрол с `data-testid`. */
function field(token: string | null): HTMLElement {
  const wrapper = document.createElement('div');
  if (token !== null) wrapper.className = token;
  const control = document.createElement('input');
  control.dataset.testid = 'input-name';
  wrapper.append(control);
  return wrapper;
}

/** Два кадра: сторож решает после кадра, следующий за мутацией. */
const frames = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function watch(root: HTMLElement): { warn: ReturnType<typeof vi.fn>; dispose(): void } {
  const warn = vi.fn();
  const sentry = watchNodeTokens(root, [FIELD], warn);
  cleanup.push(() => {
    sentry.dispose();
  });
  return { warn, dispose: () => sentry.dispose() };
}

describe('сторож класс-токенов живого вида', () => {
  it('форма, нарисованная позже монтирования, с токенами — тревоги нет', async () => {
    const root = surface();
    root.textContent = 'собирается';
    const { warn } = watch(root);
    await frames();
    expect(warn).not.toHaveBeenCalled();

    root.replaceChildren(field(encodeNodeToken(FIELD)));
    await frames();
    expect(warn).not.toHaveBeenCalled();
  });

  it('поля на экране, а токенов нет — тревога ровно один раз', async () => {
    const root = surface();
    const { warn } = watch(root);
    root.append(field(null));
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });
    root.append(field(null));
    await frames();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('токены уже на месте при монтировании — тревоги нет', async () => {
    const root = surface();
    root.append(field(encodeNodeToken(FIELD)));
    const { warn } = watch(root);
    await frames();
    root.append(field(null));
    await frames();
    expect(warn).not.toHaveBeenCalled();
  });

  it('снятый сторож молчит', async () => {
    const root = surface();
    const { warn, dispose } = watch(root);
    dispose();
    root.append(field(null));
    await frames();
    expect(warn).not.toHaveBeenCalled();
  });
});
