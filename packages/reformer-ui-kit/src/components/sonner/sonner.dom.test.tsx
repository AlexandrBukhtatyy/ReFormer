// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { I18nProvider } from '@reformer/core/react';
import { ru } from '@/locale/ru';
import { Toaster, toast } from './index';

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  cleanup();
});

/** Список тостов sonner (`ol[data-sonner-toaster]`) появляется только с первым тостом. */
async function showToast(container: HTMLElement, message: string) {
  act(() => {
    toast.success(message);
  });
  await waitFor(() => expect(container.querySelector('[data-sonner-toast]')).not.toBeNull());
  return container.querySelector<HTMLElement>('[data-sonner-toaster]')!;
}

describe('Toaster (DOM)', () => {
  it('без theme следует теме приложения: .dark выше по дереву → тёмная тема sonner', async () => {
    const { container } = render(
      <div className="dark">
        <Toaster />
      </div>
    );
    const list = await showToast(container, 'Сохранено');
    expect(list.getAttribute('data-sonner-theme')).toBe('dark');
  });

  it('[data-theme=dark] (Docusaurus) — тоже тёмная; смена темы подхватывается на лету', async () => {
    const { container } = render(
      <div data-testid="app" data-theme="dark">
        <Toaster />
      </div>
    );
    const list = await showToast(container, 'Сохранено');
    expect(list.getAttribute('data-sonner-theme')).toBe('dark');

    act(() => {
      container.querySelector('[data-testid="app"]')!.setAttribute('data-theme', 'light');
    });
    await waitFor(() => expect(list.getAttribute('data-sonner-theme')).toBe('light'));
  });

  it('явный theme важнее темы приложения', async () => {
    const { container } = render(
      <div className="dark">
        <Toaster theme="light" />
      </div>
    );
    const list = await showToast(container, 'Сохранено');
    expect(list.getAttribute('data-sonner-theme')).toBe('light');
  });

  it('свой toastOptions дополняет настройки кита: выравнивание иконки остаётся', async () => {
    const { container } = render(
      <Toaster toastOptions={{ duration: 10_000, classNames: { title: 'my-title' } }} />
    );
    await showToast(container, 'Сохранено');
    expect(container.querySelector('[data-icon]')!.className).toContain('self-start');
    expect(container.querySelector('[data-title]')!.className).toContain('my-title');
  });

  it('подписи секции и кнопки закрытия — из словаря кита', async () => {
    const { container } = render(
      <I18nProvider locale={ru}>
        <Toaster closeButton />
      </I18nProvider>
    );
    expect(container.querySelector('section')!.getAttribute('aria-label')).toBe(
      'Уведомления alt+T'
    );
    await showToast(container, 'Сохранено');
    expect(container.querySelector('[data-close-button]')!.getAttribute('aria-label')).toBe(
      'Закрыть уведомление'
    );
  });
});
