/**
 * Клиент билдера в документе приложения — что он рисует в зависимости от того, где открыт
 * документ, и что происходит с рамкой билдера.
 *
 * Самого билдера здесь нет: рамка открывает пустую страницу. Проверяется договор клиента —
 * когда рамка появляется, что с ней делает закрытие и что её не трогает, — а не то, что
 * внутри неё.
 *
 * @module client/ReformerBuilder.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { renderReact } from '@/testing/render';
import { FORM_STAND_PARAM, PREVIEW_FRAME_NAME, SHELL_FRAME_NAME } from './addresses';
import { HOST_BRIDGE_KEY, type HostBridge } from './host-bridge';
import { createModeStore } from './mode';
import { ReformerBuilderView } from './ReformerBuilder';
import { createShellFrame, type ShellFrame } from './shell-frame';

// Имя окна и адрес у страницы прогона свои — тест обязан вернуть их такими, какими взял.
const initialUrl = window.location.href;
const initialName = window.name;
const bridges = globalThis as { [HOST_BRIDGE_KEY]?: HostBridge };

afterEach(() => {
  // Рамка стоит вне дерева React и снятия компонента не замечает; между тестами страница «новая».
  for (const frame of document.querySelectorAll('iframe[data-reformer-builder]')) frame.remove();
  document.documentElement.style.overflow = '';
  delete bridges[HOST_BRIDGE_KEY];
  window.name = initialName;
  window.history.replaceState(null, '', initialUrl);
});

/** Дописывает параметр стенда к адресу страницы прогона, не теряя её собственных параметров. */
function openStandAddress(modulePath: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(FORM_STAND_PARAM, modulePath);
  window.history.replaceState(null, '', url);
}

/** Настоящая рамка над пустой страницей: билдера в прогоне нет. */
const blankFrame = (): ShellFrame => createShellFrame({ url: 'about:blank' });

const shellFrame = (): HTMLIFrameElement | null =>
  document.querySelector('iframe[data-reformer-builder="overlay"]');

const application = <main aria-label="Приложение">страница приложения</main>;

describe('обычная страница приложения', () => {
  it('рисует приложение и кнопку; рамки билдера ещё нет', async () => {
    renderReact(
      <ReformerBuilderView enabled mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Билдер' })).toBeVisible();
    expect(shellFrame()).toBeNull();
  });

  it('кнопка открывает билдер рамкой поверх страницы; приложение остаётся на месте', async () => {
    renderReact(
      <ReformerBuilderView enabled mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));

    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });
    // По имени окна билдер и клиент узнают, что документ открыт в рамке билдера.
    expect(shellFrame()?.name).toBe(SHELL_FRAME_NAME);
    expect(shellFrame()?.parentElement).toBe(document.body);
    expect(document.querySelector('[aria-label="Приложение"]')).not.toBeNull();
  });

  it('закрытие рамку прячет, а не снимает: состояние билдера живёт в её документе', async () => {
    renderReact(
      <ReformerBuilderView enabled mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });
    const opened = shellFrame();

    await userEvent.click(page.getByRole('button', { name: 'Закрыть билдер' }));
    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('hidden');
    });
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });

    expect(shellFrame()).toBe(opened);
    expect(document.querySelectorAll('iframe[data-reformer-builder]')).toHaveLength(1);
  });

  it('перемонтирование компонента рамку не трогает', async () => {
    const mode = createModeStore(null);
    const frame = blankFrame();
    mode.set(true);
    const first = renderReact(
      <ReformerBuilderView enabled mode={mode} frame={frame}>
        {application}
      </ReformerBuilderView>
    );
    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });
    const opened = shellFrame();

    // «Горячая» замена модуля или смена маршрута: дерево приложения собрано заново.
    first.unmount();
    renderReact(
      <ReformerBuilderView enabled mode={mode} frame={frame}>
        {application}
      </ReformerBuilderView>
    );

    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });
    expect(shellFrame()).toBe(opened);
  });

  it('режим, включённый до перезагрузки страницы, открывает билдер сразу', async () => {
    const mode = createModeStore(null);
    mode.set(true);

    renderReact(
      <ReformerBuilderView enabled mode={mode} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });
    await expect.element(page.getByRole('button', { name: 'Закрыть билдер' })).toBeVisible();
  });

  it('пока документ билдера грузится, об этом сказано; после загрузки сообщения нет', async () => {
    let loaded = false;
    const listeners = new Set<() => void>();
    const frame: ShellFrame = {
      show: () => {},
      hide: () => {},
      loaded: () => loaded,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const mode = createModeStore(null);
    mode.set(true);

    renderReact(
      <ReformerBuilderView enabled mode={mode} frame={frame}>
        {application}
      </ReformerBuilderView>
    );
    await expect.element(page.getByRole('status')).toHaveTextContent('Загружаю билдер');

    loaded = true;
    for (const listener of [...listeners]) listener();

    await vi.waitFor(() => {
      expect(page.getByRole('status').elements()).toHaveLength(0);
    });
  });
});

describe('рамка билдера и страница под ней', () => {
  it('открытая рамка получает фокус — и получает его снова, когда человек вернулся в окно', async () => {
    renderReact(
      <ReformerBuilderView enabled mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(shellFrame());
    });

    // Щелчок по кнопке в документе приложения забрал бы фокус; возврат в окно отдаёт его рамке.
    (document.querySelector('[data-reformer-builder="toggle"]') as HTMLElement).focus();
    expect(document.activeElement).not.toBe(shellFrame());
    window.dispatchEvent(new Event('focus'));

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(shellFrame());
    });
  });

  it('закрытая рамка фокус не забирает', async () => {
    renderReact(
      <ReformerBuilderView enabled mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );
    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('visible');
    });
    await userEvent.click(page.getByRole('button', { name: 'Закрыть билдер' }));
    await vi.waitFor(() => {
      expect(shellFrame()?.style.visibility).toBe('hidden');
    });

    window.dispatchEvent(new Event('focus'));

    expect(document.activeElement).not.toBe(shellFrame());
  });

  it('прокрутка страницы под рамкой выключена и возвращается такой, какой была', async () => {
    document.documentElement.style.overflow = 'scroll';
    renderReact(
      <ReformerBuilderView enabled mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await userEvent.click(page.getByRole('button', { name: 'Билдер' }));
    await vi.waitFor(() => {
      expect(document.documentElement.style.overflow).toBe('hidden');
    });
    await userEvent.click(page.getByRole('button', { name: 'Закрыть билдер' }));

    await vi.waitFor(() => {
      expect(document.documentElement.style.overflow).toBe('scroll');
    });
  });
});

describe('включён ли билдер', () => {
  it('выключенный рисует только приложение: ни кнопки, ни рамки', async () => {
    renderReact(
      <ReformerBuilderView enabled={false} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(document.querySelector('[data-reformer-builder="toggle"]')).toBeNull();
  });

  it('по умолчанию выключен: плагин билдера к dev-серверу не подключён', async () => {
    renderReact(
      <ReformerBuilderView mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(document.querySelector('[data-reformer-builder="toggle"]')).toBeNull();
  });

  it('по умолчанию включён, когда плагин положил на страницу мост к dev-серверу', async () => {
    bridges[HOST_BRIDGE_KEY] = { beforeReload: null };

    renderReact(
      <ReformerBuilderView mode={createModeStore(null)} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('button', { name: 'Билдер' })).toBeVisible();
  });
});

describe('рамка превью', () => {
  it('показывает приложение без кнопки билдера — даже при включённом режиме', async () => {
    const mode = createModeStore(null);
    mode.set(true);
    window.name = PREVIEW_FRAME_NAME;

    renderReact(
      <ReformerBuilderView enabled mode={mode} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(document.querySelector('[data-reformer-builder="toggle"]')).toBeNull();
    expect(shellFrame()).toBeNull();
  });

  it('по адресу стенда рисует одну форму вместо приложения', async () => {
    window.name = PREVIEW_FRAME_NAME;
    openStandAddress('src/forms/contact/index.tsx');
    const loadForm = vi.fn(() =>
      Promise.resolve({
        default: () => <form aria-label="Контакты">форма контактов</form>,
      })
    );

    renderReact(
      <ReformerBuilderView enabled loadForm={loadForm} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('form', { name: 'Контакты' })).toBeVisible();
    expect(loadForm).toHaveBeenCalledWith('src/forms/contact/index.tsx');
    expect(document.querySelector('[aria-label="Приложение"]')).toBeNull();
  });

  it('адрес стенда вне рамки превью — обычная страница приложения', async () => {
    openStandAddress('src/forms/contact/index.tsx');
    const loadForm = vi.fn(() => Promise.resolve({}));

    renderReact(
      <ReformerBuilderView
        enabled
        loadForm={loadForm}
        mode={createModeStore(null)}
        frame={blankFrame()}
      >
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('main', { name: 'Приложение' })).toBeVisible();
    expect(loadForm).not.toHaveBeenCalled();
  });
});

describe('приложение в рамке самого билдера', () => {
  it('значит, сервер билдер не отдаёт: вместо приложения — подсказка, и новой рамки нет', async () => {
    // По адресу билдера dev-сервер без плагина отвечает страницей приложения. Открой оно
    // отсюда ещё одну рамку — та открыла бы следующую.
    const mode = createModeStore(null);
    mode.set(true);
    window.name = SHELL_FRAME_NAME;

    renderReact(
      <ReformerBuilderView enabled mode={mode} frame={blankFrame()}>
        {application}
      </ReformerBuilderView>
    );

    await expect.element(page.getByRole('status')).toHaveTextContent('reformerBuilder()');
    expect(document.querySelector('[aria-label="Приложение"]')).toBeNull();
    expect(document.querySelector('[data-reformer-builder="toggle"]')).toBeNull();
    expect(shellFrame()).toBeNull();
  });
});
