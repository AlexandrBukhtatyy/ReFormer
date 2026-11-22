// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CommandDialog, CommandInput, CommandItem, CommandList } from './index';

afterEach(cleanup);

describe('CommandDialog (DOM)', () => {
  it('открытая палитра названа своим заголовком, и он лежит внутри окна', () => {
    render(
      <CommandDialog open title="Палитра" description="Поиск команд">
        <CommandInput placeholder="Введите команду…" />
        <CommandList>
          <CommandItem>Файл</CommandItem>
        </CommandList>
      </CommandDialog>
    );
    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('Палитра');
    expect(dialog.contains(title)).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.contains(screen.getByText('Поиск команд'))).toBe(true);
  });
});
