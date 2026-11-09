// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from './index';

afterEach(cleanup);

describe('PopoverContent (DOM): имя панели', () => {
  it('панель названа своим PopoverTitle', () => {
    render(
      <Popover open>
        <PopoverTrigger>Открыть</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Настройки уведомлений</PopoverTitle>
        </PopoverContent>
      </Popover>
    );
    const panel = screen.getByRole('dialog');
    const title = screen.getByText('Настройки уведомлений');
    expect(title.id).not.toBe('');
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('свой id заголовка уходит в aria-labelledby', () => {
    render(
      <Popover open>
        <PopoverContent>
          <PopoverTitle id="my-title">Заголовок</PopoverTitle>
        </PopoverContent>
      </Popover>
    );
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe('my-title');
  });

  it('явный aria-label панели важнее заголовка', () => {
    render(
      <Popover open>
        <PopoverContent aria-label="Фильтры">
          <PopoverTitle>Заголовок</PopoverTitle>
        </PopoverContent>
      </Popover>
    );
    const panel = screen.getByRole('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Фильтры');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('без заголовка aria-labelledby не ставится', () => {
    render(
      <Popover open>
        <PopoverContent>Просто текст</PopoverContent>
      </Popover>
    );
    expect(screen.getByRole('dialog').hasAttribute('aria-labelledby')).toBe(false);
  });
});
