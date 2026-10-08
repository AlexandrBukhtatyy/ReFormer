/**
 * Компонент встраивания — что он рисует в зависимости от того, где открыт документ.
 *
 * Тяжёлая часть здесь подставная: проверяется договор между ней и лёгкой — когда билдер
 * запускается, куда монтируется и когда снимается, — а не сам билдер.
 *
 * @module shell/embedded/ReformerBuilderFrame.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { APP_PREVIEW_FRAME_NAME } from '@reformer/builder-plugin-api/internal';
import { renderReact } from '@/testing/render';
import { createModeStore } from './mode';
import { FORM_STAND_PARAM } from './preview-address';
import {
  ReformerBuilderFrame,
  type EmbeddedRuntime,
  type EmbeddedRuntimeLoader,
} from './ReformerBuilderFrame';

const RUNTIME_KEY = Symbol.for('reformer.builder.embedded-runtime');
// Имя окна и адрес у страницы прогона свои — тест обязан вернуть их такими, какими взял.
const initialUrl = window.location.href;
const initialName = window.name;

afterEach(() => {
  // Запущенный билдер — один на страницу; между тестами страница «новая».
  delete (globalThis as Record<symbol, unknown>)[RUNTIME_KEY];
  window.name = initialName;
  window.history.replaceState(null, '', initialUrl);
});

/** Дописывает параметр стенда к адресу страницы прогона, не теряя её собственных параметров. */
function openStandAddress(modulePath: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(FORM_STAND_PARAM, modulePath);
  window.history.replaceState(null, '', url);
}

/** Подставная тяжёлая часть: рисует метку в элемент оверлея и считает монтирования. */
function fakeRuntime(): {
  readonly load: EmbeddedRuntimeLoader & ReturnType<typeof vi.fn>;
  readonly unmounted: ReturnType<typeof vi.fn>;
} {
  const unmounted = vi.fn();
  const runtime: EmbeddedRuntime = {
    mount(container) {
      const marker = document.createElement('div');
      marker.textContent = 'интерфейс билдера';
      container.append(marker);
      return () => {
        marker.remove();
        unmounted();
      };
    },
  };
  const load = vi.fn(() => Promise.resolve(runtime)) as EmbeddedRuntimeLoader &
    ReturnType<typeof vi.fn>;
  return { load, unmounted };
}

const application = <main aria-label="Приложение">страница приложения</main>;

describe('обычная страница приложения', () => {
  it('рисует приложение и кнопку; билдер не запущен и не загружен', async () => {
    const { load } = fakeRuntime();

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={createModeStore(null)}>
        {application}
      </ReformerBuilderFrame>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Билдер' })).toBeVisible();
    expect(load).not.toHaveBeenCalled();
  });

  it('кнопка открывает билдер оверлеем и передаёт ему адрес плагинов', async () => {
    const { load } = fakeRuntime();

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={createModeStore(null)}>
        {application}
      </ReformerBuilderFrame>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));

    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();
    expect(load).toHaveBeenCalledWith({ pluginsUrl: '/plugins/' });
  });

  it('приложение под оверлеем скрыто', async () => {
    const { load } = fakeRuntime();

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={createModeStore(null)}>
        {application}
      </ReformerBuilderFrame>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();

    await expect.element(page.getByText('страница приложения')).not.toBeVisible();
  });

  it('закрытие снимает билдер и возвращает приложение', async () => {
    const { load, unmounted } = fakeRuntime();

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={createModeStore(null)}>
        {application}
      </ReformerBuilderFrame>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Закрыть билдер' }));

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    await vi.waitFor(() => {
      expect(unmounted).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelector('[data-reformer-builder="overlay"]')).toBeNull();
  });

  it('повторное открытие не запускает билдер второй раз: сборка одна на страницу', async () => {
    const { load } = fakeRuntime();

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={createModeStore(null)}>
        {application}
      </ReformerBuilderFrame>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Закрыть билдер' }));
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('режим, включённый до перезагрузки страницы, открывает билдер сразу', async () => {
    const { load } = fakeRuntime();
    const mode = createModeStore(null);
    mode.set(true);

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={mode}>
        {application}
      </ReformerBuilderFrame>
    );

    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();
  });

  it('билдер не запустился — сказано словами, и вторая попытка возможна', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { load: working } = fakeRuntime();
    let attempts = 0;
    const load: EmbeddedRuntimeLoader = (request) => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('чанк не загрузился')) : working(request);
    };

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={createModeStore(null)}>
        {application}
      </ReformerBuilderFrame>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await expect.element(page.getByRole('status')).toHaveTextContent('Билдер не запустился');

    await userEvent.click(page.getByRole('button', { name: 'Закрыть билдер' }));
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await expect.element(page.getByText('интерфейс билдера')).toBeVisible();
    consoleError.mockRestore();
  });
});

describe('выключенный билдер', () => {
  it('рисует только приложение: ни кнопки, ни оверлея', async () => {
    const { load } = fakeRuntime();

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} enabled={false}>
        {application}
      </ReformerBuilderFrame>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(document.querySelector('[data-reformer-builder="toggle"]')).toBeNull();
  });
});

describe('рамка превью', () => {
  it('показывает приложение без кнопки билдера — даже при включённом режиме', async () => {
    const { load } = fakeRuntime();
    const mode = createModeStore(null);
    mode.set(true);
    window.name = APP_PREVIEW_FRAME_NAME;

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} mode={mode}>
        {application}
      </ReformerBuilderFrame>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(document.querySelector('[data-reformer-builder="toggle"]')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('по адресу стенда рисует одну форму вместо приложения', async () => {
    const { load } = fakeRuntime();
    window.name = APP_PREVIEW_FRAME_NAME;
    openStandAddress('src/forms/contact/index.tsx');
    const loadForm = vi.fn(() =>
      Promise.resolve({
        default: () => <form aria-label="Контакты">форма контактов</form>,
      })
    );

    renderReact(
      <ReformerBuilderFrame pluginsUrl="/plugins/" loadRuntime={load} loadForm={loadForm}>
        {application}
      </ReformerBuilderFrame>
    );

    await expect.element(page.getByRole('form', { name: 'Контакты' })).toBeVisible();
    expect(loadForm).toHaveBeenCalledWith('src/forms/contact/index.tsx');
    expect(document.querySelector('[aria-label="Приложение"]')).toBeNull();
  });

  it('адрес стенда вне рамки превью — обычная страница приложения', async () => {
    const { load } = fakeRuntime();
    openStandAddress('src/forms/contact/index.tsx');
    const loadForm = vi.fn(() => Promise.resolve({}));

    renderReact(
      <ReformerBuilderFrame
        pluginsUrl="/plugins/"
        loadRuntime={load}
        loadForm={loadForm}
        mode={createModeStore(null)}
      >
        {application}
      </ReformerBuilderFrame>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(loadForm).not.toHaveBeenCalled();
  });
});
