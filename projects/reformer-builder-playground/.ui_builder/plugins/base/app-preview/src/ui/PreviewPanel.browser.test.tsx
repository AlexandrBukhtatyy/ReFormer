/**
 * Панель превью в настоящем браузере: какая рамка открыта и когда она перезагружается.
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
import {
  APP_PREVIEW_FRAME_NAME,
  type AppPreviewService,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import { renderReact } from '../../../../.shared/render';
import ru from '../locales/ru.json';
import { PreviewPanel, type PreviewPanelProps } from './PreviewPanel';

const ORIGIN = 'http://app-preview.invalid';
const PAGE = `${ORIGIN}/contacts`;
const standOf = (modulePath: string): string =>
  `${ORIGIN}/contacts?form=${encodeURIComponent(modulePath)}`;

const messages: Readonly<Record<string, string>> = ru;
const i18n: PreviewPanelProps['i18n'] = {
  locale: 'ru',
  t: (key, params) =>
    (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? '')),
  onDidChangeLocale: () => ({ dispose: () => {} }),
};

function file(path: string): ResourceRef {
  return {
    id: `fs:${path}`,
    sourceId: 'fs',
    path,
    name: path.split('/').at(-1) ?? path,
    kind: 'file',
    mediaType: 'text/plain',
  };
}

interface Stand {
  readonly props: PreviewPanelProps;
  /** Сообщить панели, что файлы проекта записаны на диск. */
  writeSource(): void;
  /** Файлы проекта: каталог отдаёт те из них, что лежат прямо в нём. */
  setEntries(entries: readonly ResourceRef[]): void;
  /** Открыть в билдере другой файл (или ни одного). */
  open(active: string | null): void;
  readonly openTab: ReturnType<typeof vi.fn>;
}

const directoryOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')));

function stand(options: { active: string | null; entries?: readonly ResourceRef[] }): Stand {
  const writeListeners = new Set<() => void>();
  const documentListeners = new Set<() => void>();
  let entries = options.entries ?? [];
  let active = options.active;
  const preview: AppPreviewService = {
    pageUrl: () => PAGE,
    formUrl: standOf,
    onDidWriteSource: (cb) => {
      writeListeners.add(cb);
      return { dispose: () => writeListeners.delete(cb) };
    },
  };
  const openTab = vi.fn();
  return {
    props: {
      preview,
      i18n,
      documents: {
        activeResource: () => active,
        onDidChange: (cb) => {
          documentListeners.add(cb);
          return { dispose: () => documentListeners.delete(cb) };
        },
      },
      files: {
        // Каталог файла — его идентификатор без имени: `fs:src/forms/contact`.
        parentOf: (id) => directoryOf(id),
        list: (directory) =>
          Promise.resolve(entries.filter((entry) => `fs:${directoryOf(entry.path)}` === directory)),
      },
      openTab,
      reloadDelayMs: 10,
    },
    writeSource: () => {
      for (const listener of [...writeListeners]) listener();
    },
    setEntries: (next) => {
      entries = next;
    },
    open: (next) => {
      active = next;
      for (const listener of [...documentListeners]) listener();
    },
    openTab,
  };
}

const frame = (): HTMLIFrameElement | null => document.querySelector('iframe');

const CONTACT = [file('src/forms/contact/form.schema.json'), file('src/forms/contact/index.tsx')];

describe('режим «форма»', () => {
  it('открывает стенд формы, чей модуль лежит рядом с открытым файлом', async () => {
    const { props } = stand({ active: 'fs:src/forms/contact/form.schema.json', entries: CONTACT });

    renderReact(<PreviewPanel {...props} />);

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    });
  });

  it('называет рамку именем из контракта: по нему приложение узнаёт, что оно в превью', async () => {
    const { props } = stand({ active: 'fs:src/forms/contact/form.schema.json', entries: CONTACT });

    renderReact(<PreviewPanel {...props} />);

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('name')).toBe(APP_PREVIEW_FRAME_NAME);
    });
  });

  it('без открытого файла говорит, что открыть, а рамку не рисует', async () => {
    const { props } = stand({ active: null });

    renderReact(<PreviewPanel {...props} />);

    await expect.element(page.getByRole('status')).toHaveTextContent('Откройте файл формы');
    expect(frame()).toBeNull();
  });

  it('файл открыт, а модуля формы рядом нет — называет недостающий файл', async () => {
    const { props } = stand({
      active: 'fs:src/forms/contact/form.schema.json',
      entries: [file('src/forms/contact/form.schema.json')],
    });

    renderReact(<PreviewPanel {...props} />);

    await expect.element(page.getByRole('status')).toHaveTextContent('index.tsx');
    expect(frame()).toBeNull();
  });

  it('модуль формы, появившийся после записи, подхватывается без переоткрытия файла', async () => {
    const stage = stand({
      active: 'fs:src/forms/contact/form.schema.json',
      entries: [file('src/forms/contact/form.schema.json')],
    });
    renderReact(<PreviewPanel {...stage.props} />);
    await expect.element(page.getByRole('status')).toHaveTextContent('index.tsx');

    // Кодоген напечатал модуль формы и записал его на диск.
    stage.setEntries(CONTACT);
    stage.writeSource();

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    });
  });

  it('открыт файл без своей формы — на экране остаётся прежняя, той же рамкой', async () => {
    const stage = stand({
      active: 'fs:src/forms/contact/form.schema.json',
      entries: [...CONTACT, file('src/services/cities.ts')],
    });
    renderReact(<PreviewPanel {...stage.props} />);
    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    });
    const before = frame();

    // Сервис, которым форма пользуется, лежит не в её каталоге.
    stage.open('fs:src/services/cities.ts');

    // Поиск модуля у нового файла — несколько чтений каталога; ждём, пока панель их закончит.
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Форма названа в панели: она уже не из каталога открытого файла.
    await expect
      .element(page.getByText('src/forms/contact/index.tsx', { exact: false }))
      .toBeInTheDocument();
    // Та же рамка, а не новая с тем же адресом: введённое в форму не пропало.
    expect(frame()).toBe(before);
    expect(page.getByRole('status').elements()).toHaveLength(0);
  });

  it('прежняя форма исчезла с диска — панель говорит, что показывать нечего', async () => {
    const stage = stand({
      active: 'fs:src/forms/contact/form.schema.json',
      entries: [...CONTACT, file('src/services/cities.ts')],
    });
    renderReact(<PreviewPanel {...stage.props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });
    stage.open('fs:src/services/cities.ts');

    stage.setEntries([file('src/forms/contact/form.schema.json'), file('src/services/cities.ts')]);
    stage.writeSource();

    await expect.element(page.getByRole('status')).toHaveTextContent('index.tsx');
    expect(frame()).toBeNull();
  });
});

describe('режим «приложение»', () => {
  it('открывает страницу, с которой включили билдер', async () => {
    const { props } = stand({ active: null });

    renderReact(<PreviewPanel {...props} />);
    await userEvent.click(page.getByRole('button', { name: 'Приложение', exact: true }));

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(PAGE);
    });
  });

  it('адрес из адресной строки открывается в рамке и включает режим «приложение»', async () => {
    const { props } = stand({ active: 'fs:src/forms/contact/form.schema.json', entries: CONTACT });

    renderReact(<PreviewPanel {...props} />);
    await userEvent.fill(page.getByRole('textbox'), '/orders');
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => {
      expect(frame()?.getAttribute('src')).toBe(`${ORIGIN}/orders`);
    });
    await expect
      .element(page.getByRole('button', { name: 'Приложение', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('адрес другого сайта не открывается и помечается', async () => {
    const { props } = stand({ active: null });

    renderReact(<PreviewPanel {...props} />);
    await userEvent.click(page.getByRole('button', { name: 'Приложение', exact: true }));
    await userEvent.fill(page.getByRole('textbox'), 'https://example.com/');
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(frame()?.getAttribute('src')).toBe(PAGE);
  });
});

describe('обновление рамки', () => {
  it('после записи файлов рамка заменяется новой — приложение показано заново', async () => {
    const stage = stand({ active: 'fs:src/forms/contact/form.schema.json', entries: CONTACT });
    renderReact(<PreviewPanel {...stage.props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });
    const before = frame();

    stage.writeSource();

    await vi.waitFor(() => {
      expect(frame()).not.toBe(before);
      expect(frame()?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    });
  });

  it('кнопка «Обновить» заменяет рамку сразу', async () => {
    const { props } = stand({ active: 'fs:src/forms/contact/form.schema.json', entries: CONTACT });
    renderReact(<PreviewPanel {...props} />);
    await vi.waitFor(() => {
      expect(frame()).not.toBeNull();
    });
    const before = frame();

    await userEvent.click(page.getByRole('button', { name: 'Обновить' }));

    await vi.waitFor(() => {
      expect(frame()).not.toBe(before);
    });
  });
});

describe('приложение в отдельной вкладке', () => {
  it('открывается страница приложения — а не стенд формы, даже из режима «форма»', async () => {
    const stage = stand({ active: 'fs:src/forms/contact/form.schema.json', entries: CONTACT });
    renderReact(<PreviewPanel {...stage.props} />);

    await userEvent.click(page.getByRole('button', { name: /отдельной вкладке/ }));

    expect(stage.openTab).toHaveBeenCalledWith(PAGE);
  });
});
