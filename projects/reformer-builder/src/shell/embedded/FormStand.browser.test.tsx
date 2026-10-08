/**
 * Стенд формы: приложение рисует один компонент — и говорит словами, когда рисовать нечего.
 *
 * @module shell/embedded/FormStand.browser.test
 */

import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { renderReact } from '@/testing/render';
import { FormStand } from './FormStand';

function ContactForm(): ReactElement {
  return <form aria-label="Контакты">форма контактов</form>;
}

describe('стенд формы', () => {
  it('рисует компонент, экспортированный модулем по умолчанию', async () => {
    const load = vi.fn(() => Promise.resolve({ default: ContactForm }));

    renderReact(<FormStand modulePath="src/forms/contact/index.tsx" load={load} />);

    await expect.element(page.getByRole('form', { name: 'Контакты' })).toBeVisible();
    expect(load).toHaveBeenCalledWith('src/forms/contact/index.tsx');
  });

  it('пока модуль едет, называет, что грузит', async () => {
    const load = (): Promise<unknown> => new Promise(() => {});

    renderReact(<FormStand modulePath="src/forms/contact/index.tsx" load={load} />);

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Загружаю «src/forms/contact/index.tsx»…');
  });

  it('модуль без компонента по умолчанию — причина словами, а не пустая рамка', async () => {
    const load = (): Promise<unknown> => Promise.resolve({ contactFormEntry: {} });

    renderReact(<FormStand modulePath="src/forms/contact/index.tsx" load={load} />);

    await expect.element(page.getByRole('status')).toHaveTextContent('нет компонента по умолчанию');
  });

  it('модуль не загрузился — показана причина отказа', async () => {
    const load = (): Promise<unknown> => Promise.reject(new Error('файл не найден на сервере'));

    renderReact(<FormStand modulePath="src/forms/missing/index.tsx" load={load} />);

    await expect.element(page.getByRole('status')).toHaveTextContent('файл не найден на сервере');
  });

  it('форма, упавшая при отрисовке, не оставляет рамку пустой', async () => {
    // React печатает пойманную границей ошибку в консоль — в этом тесте она ожидаема.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenForm(): ReactElement {
      throw new Error('реестр формы не собрался');
    }
    const load = (): Promise<unknown> => Promise.resolve({ default: BrokenForm });

    renderReact(<FormStand modulePath="src/forms/broken/index.tsx" load={load} />);

    await expect.element(page.getByRole('status')).toHaveTextContent('реестр формы не собрался');
    consoleError.mockRestore();
  });
});
