import { describe, expect, it, vi } from 'vitest';

import type { MenuItemContribution, ResourceRef, WhenContext } from '@/sdk';
import type { MarkdownDocument, MarkdownHost } from './host';
import {
  CYCLE_VIEW_COMMAND_ID,
  documentIdOf,
  firstResourceOf,
  MARKDOWN_EDITOR_ID,
  MARKDOWN_EDITOR_PRIORITY,
  markdownCommands,
  markdownEditor,
  markdownMenuItems,
  OPEN_PREVIEW_COMMAND_ID,
  SHOW_CODE_COMMAND_ID,
  SHOW_PREVIEW_COMMAND_ID,
  SHOW_SPLIT_COMMAND_ID,
  TOGGLE_VIEW_COMMAND_ID,
} from './plugin';
import { createMarkdownViewStore, type MarkdownViewStore } from './sessions';
import { MARKDOWN_VIEW_SETTING } from './view';

const README = ref('README.md', 'text/markdown');
const SCHEMA = ref('schema.json', 'application/json');

function ref(path: string, mediaType: string): ResourceRef {
  return {
    id: `fs:${path}`,
    sourceId: 'fs',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType,
  };
}

function context(): WhenContext {
  return {
    focus: 'editable',
    activeEditorId: 'markdown.editor',
    activeResourceKind: null,
    hasSelection: false,
    previewMode: null,
  };
}

function documentOf(source: ResourceRef): MarkdownDocument {
  return {
    ref: source,
    getText: () => '# заголовок',
    onDidChangeContent: () => ({ dispose: () => undefined }),
  };
}

interface Harness {
  readonly host: MarkdownHost;
  readonly views: MarkdownViewStore;
  readonly opened: string[];
}

function harness(options: { active?: ResourceRef; withTextEditor?: boolean } = {}): Harness {
  const active = options.active ?? README;
  const opened: string[] = [];
  const host: MarkdownHost = {
    useTranslate: () => (key: string) => key,
    activeDocument: () => active.id,
    documentOf: (id) => (id === active.id ? documentOf(active) : null),
    readBytes: () => Promise.resolve(null),
    resourceAt: (document, path) => `${document.ref.sourceId}:${path}`,
    openResource: (id) => {
      opened.push(id);
    },
    TextEditor: options.withTextEditor === false ? undefined : () => null,
  };
  const views = createMarkdownViewStore({
    settings: null,
    settingKey: MARKDOWN_VIEW_SETTING,
    hasTextEditor: () => host.TextEditor !== undefined,
  });
  return { host, views, opened };
}

function command(h: Harness, id: string) {
  const found = markdownCommands({ host: h.host, views: h.views }).find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет команды ${id}`);
  return found;
}

describe('вклад редактора', () => {
  it('берётся за markdown и отказывается от прочего — по ссылке, без чтения', () => {
    const h = harness();
    const editor = markdownEditor(h.host, h.views);

    const probe = {
      text: () => Promise.reject(new Error('содержимое читать нельзя')),
    } as unknown as Parameters<typeof editor.canOpen>[1];

    expect(editor.canOpen(README, probe)).toBe(MARKDOWN_EDITOR_PRIORITY);
    expect(editor.canOpen(SCHEMA, probe)).toBe(false);
  });

  it('приоритет выше текстового: markdown чаще открывают ради рендера', () => {
    expect(MARKDOWN_EDITOR_PRIORITY).toBeGreaterThan(1);
  });
});

describe('команды вида', () => {
  it('переключают режим документа, названного аргументом', () => {
    const h = harness();

    command(h, SHOW_PREVIEW_COMMAND_ID).run({ documentId: README.id });

    expect(h.views.get(README.id)).toBe('preview');
  });

  it('без аргументов берут активный документ', () => {
    const h = harness();

    command(h, SHOW_SPLIT_COMMAND_ID).run();

    expect(h.views.get(README.id)).toBe('split');
  });

  it('на не-markdown вкладке недоступны: их клавиша принадлежит другому редактору', () => {
    const h = harness({ active: SCHEMA });

    expect(command(h, SHOW_CODE_COMMAND_ID).enabled?.(context())).toBe(false);
  });

  it('«рядом» недоступно без редактора кода', () => {
    const h = harness({ withTextEditor: false });

    expect(command(h, SHOW_SPLIT_COMMAND_ID).enabled?.(context())).toBe(false);
  });

  it('цикл идёт по кругу и пропускает недоступное', () => {
    const full = harness();
    const cycle = command(full, CYCLE_VIEW_COMMAND_ID);

    cycle.run();
    expect(full.views.get(README.id)).toBe('preview');
    cycle.run();
    expect(full.views.get(README.id)).toBe('split');

    // Без редактора кода круг из трёх видов превращается в круг из двух: иначе одно
    // нажатие из трёх не меняло бы ничего.
    const short = harness({ withTextEditor: false });
    const shortCycle = command(short, CYCLE_VIEW_COMMAND_ID);
    shortCycle.run();
    expect(short.views.get(README.id)).toBe('preview');
    shortCycle.run();
    expect(short.views.get(README.id)).toBe('code');
  });

  it('цикл объявлен тем же сочетанием, что в v1: рука его помнит', () => {
    const h = harness();

    expect(command(h, CYCLE_VIEW_COMMAND_ID).keybinding).toBe('mod+shift+v');
  });
});

describe('открытие предпросмотром', () => {
  it('задаёт режим ДО открытия, чтобы вкладка не мигнула исходником', () => {
    const h = harness();
    const order: string[] = [];
    const views = {
      ...h.views,
      set: vi.fn((id: string, view: string) => {
        order.push(`set:${view}`);
        h.views.set(id as never, view as never);
      }),
    } as unknown as MarkdownViewStore;
    const host: MarkdownHost = {
      ...h.host,
      openResource: (id) => {
        order.push(`open:${id}`);
      },
    };

    const open = markdownCommands({ host, views }).find(
      (item) => item.id === OPEN_PREVIEW_COMMAND_ID
    );
    open?.run({ ids: [README.id] });

    expect(order).toEqual(['set:preview', `open:${README.id}`]);
  });

  it('адрес берётся из аргументов пункта дерева', () => {
    expect(firstResourceOf({ ids: ['fs:a.md', 'fs:b.md'] })).toBe('fs:a.md');
    expect(firstResourceOf({ ids: [] })).toBeNull();
    expect(firstResourceOf('строка')).toBeNull();
    expect(documentIdOf({ documentId: 'fs:a.md' })).toBe('fs:a.md');
    expect(documentIdOf({ documentId: 42 })).toBeNull();
  });
});

describe('кнопки в строке вкладок', () => {
  const items = (h: Harness) => markdownMenuItems(h.views, () => h.host.TextEditor !== undefined);
  const itemOf = (h: Harness, id: string): MenuItemContribution => {
    const found = items(h).find((item) => item.id === id);
    if (found === undefined || found.value.kind !== 'item') throw new Error(`нет пункта ${id}`);
    return found.value;
  };
  /** Цель ряда: документ и редактор, который его рисует, — по нему кнопки узнают свои. */
  const target = (source: ResourceRef, editorId: string | null = MARKDOWN_EDITOR_ID) => ({
    documentId: source.id,
    ref: source,
    editorId,
  });

  it('переключатель вида — ОДНА кнопка: видна ровно половина пары', () => {
    const h = harness();
    const toPreview = itemOf(h, 'markdown.title.toPreview');
    const toCode = itemOf(h, 'markdown.title.toCode');

    // Документ открыт исходником: кнопка ведёт в предпросмотр.
    expect(toPreview.when?.(context(), target(README))).toBe(true);
    expect(toCode.when?.(context(), target(README))).toBe(false);

    h.views.set(README.id, 'preview');

    // Показан рендер: та же кнопка на том же месте ведёт обратно к тексту.
    expect(toPreview.when?.(context(), target(README))).toBe(false);
    expect(toCode.when?.(context(), target(README))).toBe(true);
  });

  it('обе половины пары зовут одну команду и несут значок', () => {
    const h = harness();

    for (const id of ['markdown.title.toPreview', 'markdown.title.toCode']) {
      const item = itemOf(h, id);
      expect(item.menu).toBe('editor/title');
      expect(item.command).toBe(TOGGLE_VIEW_COMMAND_ID);
      expect(item.icon).toBeTypeOf('function');
    }
  });

  it('из режима «рядом» кнопка возвращает к тексту: рядом — это тоже рендер', () => {
    const h = harness();
    h.views.set(README.id, 'split');

    expect(itemOf(h, 'markdown.title.toCode').when?.(context(), target(README))).toBe(true);
  });

  it('на markdown, открытом чужим редактором, кнопок нет: они переключали бы вхолостую', () => {
    const h = harness();

    for (const id of ['markdown.title.toPreview', 'markdown.title.split']) {
      expect(itemOf(h, id).when?.(context(), target(README, 'monaco.editor'))).toBe(false);
    }
  });

  it('кнопки видны только над markdown-документом', () => {
    const h = harness();
    const toPreview = itemOf(h, 'markdown.title.toPreview');

    expect(toPreview.when?.(context(), target(README))).toBe(true);
    expect(toPreview.when?.(context(), target(SCHEMA))).toBe(false);
    // Чужая поверхность: пункт внесён в ряд действий, а спросили его в дереве.
    expect(
      toPreview.when?.(context(), { ref: null, dir: 'fs:', selection: [], rootId: 'fs:' })
    ).toBe(false);
  });

  it('«рядом» — вторая кнопка, нажатая в своём режиме', () => {
    const h = harness();
    const split = itemOf(h, 'markdown.title.split');

    expect(split.toggled?.(context(), target(README))).toBe(false);
    h.views.set(README.id, 'split');
    expect(split.toggled?.(context(), target(README))).toBe(true);
  });

  it('кнопки «рядом» нет вовсе, когда рядом показывать нечем', () => {
    const h = harness({ withTextEditor: false });
    const split = itemOf(h, 'markdown.title.split');

    expect(split.when?.(context(), target(README))).toBe(false);
  });

  it('пункт дерева открывает предпросмотр и виден только на markdown-файле', () => {
    const h = harness();
    const item = itemOf(h, 'markdown.context.openPreview');

    expect(item.menu).toBe('resource/context');
    expect(item.command).toBe(OPEN_PREVIEW_COMMAND_ID);
    expect(
      item.when?.(context(), { ref: README, dir: 'fs:', selection: [README], rootId: 'fs:' })
    ).toBe(true);
    expect(
      item.when?.(context(), { ref: SCHEMA, dir: 'fs:', selection: [SCHEMA], rootId: 'fs:' })
    ).toBe(false);
    expect(item.argsOf?.({ ref: README, dir: 'fs:', selection: [README], rootId: 'fs:' })).toEqual({
      ids: [README.id],
    });
  });
});

describe('тумблер вида', () => {
  it('ведёт из кода в предпросмотр и обратно', () => {
    const h = harness();
    const toggle = markdownCommands({ host: h.host, views: h.views }).find(
      (item) => item.id === TOGGLE_VIEW_COMMAND_ID
    );

    toggle?.run();
    expect(h.views.get(README.id)).toBe('preview');
    toggle?.run();
    expect(h.views.get(README.id)).toBe('code');
  });

  it('из режима «рядом» возвращает к коду, а не к предпросмотру', () => {
    const h = harness();
    h.views.set(README.id, 'split');

    markdownCommands({ host: h.host, views: h.views })
      .find((item) => item.id === TOGGLE_VIEW_COMMAND_ID)
      ?.run();

    expect(h.views.get(README.id)).toBe('code');
  });
});
