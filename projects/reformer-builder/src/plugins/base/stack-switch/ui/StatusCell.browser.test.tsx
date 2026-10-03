/**
 * Ячейка переключателя в настоящем браузере.
 *
 * Проверяется то, чего компиляция не видит: что список открывается по щелчку и отмечает
 * действующее сочетание, что выбор доходит до обработчика нужным пунктом, что ячейка
 * перерисовывается по сигналу хранилища и перестаёт быть кнопкой, когда выбирать не из чего.
 * Перевод здесь — сами ключи: словарь проверяется отдельно (`i18n-completeness`).
 *
 * @module plugins/base/stack-switch/ui/StatusCell.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Disposable } from '@reformer/builder-plugin-api';
import { renderReact } from '@/testing/render';
import type { Combination, SwitchState } from '../combinations';
import { STACK_SWITCH_CELL_ID } from '../contract';
import { StatusCell } from './StatusCell';

const i18n = {
  locale: 'ru',
  t: (key: string) => key,
  onDidChangeLocale: (): Disposable => ({ dispose: () => {} }),
};

const combination = (label: string, over: Partial<Combination> = {}): Combination => ({
  id: label,
  profile: null,
  kit: null,
  label,
  active: false,
  restarts: false,
  ...over,
});

const FOUR: SwitchState = {
  label: 'ReFormer · ReFormer UI Kit',
  activeId: 'ReFormer · ReFormer UI Kit',
  resetRestarts: false,
  combinations: [
    combination('ReFormer · ReFormer UI Kit', { active: true }),
    combination('ReFormer · Kaspersky HexaUI'),
    combination('RJSF · ReFormer UI Kit', { restarts: true }),
    combination('RJSF · Kaspersky HexaUI', { restarts: true }),
  ],
};

/** Хранилище, которое умеет меняться: `set` — «служба китов сообщила об изменении». */
function fakeStore(initial: SwitchState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    subscribe: (listener: () => void): Disposable => {
      listeners.add(listener);
      return { dispose: () => void listeners.delete(listener) };
    },
    set(next: SwitchState) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

const cell = () => document.querySelector(`[data-status-indicator="${STACK_SWITCH_CELL_ID}"]`);

const noop = (): void => {};

describe('ячейка переключателя сочетаний', () => {
  it('показывает действующее сочетание, по щелчку — список с отметкой и предупреждением', async () => {
    renderReact(<StatusCell store={fakeStore(FOUR)} i18n={i18n} onSelect={noop} onReset={noop} />);

    const trigger = page.getByRole('button', { name: 'ReFormer · ReFormer UI Kit' });
    await expect.element(trigger).toBeVisible();
    await userEvent.click(trigger);

    const items = page.getByRole('menuitemradio');
    await expect.element(items.nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect.element(items.nth(1)).toHaveAttribute('aria-checked', 'false');
    expect(items.all()).toHaveLength(4);
    // Пометка «перезагрузит» — только у сочетаний с другим движком.
    await expect.element(items.nth(1)).not.toHaveTextContent('menu.restarts');
    await expect.element(items.nth(2)).toHaveTextContent('menu.restarts');
  });

  it('выбор пункта отдаёт обработчику именно это сочетание', async () => {
    const onSelect = vi.fn();
    renderReact(
      <StatusCell store={fakeStore(FOUR)} i18n={i18n} onSelect={onSelect} onReset={noop} />
    );

    await userEvent.click(page.getByRole('button', { name: 'ReFormer · ReFormer UI Kit' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: /RJSF · Kaspersky HexaUI/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toBe(FOUR.combinations[3]);
  });

  it('пункт возврата к конфигу стоит вне сочетаний и предупреждает о перезапуске', async () => {
    const onReset = vi.fn();
    const onSelect = vi.fn();
    renderReact(
      <StatusCell
        store={fakeStore({ ...FOUR, resetRestarts: true })}
        i18n={i18n}
        onSelect={onSelect}
        onReset={onReset}
      />
    );

    await userEvent.click(page.getByRole('button', { name: 'ReFormer · ReFormer UI Kit' }));
    const reset = page.getByRole('menuitem', { name: /menu\.reset/ });
    await expect.element(reset).toHaveTextContent('menu.restarts');
    await userEvent.click(reset);

    expect(onReset).toHaveBeenCalledTimes(1);
    // Не сочетание: выбор сочетания при этом не случается.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('перерисовывается по сигналу хранилища: сменился кит — сменилась подпись', async () => {
    const store = fakeStore(FOUR);
    renderReact(<StatusCell store={store} i18n={i18n} onSelect={noop} onReset={noop} />);
    await expect.element(page.getByText('ReFormer · ReFormer UI Kit')).toBeVisible();

    store.set({ ...FOUR, label: 'ReFormer · Kaspersky HexaUI' });

    await expect.element(page.getByText('ReFormer · Kaspersky HexaUI')).toBeVisible();
  });

  it('сочетание одно — текст, а не кнопка: выбора нет, и обещать его нечем', async () => {
    renderReact(
      <StatusCell
        store={fakeStore({
          label: 'RJSF · ReFormer UI Kit',
          activeId: 'only',
          resetRestarts: false,
          combinations: [combination('only', { active: true })],
        })}
        i18n={i18n}
        onSelect={noop}
        onReset={noop}
      />
    );

    await expect.element(page.getByText('RJSF · ReFormer UI Kit')).toBeVisible();
    expect(cell()?.tagName).toBe('SPAN');
  });

  it('показывать нечего — ячейки нет вовсе', () => {
    renderReact(
      <StatusCell
        store={fakeStore({ label: null, activeId: null, resetRestarts: false, combinations: [] })}
        i18n={i18n}
        onSelect={noop}
        onReset={noop}
      />
    );

    expect(cell()).toBeNull();
  });
});
