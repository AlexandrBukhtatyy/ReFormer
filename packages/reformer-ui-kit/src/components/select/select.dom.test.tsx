// @vitest-environment happy-dom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SelectAsync, SelectMulti, type SelectAsyncHandle, type SelectMultiHandle } from './index';

afterEach(cleanup);

// Первый рендер календаря/поповера тянет тяжёлые модули — под нагрузкой дольше 5 с по умолчанию.
vi.setConfig({ testTimeout: 30_000 });

const OPTS = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
];

describe('крестик очистки (DOM): доступен с клавиатуры', () => {
  it('SelectAsync: крестик в порядке Tab, после очистки фокус — на триггере', () => {
    const onChange = vi.fn();
    render(<SelectAsync value="a" options={OPTS} clearable onChange={onChange} />);
    const clear = screen.getByRole('button', { name: 'Clear selection' });
    expect(clear.getAttribute('tabindex')).toBeNull();

    clear.focus();
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });

  it('SelectMulti: крестик в порядке Tab, после очистки фокус — на триггере', () => {
    const onChange = vi.fn();
    render(<SelectMulti value={['a']} options={OPTS} clearable onChange={onChange} />);
    const clear = screen.getByRole('button', { name: 'Clear selection' });
    expect(clear.getAttribute('tabindex')).toBeNull();

    clear.focus();
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith([]);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });
});

/** Открывает список SelectMulti через handle и отдаёт listbox. */
function openMulti(node: React.ReactElement<React.RefAttributes<SelectMultiHandle>>) {
  const ref = React.createRef<SelectMultiHandle>();
  render(React.cloneElement(node, { ref }));
  act(() => ref.current?.open());
  return screen.getByRole('listbox');
}

describe('SelectMulti (DOM): listbox', () => {
  it('aria-activedescendant ведёт на пункт, подсвеченный стрелками', () => {
    const list = openMulti(<SelectMulti value={[]} options={OPTS} />);
    const options = screen.getAllByRole('option');
    expect(list.getAttribute('aria-activedescendant')).toBe(options[0].id);

    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(options[1].hasAttribute('data-active')).toBe(true);
  });

  it('id пунктов у двух списков на странице не совпадают', () => {
    openMulti(<SelectMulti value={[]} options={OPTS} />);
    const first = screen.getAllByRole('option').map((o) => o.id);
    // Второй открытый popover закрывает первый — сравниваем id, снятые по очереди.
    openMulti(<SelectMulti value={[]} options={OPTS} />);
    const second = screen.getAllByRole('option').map((o) => o.id);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it('group: пункты собраны под заголовками групп, клавиатура идёт в порядке показа', () => {
    const list = openMulti(
      <SelectMulti
        value={[]}
        options={[
          { value: 'msk', label: 'Москва', group: 'Россия' },
          { value: 'mns', label: 'Минск', group: 'Беларусь' },
          { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
        ]}
      />
    );
    const groups = screen.getAllByRole('group');
    expect(groups.map((g) => g.textContent)).toEqual([
      'РоссияМоскваСанкт-Петербург',
      'БеларусьМинск',
    ]);
    // Группа подписана своим заголовком.
    const labelId = groups[0].getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelId)?.textContent).toBe('Россия');

    // Второй по показу пункт — Санкт-Петербург (из той же группы), а не Минск.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    const active = document.getElementById(list.getAttribute('aria-activedescendant')!);
    expect(active?.textContent).toBe('Санкт-Петербург');
  });

  it('без group — плоский список без заголовков', () => {
    openMulti(<SelectMulti value={[]} options={OPTS} />);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('SelectAsync (DOM): роли e2e — как у списков китов других библиотек', () => {
  it('выбранное значение — в data-value триггера (на экране — подпись пункта)', () => {
    render(<SelectAsync value="b" options={OPTS} data-testid="input-city" />);
    const trigger = screen.getByTestId('input-city');
    expect(trigger.getAttribute('data-value')).toBe('b');
    expect(trigger.textContent).toContain('Бета');
  });

  it('без выбора data-value пуст', () => {
    render(<SelectAsync value={null} options={OPTS} data-testid="input-city" />);
    expect(screen.getByTestId('input-city').getAttribute('data-value')).toBe('');
  });

  it('пункты открытой панели — option-{id}-{значение}, id — из data-testid контрола', () => {
    const ref = React.createRef<SelectAsyncHandle>();
    render(<SelectAsync ref={ref} value={null} options={OPTS} data-testid="input-city" />);
    act(() => ref.current?.open());
    expect(screen.getByTestId('option-city-a').textContent).toContain('Альфа');
    expect(screen.getByTestId('option-city-b').textContent).toContain('Бета');
  });

  it('контрол без testid поля — пункты без testid', () => {
    const ref = React.createRef<SelectAsyncHandle>();
    render(<SelectAsync ref={ref} value={null} options={OPTS} />);
    act(() => ref.current?.open());
    for (const option of screen.getAllByRole('option')) {
      expect(option.hasAttribute('data-testid')).toBe(false);
    }
  });
});
