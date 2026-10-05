/**
 * Тесты плагина файлов.
 *
 * Порт здесь подставной — настоящий плагин собирает сам из служб оболочки
 * (`./host-from-context`), и проверен он отдельно. Проверяется то, чем владеет плагин: состав
 * вкладов и правило «за какой файл берётся текстовый редактор». Открытие проекта, недавние
 * и сохранение — в плагине «Проект».
 *
 * @module plugins/base/files/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DiagnosticsServiceToken,
  EditorPoint,
  MenuPoint,
  PanelPoint,
  ResourceDecorationPoint,
} from '@reformer/builder-plugin-api';
import type {
  Diagnostic,
  DiagnosticsService,
  Disposable,
  PluginContext,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';
import type { FilesHost } from './host';
import { FILES_MESSAGES } from './messages';
import {
  createFilesPlugin,
  filesDiagnosticsDecoration,
  filesProblemsPanel,
  filesTextEditor,
  filesTreePanel,
  FILES_DIAGNOSTICS_DECORATION_ID,
  FILES_PLUGIN_ID,
  FILES_PROBLEMS_PANEL_ID,
  FILES_TEXT_EDITOR_ID,
  FILES_TREE_PANEL_ID,
  TEXT_EDITOR_PRIORITY,
} from './plugin';

/**
 * Двойник службы диагностик.
 *
 * Вторая реализация контракта, и это прямая цена границы слоёв: `plugins/**` не видит
 * `@/shell`, поэтому настоящую службу в тест не взять. Двойник умышленно проще: замещение
 * по источнику здесь ни при чём — проверяется показ, а не свод.
 */
function fakeDiagnostics(): DiagnosticsService {
  const items = new Map<ResourceId, readonly Diagnostic[]>();
  const listeners = new Set<(resource: ResourceId) => void>();
  return {
    publish(resource, _source, next) {
      if (next.length === 0) items.delete(resource);
      else items.set(resource, next);
      for (const listener of [...listeners]) listener(resource);
    },
    get: (resource) => items.get(resource) ?? [],
    resources: () => [...items.keys()].sort(),
    onDidChange(cb): Disposable {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
  };
}

function ref(path: string, mediaType: string): ResourceRef {
  return { id: `fs:${path}`, sourceId: 'fs', path, name: path, kind: 'file', mediaType };
}

function fakeHost(overrides: Partial<FilesHost> = {}): FilesHost {
  return {
    ResourceTreePanel: () => null,
    useTranslate: () => (key: string) => key,
    hasProject: () => true,
    documentOf: () => null,
    writeText: () => Promise.resolve(),
    isTextual: (mediaType: string) => mediaType.startsWith('text/'),
    // Дерево и корень — то, чем пользуются команды дерева; двойник отвечает «пусто»,
    // и этого хватает всем тестам, которые про них не спрашивают.
    treeSelection: () => [],
    treeRoot: () => null,
    ...overrides,
  };
}

/**
 * Реестры в объёме, который трогает `activate`.
 *
 * Реестр сервисов настоящему не подражает — он отвечает на один токен. Отсутствие службы
 * диагностик проверяется тем же двойником: `withDiagnostics = false`.
 */
function fakeContext(withDiagnostics = true) {
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const registered: { id: string }[] = [];
  const diagnostics = fakeDiagnostics();
  /** Словарь, внесённый плагином: локаль → ключ → текст. */
  const dictionary = new Map<string, Readonly<Record<string, string>>>();
  const ctx = {
    id: FILES_PLUGIN_ID,
    subscriptions: [],
    i18n: {
      contribute: (locale: string, messages: Readonly<Record<string, string>>) => {
        dictionary.set(locale, messages);
      },
    },
    services: {
      get: (token: unknown) =>
        withDiagnostics && token === DiagnosticsServiceToken ? diagnostics : undefined,
    },
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => undefined };
      },
    },
    commands: {
      register: (command: { id: string }) => {
        registered.push(command);
        return { dispose: () => undefined };
      },
      execute: () => Promise.resolve(undefined),
    },
  } as unknown as PluginContext;
  return { ctx, contributed, registered, diagnostics, dictionary };
}

describe('панель проекта', () => {
  it('стоит в левом доке и рисуется телом, которое дала платформа', () => {
    const host = fakeHost();

    const panel = filesTreePanel(host);

    expect(panel).toMatchObject({ id: FILES_TREE_PANEL_ID, slot: 'panel.left' });
    expect(panel?.Body).toBe(host.ResourceTreePanel);
  });

  it('заголовок — ключ в пространстве имён плагина, а не готовая строка', () => {
    expect(filesTreePanel(fakeHost())?.titleKey).toBe('panel.title');
  });

  it('оболочка дерева не даёт — панели нет вовсе, а не пустая вкладка в рейле', () => {
    // Тело панели — возможность оболочки (`reformer.workspace.tree`). Приложение на той же
    // оболочке вправе её не давать: плагин остаётся панелью проблем и текстовым редактором.
    const host = fakeHost({ ResourceTreePanel: undefined });

    expect(filesTreePanel(host)).toBeNull();

    const { ctx, contributed } = fakeContext();
    createFilesPlugin({ host }).activate(ctx);
    expect(contributed.map((entry) => entry.id)).not.toContain(FILES_TREE_PANEL_ID);
    expect(contributed.map((entry) => entry.id)).toContain(FILES_PROBLEMS_PANEL_ID);
  });
});

describe('текстовый редактор', () => {
  it('берётся за то, что читается текстом, с наименьшим приоритетом', () => {
    const editor = filesTextEditor(fakeHost());

    expect(
      editor.canOpen(ref('readme.md', 'text/markdown'), { text: () => Promise.resolve('') })
    ).toBe(TEXT_EDITOR_PRIORITY);
  });

  it('отказывается от двоичного ресурса', () => {
    const editor = filesTextEditor(fakeHost());

    expect(editor.canOpen(ref('logo.png', 'image/png'), { text: () => Promise.resolve('') })).toBe(
      false
    );
  });

  it('решает по медиатипу, не читая содержимого', () => {
    const text = vi.fn(() => Promise.resolve('тело'));

    filesTextEditor(fakeHost()).canOpen(ref('a.txt', 'text/plain'), { text });

    expect(text).not.toHaveBeenCalled();
  });
});

describe('активация', () => {
  it('вносит панели, редактор, пункты меню и пометку — в точки SDK, без подстановок', () => {
    const plugin = createFilesPlugin({ host: fakeHost() });
    const { ctx, contributed, registered } = fakeContext();

    plugin.activate(ctx);

    // Команды — операции над ресурсами; их состав этот тест не сторожит: владелец
    // `./operations`, и перечислять их здесь значило бы ломать тест на каждой новой операции.
    // Сторожится обратное: команд ПРОЕКТА здесь больше нет — они у плагина «Проект».
    expect(registered.length).toBeGreaterThan(0);
    expect(
      registered.map((command) => command.id).filter((id) => /save|openProject/i.test(id))
    ).toEqual([]);

    const points = contributed.map((entry) => `${entry.point}:${entry.id ?? ''}`);
    expect(points).toEqual(
      expect.arrayContaining([
        `${PanelPoint.id}:${FILES_TREE_PANEL_ID}`,
        `${PanelPoint.id}:${FILES_PROBLEMS_PANEL_ID}`,
        `${EditorPoint.id}:${FILES_TEXT_EDITOR_ID}`,
        // Заголовок общего подменю «Сгенерировать»: его наполняют стеки, а вносит основа.
        `${MenuPoint.id}:files.context.generate`,
        `${ResourceDecorationPoint.id}:${FILES_DIAGNOSTICS_DECORATION_ID}`,
      ])
    );
    // Пунктов меню «Файл» плагин больше не вносит: открыть и сохранить — дело «Проекта».
    expect(points.filter((point) => point.startsWith(`${MenuPoint.id}:files.menu.`))).toEqual([]);
  });

  it('словарь вносит сам плагин: заголовки панелей и команд не остаются маркерами промаха', () => {
    // Раньше словарь регистрировала композиция, и ради этого оболочка импортировала плагин.
    const { ctx, dictionary } = fakeContext();

    createFilesPlugin({ host: fakeHost() }).activate(ctx);

    expect(dictionary.get('ru')).toEqual(FILES_MESSAGES.ru);
    expect(dictionary.get('en')).toEqual(FILES_MESSAGES.en);
    expect(FILES_MESSAGES.ru?.['panel.title']).toBeDefined();
  });

  it('всё зарегистрированное лежит в подписках: иначе выключение плагина оставит следы', () => {
    const plugin = createFilesPlugin({ host: fakeHost() });
    const { ctx, contributed, registered } = fakeContext();

    plugin.activate(ctx);

    // Инвариант, а не число: «сколько всего вкладов» меняется с каждой новой командой или
    // пунктом меню, а «всё зарегистрированное снимается при выключении» — не меняется никогда.
    expect(ctx.subscriptions).toHaveLength(registered.length + contributed.length);
  });

  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createFilesPlugin({ host: fakeHost() }).id).toBe(FILES_PLUGIN_ID);
  });
});

describe('панель проблем', () => {
  it('стоит в нижнем доке: список читают вместе с текстом, а не вместо него', () => {
    const panel = filesProblemsPanel(fakeHost(), null);

    expect(panel).toMatchObject({ id: FILES_PROBLEMS_PANEL_ID, slot: 'panel.bottom' });
  });

  it('заголовок — ключ в пространстве имён плагина, а не готовая строка', () => {
    expect(filesProblemsPanel(fakeHost(), null).titleKey).toBe('problems.title');
  });

  it('вносится и без службы диагностик: без неё она просто пуста', () => {
    const plugin = createFilesPlugin({ host: fakeHost() });
    const { ctx, contributed } = fakeContext(false);

    plugin.activate(ctx);

    expect(contributed.map((entry) => entry.id)).toContain(FILES_PROBLEMS_PANEL_ID);
  });

  it('а вот пометка без службы НЕ вносится: вклад, который всегда молчит, лишний', () => {
    const plugin = createFilesPlugin({ host: fakeHost() });
    const { ctx, contributed } = fakeContext(false);

    plugin.activate(ctx);

    expect(contributed.map((entry) => entry.id)).not.toContain(FILES_DIAGNOSTICS_DECORATION_ID);
  });
});

describe('пометка на файле', () => {
  const file = ref('schema.json', 'application/json');
  const dir: ResourceRef = { ...ref('forms', 'inode/directory'), kind: 'directory' };
  const probe = { text: () => Promise.resolve('') };
  const error: Diagnostic = {
    source: 'validator.schema',
    severity: 'error',
    code: 'schema.unknown-component',
    target: { kind: 'node', nodeId: 'ab12cd34' },
  };

  it('чистый файл пометки не получает', () => {
    expect(filesDiagnosticsDecoration(fakeDiagnostics()).decorate(file, probe)).toBeNull();
  });

  it('файл с находкой получает счётчик и тон', () => {
    const diagnostics = fakeDiagnostics();
    diagnostics.publish(file.id, 'validator.schema', [error]);

    expect(filesDiagnosticsDecoration(diagnostics).decorate(file, probe)).toMatchObject({
      badge: '1',
      tone: 'danger',
    });
  });

  it('каталогу не приписывается свод детей: их состав знает дерево, а не вклад', () => {
    const diagnostics = fakeDiagnostics();
    diagnostics.publish(dir.id, 'validator.schema', [error]);

    expect(filesDiagnosticsDecoration(diagnostics).decorate(dir, probe)).toBeNull();
  });

  it('содержимого файла не читает: иначе раскрытие каталога стоило бы N чтений', () => {
    const diagnostics = fakeDiagnostics();
    diagnostics.publish(file.id, 'validator.schema', [error]);
    const text = vi.fn(() => Promise.resolve('{}'));

    filesDiagnosticsDecoration(diagnostics).decorate(file, { text });

    expect(text).not.toHaveBeenCalled();
  });

  it('сообщает дереву, что пометка изменилась: иначе она была бы одноразовой', () => {
    const diagnostics = fakeDiagnostics();
    const changed = vi.fn();
    const subscription = filesDiagnosticsDecoration(diagnostics).onDidChange?.(changed);

    diagnostics.publish(file.id, 'validator.schema', [error]);

    expect(changed).toHaveBeenCalledOnce();
    subscription?.dispose();
    diagnostics.publish(file.id, 'validator.schema', []);
    expect(changed).toHaveBeenCalledOnce();
  });
});
