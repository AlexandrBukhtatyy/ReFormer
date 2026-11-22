/**
 * Ячейка выбора профиля в настоящем браузере.
 *
 * Проверяется то, чего компиляция не видит: что список открывается по щелчку и отмечает
 * действующий профиль, что выбор доходит до обработчика нужным пунктом и что ячейка перестаёт
 * быть кнопкой, когда выбирать не из чего. Перевод здесь — сами ключи: словарь проверяется
 * отдельно (`i18n-completeness`).
 *
 * @module plugins/base/profile-switch/ui/StatusCell.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Disposable } from '@reformer/builder-plugin-api';
import { renderReact } from '@/testing/render';
import type { ProfileChoice, SwitchState } from '../choices';
import { PROFILE_SWITCH_CELL_ID } from '../contract';
import { StatusCell } from './StatusCell';

const i18n = {
  locale: 'ru',
  t: (key: string) => key,
  onDidChangeLocale: (): Disposable => ({ dispose: () => {} }),
};

const choice = (label: string, over: Partial<ProfileChoice> = {}): ProfileChoice => ({
  id: label,
  label,
  active: false,
  restarts: true,
  ...over,
});

const TWO: SwitchState = {
  label: 'Конструктор',
  activeId: 'Конструктор',
  resetRestarts: false,
  choices: [choice('Конструктор', { active: true, restarts: false }), choice('Минимальный')],
};

const cell = () => document.querySelector(`[data-status-indicator="${PROFILE_SWITCH_CELL_ID}"]`);

const noop = (): void => {};

describe('ячейка выбора профиля', () => {
  it('показывает действующий профиль, по щелчку — список с отметкой и предупреждением', async () => {
    renderReact(<StatusCell state={TWO} i18n={i18n} onSelect={noop} onReset={noop} />);

    const trigger = page.getByRole('button', { name: 'Конструктор' });
    await expect.element(trigger).toBeVisible();
    await userEvent.click(trigger);

    await expect
      .element(page.getByRole('menuitemradio', { name: 'Конструктор' }))
      .toHaveAttribute('aria-checked', 'true');
    // У чужого профиля сказано, чего стоит выбор.
    await expect
      .element(page.getByRole('menuitemradio', { name: /Минимальный/ }))
      .toHaveTextContent('menu.restarts');
  });

  it('выбор пункта отдаёт обработчику именно этот профиль', async () => {
    const onSelect = vi.fn();
    renderReact(<StatusCell state={TWO} i18n={i18n} onSelect={onSelect} onReset={noop} />);

    await userEvent.click(page.getByRole('button', { name: 'Конструктор' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: /Минимальный/ }));

    expect(onSelect).toHaveBeenCalledWith(TWO.choices[1]);
  });

  it('пункт возврата к конфигу стоит вне профилей и предупреждает о перезагрузке', async () => {
    const onReset = vi.fn();
    renderReact(
      <StatusCell
        state={{ ...TWO, resetRestarts: true }}
        i18n={i18n}
        onSelect={noop}
        onReset={onReset}
      />
    );

    await userEvent.click(page.getByRole('button', { name: 'Конструктор' }));
    const reset = page.getByRole('menuitem', { name: /menu\.reset/ });
    await expect.element(reset).toHaveTextContent('menu.restarts');
    await userEvent.click(reset);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('профиль один — текст, а не кнопка: выбора нет, и обещать его нечем', async () => {
    renderReact(
      <StatusCell
        state={{ ...TWO, choices: [TWO.choices[0]!] }}
        i18n={i18n}
        onSelect={noop}
        onReset={noop}
      />
    );

    await expect.element(page.getByText('Конструктор')).toBeVisible();
    expect(cell()?.tagName).toBe('SPAN');
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  it('показывать нечего — ячейки нет вовсе', () => {
    renderReact(
      <StatusCell
        state={{ choices: [], label: null, activeId: null, resetRestarts: false }}
        i18n={i18n}
        onSelect={noop}
        onReset={noop}
      />
    );

    expect(cell()).toBeNull();
  });
});
