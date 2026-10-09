/**
 * Поверхность «форма приложением» в настоящем браузере: какая рамка открыта, когда она
 * перезагружается и сколько места занимает в теле вкладки.
 *
 * Рамка здесь настоящая, а приложения за ней нет: адреса ведут на заведомо несуществующий
 * узел (зона `.invalid` не разрешается никогда), так что рамка не грузит ничего — в том числе
 * страницы самого прогона. Проверяется не то, что нарисовано внутри, а договор поверхности —
 * адрес рамки, её имя, замена после записи файлов, размер и то, что о несохранённых правках
 * сказано: приложение рисует записанное на диск, и без этих слов вид выглядит сломанным.
 *
 * @module plugins/base/app-preview/form-surface.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_PREVIEW_FRAME_NAME,
  type Disposable,
  type PreviewContext,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import ru from './locales/ru.json';
import { APP_FORM_SURFACE_ID, createFormSurface } from './form-surface';

const ORIGIN = 'http://app-preview.invalid';
const standOf = (modulePath: string): string =>
  `${ORIGIN}/contacts?form=${encodeURIComponent(modulePath)}`;

const messages: Readonly<Record<string, string>> = ru;
const t = (key: string, params?: Record<string, unknown>): string =>
  (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));

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

const directoryOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')));

const SCHEMA = file('src/forms/contact/form.schema.json');
const CONTACT = [SCHEMA, file('src/forms/contact/index.tsx')];

/** Контекст поверхности в объёме, которым она пользуется: адрес документа. */
const contextOf = (document: ResourceRef): PreviewContext =>
  ({ doc: { id: document.id, ref: document, kind: 'model' } }) as unknown as PreviewContext;

const mounted: Disposable[] = [];
afterEach(() => {
  for (const item of mounted.splice(0)) item.dispose();
  document.body.replaceChildren();
});

/** Элемент тела вкладки, каким его даёт редактор. */
function hostOf(style: string): HTMLElement {
  const outer = document.createElement('div');
  outer.style.cssText = style;
  const host = document.createElement('div');
  outer.append(host);
  document.body.append(outer);
  return host;
}

interface Stand {
  readonly host: HTMLElement;
  /** Сообщить поверхности, что файлы проекта записаны на диск. */
  writeSource(): void;
  /** Файлы проекта: каталог отдаёт те из них, что лежат прямо в нём. */
  setEntries(entries: readonly ResourceRef[]): void;
  /** Правка рабочей копии: открытые файлы с несохранённым — их адресами. */
  edit(dirty: readonly string[]): void;
  /** Сохранение: правок не осталось, файлы записаны. */
  saved(): void;
  readonly listed: ReturnType<typeof vi.fn>;
  readonly saveAll: ReturnType<typeof vi.fn>;
  dispose(): void;
}

interface MountOptions {
  readonly entries: readonly ResourceRef[];
  readonly host?: HTMLElement;
  /** Несохранённые файлы на момент открытия вида. */
  readonly dirty?: readonly string[];
  /** Без права сохранять: служба сохранения плагину не отдана. */
  readonly withoutSaving?: boolean;
}

function mount(options: MountOptions): Stand {
  const writeListeners = new Set<() => void>();
  const changeListeners = new Set<(changed: readonly string[]) => void>();
  let dirty = new Set(options.dirty ?? []);
  const saveAll = vi.fn(() => Promise.resolve(true));
  let entries = options.entries;
  const listed = vi.fn((directory: string) =>
    Promise.resolve(entries.filter((entry) => `fs:${directoryOf(entry.path)}` === directory))
  );
  const surface = createFormSurface({
    preview: {
      formUrl: standOf,
      onDidWriteSource: (cb) => {
        writeListeners.add(cb);
        return { dispose: () => writeListeners.delete(cb) };
      },
    },
    files: {
      // Каталог файла — его идентификатор без имени: `fs:src/forms/contact`.
      parentOf: (id) => directoryOf(id),
      list: listed,
      onDidChange: (cb) => {
        changeListeners.add(cb);
        return { dispose: () => changeListeners.delete(cb) };
      },
    },
    saving: () =>
      options.withoutSaving === true ? undefined : { isDirty: () => dirty.size > 0, saveAll },
    t,
    reloadDelayMs: 10,
  });
  const host = options.host ?? hostOf('height: 400px;');
  // Блок с заданной высотой — так тело вкладки отдаёт редактор схемы ReFormer.
  if (options.host === undefined) host.style.height = '100%';
  const disposable = surface.mount(host, contextOf(SCHEMA));
  mounted.push(disposable);
  return {
    host,
    writeSource: () => {
      for (const listener of [...writeListeners]) listener();
    },
    setEntries: (next) => {
      entries = next;
    },
    edit: (next) => {
      dirty = new Set(next);
      for (const listener of [...changeListeners]) listener(next);
    },
    saved: () => {
      dirty = new Set();
      for (const listener of [...writeListeners]) listener();
    },
    listed,
    saveAll,
    dispose: () => {
      disposable.dispose();
    },
  };
}

const frameIn = (host: HTMLElement): HTMLIFrameElement | null => host.querySelector('iframe');
const noticeIn = (host: HTMLElement): HTMLElement | null =>
  host.querySelector('[data-app-preview="empty"]');
/** Полоса о несохранённых правках; `null` — её нет на экране. */
const unsavedIn = (host: HTMLElement): HTMLElement | null => {
  const strip = host.querySelector<HTMLElement>('[data-app-preview="unsaved"]');
  return strip !== null && strip.getBoundingClientRect().height > 0 ? strip : null;
};

describe('что поверхность объявляет о себе', () => {
  const surface = createFormSurface({
    preview: { formUrl: standOf, onDidWriteSource: () => ({ dispose: () => {} }) },
    files: {
      parentOf: (id) => id,
      list: () => Promise.resolve([]),
      onDidChange: () => ({ dispose: () => {} }),
    },
    t,
  });

  it('форму можно трогать, но узел щелчком не выбрать: документ приложения билдеру не виден', () => {
    expect(surface.capabilities).toEqual({
      interactive: true,
      hitTest: false,
      dragSource: false,
      executesCode: false,
      sameRealm: false,
    });
  });

  it('берётся за любой документ: какую форму показать, решает его каталог', () => {
    expect(surface.applies({ id: SCHEMA.id, ref: SCHEMA, kind: 'model' })).toBe(true);
    expect(surface.applies({ id: SCHEMA.id, ref: SCHEMA, kind: 'text' })).toBe(true);
  });

  it('называет себя для человека и для реестра', () => {
    expect(surface.id).toBe(APP_FORM_SURFACE_ID);
    expect(surface.title?.()).toBe('Приложение');
  });
});

describe('рамка формы', () => {
  it('открывает стенд формы, чей модуль лежит в каталоге документа', async () => {
    const { host } = mount({ entries: CONTACT });

    await vi.waitFor(() => {
      expect(frameIn(host)?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    });
  });

  it('названа именем из контракта: по нему приложение узнаёт, что оно в превью', async () => {
    const { host } = mount({ entries: CONTACT });

    await vi.waitFor(() => {
      expect(frameIn(host)?.getAttribute('name')).toBe(APP_PREVIEW_FRAME_NAME);
    });
    expect(frameIn(host)?.title).toBe('Форма, как её рисует приложение');
  });

  it('модуля формы в каталоге нет — называет недостающий файл, а рамку не рисует', async () => {
    const { host } = mount({ entries: [SCHEMA] });

    await vi.waitFor(() => {
      expect(noticeIn(host)?.textContent).toContain('index.tsx');
    });
    expect(frameIn(host)).toBeNull();
  });

  it('каталог не прочитался — то же «модуля нет», а не необработанный отказ', async () => {
    const stand = mount({ entries: CONTACT });
    stand.listed.mockRejectedValue(new Error('каталог удалён'));
    stand.writeSource();

    await vi.waitFor(() => {
      expect(noticeIn(stand.host)).not.toBeNull();
    });
  });
});

describe('обновление после записи', () => {
  it('рамка заменяется новой — приложение рисует форму заново', async () => {
    const stand = mount({ entries: CONTACT });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });
    const before = frameIn(stand.host);

    stand.writeSource();

    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBe(before);
    });
    expect(frameIn(stand.host)?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    expect(stand.host.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('несколько записей подряд — одна перезагрузка', async () => {
    const stand = mount({ entries: CONTACT });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });
    const reads = stand.listed.mock.calls.length;

    // Схема и её сайдкары пишутся одна за другой.
    stand.writeSource();
    stand.writeSource();
    stand.writeSource();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(stand.listed.mock.calls.length).toBe(reads + 1);
  });

  it('модуль формы, появившийся после записи, подхватывается без переоткрытия вкладки', async () => {
    const stand = mount({ entries: [SCHEMA] });
    await vi.waitFor(() => {
      expect(noticeIn(stand.host)).not.toBeNull();
    });

    // Кодоген напечатал модуль формы и записал его на диск.
    stand.setEntries(CONTACT);
    stand.writeSource();

    await vi.waitFor(() => {
      expect(frameIn(stand.host)?.getAttribute('src')).toBe(standOf('src/forms/contact/index.tsx'));
    });
    expect(noticeIn(stand.host)).toBeNull();
  });

  it('модуль формы исчез с диска — вместо рамки сказано, чего не хватает', async () => {
    const stand = mount({ entries: CONTACT });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });

    stand.setEntries([SCHEMA]);
    stand.writeSource();

    await vi.waitFor(() => {
      expect(noticeIn(stand.host)?.textContent).toContain('index.tsx');
    });
    expect(frameIn(stand.host)).toBeNull();
  });
});

describe('снятие поверхности', () => {
  it('уносит рамку и больше не слушает записи', async () => {
    const stand = mount({ entries: CONTACT });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });
    const reads = stand.listed.mock.calls.length;

    stand.dispose();
    stand.writeSource();
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(stand.host.children).toHaveLength(0);
    expect(stand.listed.mock.calls.length).toBe(reads);
    // И правки рабочей копии — тоже: полосу показывать уже негде.
    expect(() => {
      stand.edit([SCHEMA.id]);
    }).not.toThrow();
  });

  it('снятая до ответа каталога ничего не рисует', async () => {
    const stand = mount({ entries: CONTACT });

    stand.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(stand.host.children).toHaveLength(0);
  });
});

describe('несохранённые правки', () => {
  it('их нет — над формой ничего лишнего', async () => {
    const { host } = mount({ entries: CONTACT });
    await vi.waitFor(() => {
      expect(frameIn(host)).not.toBeNull();
    });

    expect(unsavedIn(host)).toBeNull();
  });

  it('правка появилась — полоса говорит, что приложение рисует записанное на диск', async () => {
    const stand = mount({ entries: CONTACT });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });
    const before = frameIn(stand.host);

    // Человек повернул группу в ряд: правка в рабочей копии, на диске — прежнее.
    stand.edit([SCHEMA.id]);

    expect(unsavedIn(stand.host)?.textContent).toContain('Есть несохранённые правки');
    expect(unsavedIn(stand.host)?.textContent).toContain('записано на диск');
    // Форму правка не трогает: показывать её приложению нечем, пока она не записана.
    expect(frameIn(stand.host)).toBe(before);
  });

  it('вид открыли уже с несохранённым — полоса стоит сразу', () => {
    const { host } = mount({ entries: CONTACT, dirty: [SCHEMA.id] });

    expect(unsavedIn(host)).not.toBeNull();
  });

  it('считается правка в любом файле рабочей копии: форму собирает не одна схема', () => {
    const { host } = mount({ entries: CONTACT, dirty: ['fs:src/services/cities.ts'] });

    expect(unsavedIn(host)).not.toBeNull();
  });

  it('кнопка в полосе сохраняет всё изменённое', () => {
    const stand = mount({ entries: CONTACT, dirty: [SCHEMA.id] });

    const save = unsavedIn(stand.host)?.querySelector('button');
    expect(save?.textContent).toBe('Сохранить');
    save?.click();

    expect(stand.saveAll).toHaveBeenCalledTimes(1);
  });

  it('после сохранения полоса уходит, а форма показана заново', async () => {
    const stand = mount({ entries: CONTACT, dirty: [SCHEMA.id] });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });
    const before = frameIn(stand.host);

    stand.saved();

    // Полоса — сразу: сохранение уже случилось, ждать перезагрузки рамки ей незачем.
    expect(unsavedIn(stand.host)).toBeNull();
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBe(before);
    });
  });

  it('правку откатили без сохранения — полоса уходит', () => {
    const stand = mount({ entries: CONTACT, dirty: ['fs:src/services/cities.ts'] });
    expect(unsavedIn(stand.host)).not.toBeNull();

    stand.edit([]);

    expect(unsavedIn(stand.host)).toBeNull();
  });

  it('права сохранять нет — полосы нет: узнать о правках больше не у кого', async () => {
    const stand = mount({ entries: CONTACT, dirty: [SCHEMA.id], withoutSaving: true });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });

    stand.edit([SCHEMA.id]);

    expect(unsavedIn(stand.host)).toBeNull();
  });

  it('полоса отнимает у формы строку, а не место под ней', async () => {
    const stand = mount({ entries: CONTACT, dirty: [SCHEMA.id] });
    await vi.waitFor(() => {
      expect(frameIn(stand.host)).not.toBeNull();
    });

    const strip = unsavedIn(stand.host)!.getBoundingClientRect();
    const frame = frameIn(stand.host)!.getBoundingClientRect();
    expect(frame.top).toBe(strip.bottom);
    expect(strip.height + frame.height).toBe(400);
  });
});

describe('место в теле вкладки', () => {
  const heightOf = async (host: HTMLElement): Promise<number> => {
    await vi.waitFor(() => {
      expect(frameIn(host)).not.toBeNull();
    });
    return frameIn(host)!.getBoundingClientRect().height;
  };

  it('элемент с заданной высотой занимает целиком', async () => {
    const { host } = mount({ entries: CONTACT });

    expect(await heightOf(host)).toBe(400);
  });

  it('гибкую колонку занимает целиком — так тело вкладки отдаёт редактор RJSF', async () => {
    const host = hostOf('height: 400px; overflow: auto;');
    host.style.cssText = 'display: flex; flex-direction: column; min-height: 100%;';
    mount({ entries: CONTACT, host });

    expect(await heightOf(host)).toBe(400);
  });

  it('элементу без высоты даёт наименьшую: рамка нулевой высоты выглядела бы отказом', async () => {
    const host = hostOf('');
    mount({ entries: CONTACT, host });

    expect(await heightOf(host)).toBe(240);
  });
});
