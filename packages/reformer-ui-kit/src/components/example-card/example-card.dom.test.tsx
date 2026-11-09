// @vitest-environment happy-dom
/**
 * ExampleCard в DOM: переключение «пример / код» внутри формы (ReFormer-d0j). SSR-тест видит только
 * исходное состояние; кнопка копирования появляется лишь после переключения.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExampleCard } from './index';

afterEach(cleanup);

describe('ExampleCard — внутри <form>', () => {
  it('переключение и копирование не отправляют форму; aria-pressed отражает режим', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ExampleCard title="Т" code={`<Input />`}>
          <span>пример</span>
        </ExampleCard>
      </form>
    );

    const toggle = screen.getByRole('button', { name: 'Show code' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // Имя переключателя постоянно — меняется только состояние.
    expect(screen.getByRole('button', { name: 'Show code' })).toBe(toggle);
    expect(screen.getByText('<Input />')).toBeTruthy();

    const copy = screen.getByRole('button', { name: 'Copy code' });
    expect(copy.getAttribute('type')).toBe('button');
    fireEvent.click(copy);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
