/**
 * Ячейка «кит» в настоящем браузере.
 *
 * Проверяется то, чего компиляция не видит: что список открывается по щелчку и отмечает
 * действующий кит, что выбор доходит до обработчика нужным идентификатором, что ячейка
 * перерисовывается по сигналу хранилища и перестаёт быть кнопкой, когда выбирать не из чего.
 * Перевод здесь — сами ключи: словарь проверяется отдельно (`i18n-completeness`).
 *
 * @module plugins/forms/kits/ui/KitCell.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { UNKNOWN_KIT_VERSION } from '@reformer/builder-plugin-api';
import type { Disposable, KitSummary } from '@reformer/builder-plugin-api';
import { renderReact } from '../../../../.shared/render';
import { KITS_CELL_ID, type KitCellState } from '../cell';
import { KitCell } from './KitCell';

const i18n = {
  locale: 'ru',
  t: (key: string) => key,
  onDidChangeLocale: (): Disposable => ({ dispose: () => {} }),
};

const summary = (id: string, label: string, active = false): KitSummary => ({
  id,
  label,
  package: `@vendor/${id}`,
  version: '1.2.3',
  active,
  origin: { kind: 'builtin' },
});

const TWO: KitCellState = {
  label: 'ReFormer UI Kit',
  activeId: 'reformer-ui-kit',
  kits: [summary('reformer-ui-kit', 'ReFormer UI Kit', true), summary('hexa', 'Kaspersky HexaUI')],
};

/** Хранилище, которое умеет меняться: `set` — «служба китов сообщила об изменении». */
function fakeStore(initial: KitCellState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    subscribe: (listener: () => void): Disposable => {
      listeners.add(listener);
      return { dispose: () => void listeners.delete(listener) };
    },
    set(next: KitCellState) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

const cell = () => document.querySelector(`[data-status-indicator="${KITS_CELL_ID}"]`);

const noop = (): void => {};

describe('ячейка выбора кита', () => {
  it('показывает действующий кит, по щелчку — список с отметкой', async () => {
    renderReact(<KitCell store={fakeStore(TWO)} i18n={i18n} onSelect={noop} onReset={noop} />);

    const trigger = page.getByRole('button', { name: 'ReFormer UI Kit' });
    await expect.element(trigger).toBeVisible();
    await userEvent.click(trigger);

    const items = page.getByRole('menuitemradio');
    await expect.element(items.nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect.element(items.nth(1)).toHaveAttribute('aria-checked', 'false');
    expect(items.all()).toHaveLength(2);
  });

  it('версия показана у кита, который её назвал, и только у него', async () => {
    const mixed: KitCellState = {
      ...TWO,
      kits: [
        { ...summary('reformer-ui-kit', 'ReFormer UI Kit', true), version: UNKNOWN_KIT_VERSION },
        summary('hexa', 'Kaspersky HexaUI'),
      ],
    };
    renderReact(<KitCell store={fakeStore(mixed)} i18n={i18n} onSelect={noop} onReset={noop} />);

    await userEvent.click(page.getByRole('button', { name: 'ReFormer UI Kit' }));

    const items = page.getByRole('menuitemradio');
    await expect.element(items.nth(1)).toHaveTextContent('Kaspersky HexaUI1.2.3');
    await expect.element(items.nth(0)).toHaveTextContent('ReFormer UI Kit');
    expect(items.nth(0).element().textContent).not.toContain(UNKNOWN_KIT_VERSION);
  });

  it('выбор доходит до обработчика идентификатором кита', async () => {
    const onSelect = vi.fn();
    renderReact(<KitCell store={fakeStore(TWO)} i18n={i18n} onSelect={onSelect} onReset={noop} />);

    await userEvent.click(page.getByRole('button', { name: 'ReFormer UI Kit' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: /Kaspersky HexaUI/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('hexa');
  });

  it('щелчок по действующему киту — не действие', async () => {
    const onSelect = vi.fn();
    renderReact(<KitCell store={fakeStore(TWO)} i18n={i18n} onSelect={onSelect} onReset={noop} />);

    await userEvent.click(page.getByRole('button', { name: 'ReFormer UI Kit' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: /ReFormer UI Kit/ }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('последний пункт возвращает кит к конфигу запуска и отметки не носит', async () => {
    const onReset = vi.fn();
    renderReact(<KitCell store={fakeStore(TWO)} i18n={i18n} onSelect={noop} onReset={onReset} />);

    await userEvent.click(page.getByRole('button', { name: 'ReFormer UI Kit' }));
    // Вне радио-группы: это отказ от выбора, а не ещё один кит.
    await userEvent.click(page.getByRole('menuitem', { name: 'menu.reset' }));

    expect(onReset).toHaveBeenCalledOnce();
  });

  it('перерисовывается по сигналу хранилища', async () => {
    const store = fakeStore(TWO);
    renderReact(<KitCell store={store} i18n={i18n} onSelect={noop} onReset={noop} />);
    await expect.element(page.getByRole('button', { name: 'ReFormer UI Kit' })).toBeVisible();

    store.set({
      label: 'Kaspersky HexaUI',
      activeId: 'hexa',
      kits: [
        summary('reformer-ui-kit', 'ReFormer UI Kit'),
        summary('hexa', 'Kaspersky HexaUI', true),
      ],
    });

    await expect.element(page.getByRole('button', { name: 'Kaspersky HexaUI' })).toBeVisible();
  });

  it('кит один — текст, а не кнопка: выбора нет, и обещать его нечем', async () => {
    const only: KitCellState = {
      label: 'ReFormer UI Kit',
      activeId: 'reformer-ui-kit',
      kits: [summary('reformer-ui-kit', 'ReFormer UI Kit', true)],
    };
    renderReact(<KitCell store={fakeStore(only)} i18n={i18n} onSelect={noop} onReset={noop} />);

    await expect.poll(() => cell()?.textContent).toBe('ReFormer UI Kit');
    expect(cell()?.tagName).toBe('SPAN');
  });

  it('действующего кита нет — ячейки нет вовсе', async () => {
    const empty: KitCellState = { label: null, activeId: null, kits: [] };
    const { container } = renderReact(
      <KitCell store={fakeStore(empty)} i18n={i18n} onSelect={noop} onReset={noop} />
    );

    await expect.poll(() => container.childElementCount).toBe(0);
    expect(cell()).toBeNull();
  });
});
