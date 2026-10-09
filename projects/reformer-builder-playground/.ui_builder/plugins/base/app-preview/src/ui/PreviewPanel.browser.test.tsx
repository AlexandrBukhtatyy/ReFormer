/**
 * Панель превью в настоящем браузере: какая страница открыта и когда рамка перезагружается.
 *
 * Рамка здесь настоящая, а приложения за ней нет: адреса ведут на заведомо несуществующий
 * узел (зона `.invalid` не разрешается никогда), так что рамка не грузит ничего — в том числе
 * страницы самого прогона. Проверяется не то, что нарисовано внутри, а договор панели — адрес
 * рамки, её имя и то, что после записи файлов она заменяется новой.
 *
 * @module plugins/base/app-preview/ui/PreviewPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { APP_PREVIEW_FRAME_NAME } from '@reformer/builder-plugin-api';
import { renderReact } from '../../../../.shared/render';
import ru from '../locales/ru.json';
import { PreviewPanel, type PreviewPanelProps } from './PreviewPanel';

const ORIGIN = 'http://app-preview.invalid';
const PAGE = `${ORIGIN}/contacts`;

const messages: Readonly<Record<string, string>> = ru;
const i18n: PreviewPanelProps['i18n'] = {
  locale: 'ru',
  t: (key, params) =>
    (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? '')),
  onDidChangeLocale: () => ({ dispose: () => {} }),
};

interface Stand {
  readonly props: PreviewPanelProps;
  /** Сообщить панели, что файлы проекта записаны на диск. */
  writeSource(): void;
  readonly openTab: ReturnType<typeof vi.fn>;
}

function stand(): Stand {
  const writeListeners = new Set<() => void>();
  const openTab = vi.fn();
  return {
    props: {
      preview: {
        pageUrl: () => PAGE,
        onDidWriteSource: (cb) => {
          writeListeners.add(cb);
          return { dispose: () => writeListeners.delete(cb) };
        },
      },
      i18n,
      openTab,
      reloadDelayMs: 10,
    },
    writeSource: () => {
      for (const listener of [...writeListeners]) listener();
    },
    openTab,
  };
}

const frame = (): HTMLIFrameElement | null => document.querySelector('iframe');
const panel = (): HTMLElement | null => document.querySelector('[data-app-preview="panel"]');

describe('страница приложения', () => {
  it('открывается та, с которой включили билдер', async () => {
    renderReact(<PreviewPanel {...stand().props} />);

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(PAGE);
    });
    await expect.element(page.getByRole('textbox')).toHaveValue(PAGE);
  });

  it('рамка названа именем из контракта: по нему приложение узнаёт, что оно в превью', async () => {
    renderReact(<PreviewPanel {...stand().props} />);

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('name')).toBe(APP_PREVIEW_FRAME_NAME);
    });
  });

  it('адрес из адресной строки открывается в рамке', async () => {
    renderReact(<PreviewPanel {...stand().props} />);

    await userEvent.fill(page.getByRole('textbox'), '/orders');
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(`${ORIGIN}/orders`);
    });
    // Путь достроен до адреса: в строке стоит то, что открыто.
    await expect.element(page.getByRole('textbox')).toHaveValue(`${ORIGIN}/orders`);
  });

  it('адрес другого сайта не открывается и помечается', async () => {
    renderReact(<PreviewPanel {...stand().props} />);

    await userEvent.fill(page.getByRole('textbox'), 'https://example.com/');
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(frame()?.getAttribute('src')).toBe(PAGE);
  });
});

describe('обновление рамки', () => {
  it('после записи файлов рамка заменяется новой — приложение показано заново', async () => {
    const stage = stand();
    renderReact(<PreviewPanel {...stage.props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });
    const before = frame();

    stage.writeSource();

    await vi.waitFor(() => {
      expect(frame()).not.toBe(before);
    });
    expect(frame()?.getAttribute('src')).toBe(PAGE);
  });

  it('кнопка «Обновить» заменяет рамку сразу', async () => {
    renderReact(<PreviewPanel {...stand().props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });
    const before = frame();

    await userEvent.click(page.getByRole('button', { name: 'Обновить' }));

    await vi.waitFor(() => {
      expect(frame()).not.toBe(before);
    });
  });

  it('обновление возвращает туда, куда человек ушёл адресной строкой', async () => {
    const stage = stand();
    renderReact(<PreviewPanel {...stage.props} />);
    await userEvent.fill(page.getByRole('textbox'), '/orders');
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(`${ORIGIN}/orders`);
    });
    const before = frame();

    stage.writeSource();

    await vi.waitFor(() => {
      expect(frame()).not.toBe(before);
    });
    expect(frame()?.getAttribute('src')).toBe(`${ORIGIN}/orders`);
  });
});

describe('раскладка панели', () => {
  it('над рамкой одна строка: адрес, «Обновить» и отдельная вкладка', async () => {
    renderReact(<PreviewPanel {...stand().props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });

    const row = page.getByRole('textbox').element().parentElement;
    const inRow = (name: string | RegExp): boolean =>
      row?.contains(page.getByRole('button', { name }).element()) === true;
    expect(inRow('Обновить')).toBe(true);
    expect(inRow(/отдельной вкладке/)).toBe(true);
    // Кроме строки адреса и области рамки в панели ничего нет: ни второй строки, ни подписи.
    expect(panel()?.children).toHaveLength(2);
  });

  it('переключателя «форма / приложение» нет: форму показывает вид вкладки', async () => {
    renderReact(<PreviewPanel {...stand().props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });

    expect(document.querySelector('[role="group"]')).toBeNull();
    expect(page.getByRole('button', { name: 'Форма', exact: true }).elements()).toHaveLength(0);
  });

  it('действия в строке адреса адрес не отправляют', async () => {
    renderReact(<PreviewPanel {...stand().props} />);
    await userEvent.fill(page.getByRole('textbox'), '/orders');

    await userEvent.click(page.getByRole('button', { name: 'Обновить' }));

    // Набранное, но не отправленное, в рамку не попало.
    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(PAGE);
    });
  });
});

describe('приложение в отдельной вкладке', () => {
  it('открывается та страница, что сейчас в рамке', async () => {
    const stage = stand();
    renderReact(<PreviewPanel {...stage.props} />);

    await userEvent.click(page.getByRole('button', { name: /отдельной вкладке/ }));

    expect(stage.openTab).toHaveBeenCalledWith(PAGE);
  });
});
