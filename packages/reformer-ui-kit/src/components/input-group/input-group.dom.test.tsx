// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
  inputGroupBasePropsSchema,
} from './index';

afterEach(cleanup);

describe('InputGroupAddon (DOM): клик по аддону фокусирует контрол группы', () => {
  it('input', () => {
    render(
      <InputGroup>
        <InputGroupInput aria-label="Поиск" />
        <InputGroupAddon>@</InputGroupAddon>
      </InputGroup>
    );
    fireEvent.click(screen.getByText('@'));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Поиск' }));
  });

  it('textarea — у апстрима фокус ставился только input', () => {
    render(
      <InputGroup>
        <InputGroupTextarea aria-label="Комментарий" />
        <InputGroupAddon align="block-end">0/280</InputGroupAddon>
      </InputGroup>
    );
    fireEvent.click(screen.getByText('0/280'));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Комментарий' }));
  });

  it('клик по кнопке в аддоне фокус не уводит', () => {
    render(
      <InputGroup>
        <InputGroupInput aria-label="Поиск" />
        <InputGroupAddon align="inline-end">
          <button type="button">Найти</button>
        </InputGroupAddon>
      </InputGroup>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Поиск' }));
  });
});

describe('input-group: props-схема экспортирована из barrel', () => {
  it('inputGroupBasePropsSchema', () => {
    expect(inputGroupBasePropsSchema['x-registryName']).toBe('InputGroup');
  });
});
