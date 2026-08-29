/**
 * Тесты плагина файлов.
 *
 * Порт платформы здесь подставной — настоящий собирается композицией и требует рабочей
 * области. Проверяется то, чем владеет плагин: состав вкладов, применимость команд и правило
 * «за какой файл берётся текстовый редактор». Платформа в этих ответах не участвует.
 *
 * @module plugins/files/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';

import { DiagnosticsServiceToken } from '@/sdk';
import type {
  Diagnostic,
  DiagnosticsService,
  Disposable,
  PluginContext,
  ResourceId,
  ResourceRef,
} from '@/sdk';
import type { ExtensionPointRef, FilesEditorSpec, FilesHost, FilesPanelSpec } from './host';
import {
  createFilesPlugin,
  filesCommands,
  filesDiagnosticsDecoration,
  filesProblemsPanel,
  filesTextEditor,
  filesMenuItems,
  filesTreePanel,
  FILES_DIAGNOSTICS_DECORATION_ID,
  FILES_PLUGIN_ID,
  FILES_PROBLEMS_PANEL_ID,
  FILES_TEXT_EDITOR_ID,
  FILES_TREE_PANEL_ID,
  OPEN_PROJECT_COMMAND_ID,
  SAVE_ALL_COMMAND_ID,
  SAVE_COMMAND_ID,
  TEXT_EDITOR_PRIORITY,
} from './plugin';

/**
 * Двойник службы диагностик.
 *
 * Вторая реализация контракта, и это прямая цена границы слоёв: `plugins/**` не видит
 * `@/host`, поэтому настоящую службу в тест не взять. Двойник умышленно проще: замещение
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

/** Контекст применимости в том виде, в каком его видит предикат команды. */
function context(activeEditorId: string | null) {
  return {
    focus: 'editable' as const,
    activeEditorId,
    activeResourceKind: null,
    hasSelection: false,
    previewMode: null,
  };
}

function ref(path: string, mediaType: string): ResourceRef {
  return { id: `fs:${path}`, sourceId: 'fs', path, name: path, kind: 'file', mediaType };
}

function fakeHost(overrides: Partial<FilesHost> = {}): FilesHost {
  return {
    ResourceTreePanel: () => null,
    useTranslate: () => (key: string) => key,
    canOpenProject: () => true,
    hasProject: () => true,
    openProject: () => Promise.resolve(true),
    save: () => Promise.resolve(true),
    saveAll: () => Promise.resolve(true),
    activeResource: () => 'fs:a.txt',
    isDirty: () => false,
    documentOf: () => null,
    writeText: () => Promise.resolve(),
    isTextual: (mediaType: string) => mediaType.startsWith('text/'),
    // Операции, дерево и корень — то, чем пользуются команды дерева; двойник отвечает
    // «проекта нет», и этого хватает всем тестам, которые про них не спрашивают.
    resources: () => null,
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
  const ctx = {
    id: FILES_PLUGIN_ID,
    subscriptions: [],
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
  return { ctx, contributed, registered, diagnostics };
}

const panelPoint = { id: 'panel' } as ExtensionPointRef<FilesPanelSpec>;
const editorPoint = { id: 'editor' } as ExtensionPointRef<FilesEditorSpec>;

describe('панель проекта', () => {
  it('стоит в левом доке и рисуется телом, которое дала платформа', () => {
    const host = fakeHost();

    const panel = filesTreePanel(host);

    expect(panel).toMatchObject({ id: FILES_TREE_PANEL_ID, slot: 'panel.left' });
    expect(panel.Body).toBe(host.ResourceTreePanel);
  });

  it('заголовок — ключ в пространстве имён плагина, а не готовая строка', () => {
    expect(filesTreePanel(fakeHost()).titleKey).toBe('panel.title');
  });
});

describe('текстовый редактор', () => {
  it('берётся за то, что читается текстом, с наименьшим приоритетом', () => {
    const editor: FilesEditorSpec = filesTextEditor(fakeHost());

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

describe('команды', () => {
  it('плагин везёт ровно три команды', () => {
    expect(filesCommands(fakeHost()).map((command) => command.id)).toEqual([
      OPEN_PROJECT_COMMAND_ID,
      SAVE_COMMAND_ID,
      SAVE_ALL_COMMAND_ID,
    ]);
  });

  it('сохранение доступно только при открытом редакторе', () => {
    const [, save] = filesCommands(fakeHost());

    expect(save.enabled?.(context('fs:a.txt'))).toBe(true);
    expect(save.enabled?.(context(null))).toBe(false);
  });

  it('сохранение работает и в поле ввода: иначе оно недоступно при наборе', () => {
    const [, save] = filesCommands(fakeHost());

    expect(save.keybinding).toBe('mod+s');
    expect(save.allowInEditable).toBe(true);
  });

  it('сохраняет активный ресурс, а не «какой-нибудь»', async () => {
    const save = vi.fn((id: ResourceId) => Promise.resolve(id !== null));
    const [, command] = filesCommands(fakeHost({ activeResource: () => 'fs:b.txt', save }));

    await command.run();

    expect(save).toHaveBeenCalledWith('fs:b.txt');
  });

  it('исчезнувшая между проверкой и запуском вкладка не приводит к записи не того файла', async () => {
    const save = vi.fn((id: ResourceId) => Promise.resolve(id !== null));
    const [, command] = filesCommands(fakeHost({ activeResource: () => null, save }));

    await expect(command.run()).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('«сохранить всё» доступно только при открытом проекте', () => {
    const [, , saveAll] = filesCommands(fakeHost({ hasProject: () => false }));

    expect(saveAll.enabled?.(context('fs:a.txt'))).toBe(false);
  });

  it('открытие проекта недоступно там, где движок не умеет выбирать каталог', () => {
    const [open] = filesCommands(fakeHost({ canOpenProject: () => false }));

    expect(open.enabled?.(context(null))).toBe(false);
  });
});

describe('пункты меню', () => {
  it('все три стоят в меню «Файл» и ссылаются на команды плагина', () => {
    expect(filesMenuItems().map((item) => item.value)).toEqual([
      expect.objectContaining({ kind: 'item', menu: 'file', command: OPEN_PROJECT_COMMAND_ID }),
      expect.objectContaining({ kind: 'item', menu: 'file', command: SAVE_COMMAND_ID }),
      expect.objectContaining({ kind: 'item', menu: 'file', command: SAVE_ALL_COMMAND_ID }),
    ]);
  });

  it('ни один не несёт своего заголовка: имя приходит от команды', () => {
    for (const { value } of filesMenuItems()) {
      expect(value).not.toHaveProperty('titleKey');
    }
  });

  it('открытие и сохранение — разные группы: линия между ними появится сама', () => {
    const [open, save, saveAll] = filesMenuItems().map((item) => item.value);

    expect(open).toMatchObject({ group: '1_open' });
    expect(save).toMatchObject({ group: '2_save' });
    expect(saveAll).toMatchObject({ group: '2_save' });
  });
});

describe('активация', () => {
  it('регистрирует команды и вносит панели, редактор и пункты меню', () => {
    const plugin = createFilesPlugin({ host: fakeHost(), panelPoint, editorPoint });
    const { ctx, contributed, registered } = fakeContext();

    plugin.activate(ctx);

    // Команды рабочей области идут первыми и в этом порядке; за ними — команды операций
    // над ресурсами, состав которых этот тест не сторожит: их владелец `./operations`,
    // и перечислять их здесь значило бы ломать этот тест на каждой новой операции.
    expect(registered.slice(0, 3).map((command) => command.id)).toEqual([
      OPEN_PROJECT_COMMAND_ID,
      SAVE_COMMAND_ID,
      SAVE_ALL_COMMAND_ID,
    ]);

    const points = contributed.map((entry) => `${entry.point}:${entry.id ?? ''}`);
    expect(points).toEqual(
      expect.arrayContaining([
        `panel:${FILES_TREE_PANEL_ID}`,
        `panel:${FILES_PROBLEMS_PANEL_ID}`,
        `editor:${FILES_TEXT_EDITOR_ID}`,
        'menu:files.menu.openProject',
        'menu:files.menu.save',
        'menu:files.menu.saveAll',
        `resource.decoration:${FILES_DIAGNOSTICS_DECORATION_ID}`,
      ])
    );
  });

  it('всё зарегистрированное лежит в подписках: иначе выключение плагина оставит следы', () => {
    const plugin = createFilesPlugin({ host: fakeHost(), panelPoint, editorPoint });
    const { ctx, contributed, registered } = fakeContext();

    plugin.activate(ctx);

    // Инвариант, а не число: «сколько всего вкладов» меняется с каждой новой командой или
    // пунктом меню, а «всё зарегистрированное снимается при выключении» — не меняется никогда.
    expect(ctx.subscriptions).toHaveLength(registered.length + contributed.length);
  });

  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createFilesPlugin({ host: fakeHost(), panelPoint, editorPoint }).id).toBe(
      FILES_PLUGIN_ID
    );
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
    const plugin = createFilesPlugin({ host: fakeHost(), panelPoint, editorPoint });
    const { ctx, contributed } = fakeContext(false);

    plugin.activate(ctx);

    expect(contributed.map((entry) => entry.id)).toContain(FILES_PROBLEMS_PANEL_ID);
  });

  it('а вот пометка без службы НЕ вносится: вклад, который всегда молчит, лишний', () => {
    const plugin = createFilesPlugin({ host: fakeHost(), panelPoint, editorPoint });
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
