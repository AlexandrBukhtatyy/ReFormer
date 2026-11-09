// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DatePicker, DatePickerMulti, DatePickerRange } from './index';

afterEach(cleanup);

// Первый рендер календаря/поповера тянет тяжёлые модули — под нагрузкой дольше 5 с по умолчанию.
vi.setConfig({ testTimeout: 30_000 });

/** Кнопка-триггер календаря. */
const trigger = () =>
  document.querySelector<HTMLButtonElement>('[data-slot="date-picker-trigger"]')!;

describe('DatePicker (DOM): touched — при уходе из поля, а не при открытии', () => {
  it('открытие календаря (фокус уходит в него) onBlur не зовёт', () => {
    const onBlur = vi.fn();
    render(<DatePicker onBlur={onBlur} />);
    trigger().focus();
    fireEvent.click(trigger());
    expect(screen.getByRole('grid')).toBeTruthy();
    // Фокус переехал в календарь — blur кнопки при открытом календаре уходом не считается.
    act(() => trigger().blur());
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('закрытие календаря (Escape) — уход из поля', () => {
    const onBlur = vi.fn();
    render(<DatePicker onBlur={onBlur} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('grid')).toBeNull();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('выбор даты закрывает календарь и помечает уход', () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    render(<DatePicker onBlur={onBlur} onChange={onChange} />);
    fireEvent.click(trigger());
    const day = document.querySelector<HTMLButtonElement>('[data-day] button, button[data-day]')!;
    fireEvent.click(day);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('blur кнопки при закрытом календаре (Tab мимо) — уход', () => {
    const onBlur = vi.fn();
    render(<DatePicker onBlur={onBlur} />);
    trigger().focus();
    act(() => trigger().blur());
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('DatePickerRange / DatePickerMulti (DOM): крестик очистки доступен с клавиатуры', () => {
  it('DatePickerRange: крестик в порядке Tab, после очистки фокус — на триггере', () => {
    const onChange = vi.fn();
    render(
      <DatePickerRange
        value={[new Date(2026, 0, 1), new Date(2026, 0, 5)]}
        clearable
        onChange={onChange}
      />
    );
    const clear = screen.getByRole('button', { name: 'Clear dates' });
    expect(clear.getAttribute('tabindex')).toBeNull();
    clear.focus();
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(document.activeElement).toBe(trigger());
  });

  it('DatePickerMulti: крестик в порядке Tab, после очистки фокус — на триггере', () => {
    const onChange = vi.fn();
    render(<DatePickerMulti value={[new Date(2026, 0, 1)]} clearable onChange={onChange} />);
    const clear = screen.getByRole('button', { name: 'Clear dates' });
    expect(clear.getAttribute('tabindex')).toBeNull();
    clear.focus();
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith([]);
    expect(document.activeElement).toBe(trigger());
  });
});
