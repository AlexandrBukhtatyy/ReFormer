/**
 * Панель «Модель» — в настоящем браузере: значение, которое показывает строка, — текущее
 * значение формы, а правка в панели доходит до модели.
 *
 * Поля значений неуправляемые, и устаревшее значение в них видно только отрисованным: модель
 * при этом верна, строки перерисовываются, а поле показывает то, что было при монтировании.
 *
 * @module plugins/reformer/render/ui/ModelPanel.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createFormFromModel, createModel } from '@reformer/core';
import { renderReact } from '../../../../.shared/render';
import type { PreviewHost } from '../host';
import { ModelPanel } from './ModelPanel';

interface Contact {
  contact: { name: string; email: string };
  age: number;
}

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

function mount() {
  const model = createModel<Contact>({
    contact: { name: 'Ann', email: 'ann@example.com' },
    age: 30,
  });
  createFormFromModel({ model });
  const host = {
    useTranslate: () => (key: string) => key,
    useActiveDocument: () => 'fs:forms/contact/form.schema.json',
  } as unknown as PreviewHost;
  const live = { formOf: () => ({ model }), onDidChangeForm: () => ({ dispose() {} }) };
  const mounted = renderReact(<ModelPanel host={host} live={() => live as never} />);
  unmount = mounted.unmount;
  return { container: mounted.container, model };
}

/** Поле значения в строке пути. */
function inputOf(container: HTMLElement, path: string): HTMLInputElement {
  const row = Array.from(container.querySelectorAll('tbody tr')).find(
    (candidate) => candidate.querySelector('td')?.textContent === path
  );
  const input = row?.querySelector('input');
  if (input == null) throw new Error(`в панели нет поля «${path}»`);
  return input;
}

describe('панель «Модель»', () => {
  it('значение, сменившееся в форме, видно в поле панели', async () => {
    const { container, model } = mount();
    await vi.waitFor(() => expect(inputOf(container, 'contact.name').value).toBe('Ann'));

    model.contact.name = 'Bob';
    model.age = 31;

    await vi.waitFor(() => {
      expect(inputOf(container, 'contact.name').value).toBe('Bob');
      expect(inputOf(container, 'age').value).toBe('31');
    });
  });

  it('правка в панели доходит до модели на уходе из поля', async () => {
    const { container, model } = mount();
    const input = await vi.waitFor(() => inputOf(container, 'contact.email'));

    await userEvent.fill(input, 'bob@example.com');
    // До ухода из поля модель не меняется: набор в панели не перемонтирует поле.
    expect(model.contact.email).toBe('ann@example.com');
    expect(inputOf(container, 'contact.email')).toBe(input);
    await userEvent.click(inputOf(container, 'contact.name'));

    expect(model.contact.email).toBe('bob@example.com');
    await vi.waitFor(() =>
      expect(inputOf(container, 'contact.email').value).toBe('bob@example.com')
    );
  });
});
