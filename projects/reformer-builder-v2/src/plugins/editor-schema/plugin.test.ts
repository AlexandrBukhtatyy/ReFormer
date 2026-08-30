/**
 * Тесты плагина: состав вкладов, выбор «за какой файл берётся редактор», видимость панелей
 * и применимость команд.
 *
 * Порт платформы здесь подставной — настоящий собирается композицией и требует рабочей
 * области. Проверяется то, чем владеет плагин; платформа в этих ответах не участвует.
 *
 * @module plugins/editor-schema/plugin.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { emptyRules, type FormRules, type ValidationRuleIntent } from '@/lib/form-model/rules';
import type { EditorProbe, PluginContext, WhenContext } from '@/sdk';
import {
  COLLAPSE_SELECTION_COMMAND_ID,
  DELETE_BACK_COMMAND_ID,
  DELETE_COMMAND_ID,
  DUPLICATE_COMMAND_ID,
  DUPLICATE_DIR_COMMAND_IDS,
  FLIP_COMMAND_ID,
  GROUP_COMMAND_ID,
  MOVE_COMMAND_IDS,
  REDO_COMMAND_ID,
  REMOVE_RULE_COMMAND_ID,
  RENAME_PROP_COMMAND_ID,
  schemaEditorCommands,
  SET_COMPONENT_COMMAND_ID,
  UNDO_COMMAND_ID,
  UNGROUP_COMMAND_ID,
  type CommandAccess,
} from './commands';
import { createCanvasPrefs } from './canvas-prefs';
import { createQuickAddStore } from './quick-add-store';
import { createDragSession } from './drag-session';
import type { ExtensionPointRef, SchemaModelProviderSpec } from './host';
import { getAt } from '@/lib/form-model/paths';
import { nodeIdOf } from '@/lib/form-model/node-id';
import type { JsonNode } from '@reformer/renderer-json';
import { indexNodes } from './node-index';
import {
  createSchemaEditorPlugin,
  INSPECTOR_PANEL_ID,
  PALETTE_PANEL_ID,
  panelsVisible,
  SCHEMA_EDITOR_ID,
  SCHEMA_EDITOR_PLUGIN_ID,
  SCHEMA_EDITOR_PRIORITY,
  schemaEditorContribution,
  schemaEditorPanels,
  type SchemaEditorStores,
} from './plugin';
import { SCHEMA_EDITOR_MESSAGES } from './messages';
import { SCHEMA_MODEL_PROVIDER_ID } from './provider';
import { createSessionRegistry } from './sessions';
import { createFakeSchemaHost, fakeRef } from './testing';
import { createCollapseRegistry } from './view-state';

const TEXT = JSON.stringify(sampleSchema());
const DOCUMENT = 'fake:form.json';

const MODEL_POINT: ExtensionPointRef<SchemaModelProviderSpec> = { id: 'document.model' };

function probe(text: string): EditorProbe {
  return { text: () => Promise.resolve(text), peek: () => text } as EditorProbe;
}

function whenContext(patch: Partial<WhenContext> = {}): WhenContext {
  return {
    focus: 'canvas',
    activeEditorId: DOCUMENT,
    activeResourceKind: SCHEMA_MODEL_PROVIDER_ID,
    hasSelection: false,
    previewMode: null,
    ...patch,
  };
}

/**
 * Реестры в объёме, который трогает `activate`.
 *
 * Реестр сервисов отвечает `undefined` на всё: службы диагностик в тесте нет, и это
 * ШТАТНОЕ состояние — плагин обязан активироваться без неё, просто без меток на узлах.
 */
function fakeContext() {
  const contributed: { point: string; id?: string }[] = [];
  const commands: string[] = [];
  const ctx = {
    id: SCHEMA_EDITOR_PLUGIN_ID,
    subscriptions: [],
    services: { get: () => undefined },
    extensions: {
      contribute: (point: { id: string }, _value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id });
        return { dispose: () => undefined };
      },
    },
    commands: {
      register: (command: { id: string }) => {
        commands.push(command.id);
        return { dispose: () => undefined };
      },
      get: () => undefined,
      execute: () => Promise.resolve(true),
    },
  } as unknown as PluginContext;
  return { ctx, contributed, commands };
}

/** Реестр команд, которого в этих тестах нет: кнопок исправлений не будет. */
function noCommands(): CommandAccess {
  return { has: () => false, run: () => undefined };
}

/** Хранилища редактора для теста, который зовёт вклад в одиночку. */
function stores(): SchemaEditorStores {
  return {
    drag: createDragSession(),
    viewStates: createCollapseRegistry(),
    prefs: createCanvasPrefs(),
    quickAdd: createQuickAddStore(),
  };
}

function harness() {
  const host = createFakeSchemaHost({ text: TEXT });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');
  const idAt = (path: readonly (string | number)[]): string => {
    const model = session.get().model;
    if (model === null) throw new Error('модель не разобралась');
    const id = indexNodes(model).idAt(path);
    if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
    return id;
  };
  return { host, registry, session, idAt };
}

describe('activate', () => {
  it('вносит провайдер модели, редактор и две панели', () => {
    const { host, registry } = harness();
    const { ctx, contributed } = fakeContext();
    createSchemaEditorPlugin({ host, modelPoint: MODEL_POINT }).activate(ctx);
    void registry;

    expect(contributed).toEqual([
      // Переключатель: кнопки видны разом, нажата ровно одна — полоса отвечает «как показан
      // документ», а не «куда можно перейти». Два положения из четырёх условны: исходник
      // существует при редакторе кода, живая форма — при поверхности превью.
      { point: 'menu', id: 'schema.title.canvasTree' },
      { point: 'menu', id: 'schema.title.canvasSchematic' },
      { point: 'menu', id: 'schema.title.canvasLive' },
      { point: 'menu', id: 'schema.title.showCode' },
      { point: 'document.model', id: SCHEMA_MODEL_PROVIDER_ID },
      { point: 'editor', id: SCHEMA_EDITOR_ID },
      { point: 'panel', id: PALETTE_PANEL_ID },
      { point: 'panel', id: INSPECTOR_PANEL_ID },
    ]);
  });

  it('регистрирует команды редактора', () => {
    const { host } = harness();
    const { ctx, commands } = fakeContext();
    createSchemaEditorPlugin({ host, modelPoint: MODEL_POINT }).activate(ctx);
    expect(commands).toContain(DELETE_COMMAND_ID);
    expect(commands).toContain(DUPLICATE_COMMAND_ID);
    expect(commands).toContain(UNDO_COMMAND_ID);
  });

  it('везёт словарь сам, если есть куда его положить', () => {
    const { host } = harness();
    const { ctx } = fakeContext();
    const locales: string[] = [];
    createSchemaEditorPlugin({
      host,
      modelPoint: MODEL_POINT,
      i18n: {
        contribute: (locale, messages) => {
          locales.push(locale);
          expect(messages['palette.title']).toBeTruthy();
        },
      },
    }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('всё зарегистрированное складывается в подписки — иначе выключение ничего не снимет', () => {
    const { host } = harness();
    const { ctx } = fakeContext();
    createSchemaEditorPlugin({ host, modelPoint: MODEL_POINT }).activate(ctx);
    // Прибавились: команда переключения вида и снятие хранилища режима; затем переворот
    // направления и снятие предпочтений канваса; затем четыре перемещения и удаление
    // по Backspace; затем переключатель показа — три команды и три кнопки; потом быстрое
    // добавление. Последней пришла живая форма — команда и кнопка.
    expect(ctx.subscriptions).toHaveLength(35);
  });
});

describe('редактор', () => {
  it('берётся за схему формы приоритетом выше текстового', () => {
    const { host, registry } = harness();
    const editor = schemaEditorContribution(host, registry, noCommands());
    expect(editor.canOpen(fakeRef(DOCUMENT), probe(TEXT))).toBe(SCHEMA_EDITOR_PRIORITY);
    expect(SCHEMA_EDITOR_PRIORITY).toBeGreaterThan(1);
  });

  it('не берётся за чужой JSON', () => {
    const { host, registry } = harness();
    const editor = schemaEditorContribution(host, registry, noCommands());
    expect(editor.canOpen(fakeRef('fake:package.json'), probe('{"name":"пакет"}'))).toBe(false);
  });

  it('называет себя для выбора «открыть с помощью», а не показывается идентификатором', () => {
    const { host, registry } = harness();
    const editor = schemaEditorContribution(host, registry, noCommands());
    expect(editor.titleKey).toBe('editor.label');
    // Ключ разрешается словарём ПЛАГИНА, поэтому строка обязана быть в его словаре, а не Host.
    expect(SCHEMA_EDITOR_MESSAGES.ru['editor.label']).toBeTruthy();
    expect(SCHEMA_EDITOR_MESSAGES.en['editor.label']).toBeTruthy();
  });

  it('без записанного снимка отдаёт «нечего восстанавливать»', () => {
    const { host, registry } = harness();
    const editor = schemaEditorContribution(host, registry, noCommands(), null, stores());
    expect(editor.viewState?.capture(DOCUMENT)).toBeNull();
  });

  it('снимает и возвращает свёрнутые ветки — снимок переживает потерю реестра', () => {
    const { host, registry } = harness();
    const viewStates = createCollapseRegistry();
    const editor = schemaEditorContribution(host, registry, noCommands(), null, {
      drag: createDragSession(),
      prefs: createCanvasPrefs(),
      quickAdd: createQuickAddStore(),
      viewStates,
    });

    viewStates.record(DOCUMENT, new Set(['abcd1234', 'zzzz0000']));
    const snapshot = editor.viewState?.capture(DOCUMENT);
    // Так выглядит закрытая и заново открытая вкладка: реестр редактора о ней уже забыл,
    // а снимок хранит оболочка.
    viewStates.forget(DOCUMENT);
    editor.viewState?.restore(DOCUMENT, snapshot);

    expect(viewStates.peek(DOCUMENT)).toEqual(['abcd1234', 'zzzz0000']);
  });

  it('чужое значение из хранилища не восстанавливается и ничего не портит', () => {
    const { host, registry } = harness();
    const viewStates = createCollapseRegistry();
    const editor = schemaEditorContribution(host, registry, noCommands(), null, {
      drag: createDragSession(),
      prefs: createCanvasPrefs(),
      quickAdd: createQuickAddStore(),
      viewStates,
    });
    editor.viewState?.restore(DOCUMENT, { scrollTop: 40 });
    expect(viewStates.peek(DOCUMENT)).toBeNull();
  });
});

describe('панели', () => {
  it('палитра слева, инспектор справа', () => {
    const { host, registry } = harness();
    const panels = schemaEditorPanels(host, registry);
    expect(panels.map((p) => [p.id, p.slot])).toEqual([
      [PALETTE_PANEL_ID, 'panel.left'],
      [INSPECTOR_PANEL_ID, 'panel.right'],
    ]);
  });

  it('видимы на схеме формы и не видимы на чужом виде ресурса', () => {
    expect(panelsVisible(whenContext())).toBe(true);
    expect(panelsVisible(whenContext({ activeResourceKind: 'text/markdown' }))).toBe(false);
    expect(panelsVisible(whenContext({ activeResourceKind: null }))).toBe(false);
  });

  it('не видимы на чужом JSON: вид ресурса — идентификатор провайдера, а не медиатип', () => {
    // Второй ответ, `application/json`, стоял здесь, пока композиция не собирала модельных
    // документов и схема формы была неотличима от `package.json`. Теперь собирает.
    expect(panelsVisible(whenContext({ activeResourceKind: 'application/json' }))).toBe(false);
  });
});

describe('команды', () => {
  it('сочетания клавиш перенесены из первой версии и не спорят между собой', () => {
    const { host, registry } = harness();
    const list = schemaEditorCommands(registry, host);
    const byId = new Map(list.map((c) => [c.id, c.keybinding]));

    // Набор, к которому человек привык в v1. Промах здесь означает не «нет команды»,
    // а «команда есть, но клавиша молчит» — а это неотличимо от поломки.
    expect(byId.get(DELETE_COMMAND_ID)).toBe('delete');
    expect(byId.get(DELETE_BACK_COMMAND_ID)).toBe('backspace');
    expect(byId.get(DUPLICATE_COMMAND_ID)).toBe('mod+d');
    expect(byId.get(GROUP_COMMAND_ID)).toBe('mod+g');
    expect(byId.get(UNGROUP_COMMAND_ID)).toBe('mod+shift+g');
    expect(byId.get(FLIP_COMMAND_ID)).toBe('mod+shift+l');
    expect(byId.get(MOVE_COMMAND_IDS.up)).toBe('mod+arrowup');
    expect(byId.get(MOVE_COMMAND_IDS.down)).toBe('mod+arrowdown');
    expect(byId.get(MOVE_COMMAND_IDS.left)).toBe('mod+arrowleft');
    expect(byId.get(MOVE_COMMAND_IDS.right)).toBe('mod+arrowright');
    expect(byId.get(DUPLICATE_DIR_COMMAND_IDS.up)).toBe('alt+shift+arrowup');
    expect(byId.get(DUPLICATE_DIR_COMMAND_IDS.down)).toBe('alt+shift+arrowdown');
    expect(byId.get(DUPLICATE_DIR_COMMAND_IDS.left)).toBe('alt+shift+arrowleft');
    expect(byId.get(DUPLICATE_DIR_COMMAND_IDS.right)).toBe('alt+shift+arrowright');
    expect(byId.get(COLLAPSE_SELECTION_COMMAND_ID)).toBe('escape');

    // Два сочетания на одно нажатие означали бы, что победитель зависит от порядка
    // регистрации, — а он ничего не значит.
    const bound = list.map((c) => c.keybinding).filter((key) => key !== undefined);
    expect(new Set(bound).size).toBe(bound.length);
  });

  it('перемещают узел и оставляют курсор на нём', () => {
    const { host, registry, session, idAt } = harness();
    const first = idAt(['root', 'componentProps', 'steps', 0, 'children', 0]);
    session.setSelection([first]);

    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    const down = commands.get(MOVE_COMMAND_IDS.down);
    expect(down?.enabled?.(whenContext())).toBe(true);
    expect(down?.run()).toBe(true);

    const moved = getAt(session.get().model, [
      'root',
      'componentProps',
      'steps',
      0,
      'children',
      1,
    ]) as JsonNode;
    expect(nodeIdOf(moved)).toBe(first);
    // Курсор остался на том, что двигали: реордер выражен переносом соседа, и без явного
    // возврата выделение уехало бы на него.
    expect(session.get().selection).toEqual([first]);
  });

  it('перемещение у края слота отвечает отказом, а не пустой правкой', () => {
    const { host, registry, session, idAt } = harness();
    session.setSelection([idAt(['root', 'componentProps', 'steps', 0, 'children', 0])]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    const before = session.get().model;

    expect(commands.get(MOVE_COMMAND_IDS.up)?.run()).toBe(false);
    expect(session.get().model).toBe(before);
  });

  it('недоступны без выделения', () => {
    const { host, registry } = harness();
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    expect(commands.get(DELETE_COMMAND_ID)?.enabled?.(whenContext())).toBe(false);
    expect(commands.get(DUPLICATE_COMMAND_ID)?.enabled?.(whenContext())).toBe(false);
  });

  it('не дают удалить корень: схема без корня — не схема', () => {
    const { host, registry, session, idAt } = harness();
    session.setSelection([idAt(['root'])]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    expect(commands.get(DELETE_COMMAND_ID)?.enabled?.(whenContext())).toBe(false);
  });

  it('удаляют выделенное и переносят выделение на родителя', () => {
    const { host, registry, session, idAt } = harness();
    const field = idAt(['root', 'componentProps', 'steps', 0, 'children', 0]);
    const step = idAt(['root', 'componentProps', 'steps', 0]);
    session.setSelection([field]);

    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    expect(commands.get(DELETE_COMMAND_ID)?.enabled?.(whenContext())).toBe(true);
    expect(commands.get(DELETE_COMMAND_ID)?.run()).toBe(true);
    expect(session.get().selection).toEqual([step]);
  });

  it('дублируют и умеют отменить сделанное', () => {
    const { host, registry, session, idAt } = harness();
    const field = idAt(['root', 'componentProps', 'steps', 0, 'children', 0]);
    session.setSelection([field]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));

    expect(commands.get(DUPLICATE_COMMAND_ID)?.run()).toBe(true);
    expect(commands.get(UNDO_COMMAND_ID)?.enabled?.(whenContext())).toBe(true);
    expect(commands.get(UNDO_COMMAND_ID)?.run()).toBe(true);
    expect(commands.get(REDO_COMMAND_ID)?.enabled?.(whenContext())).toBe(true);
  });

  it('разгруппировка требует ровно одного узла', () => {
    const { host, registry, session, idAt } = harness();
    const first = idAt(['root', 'componentProps', 'steps', 0, 'children', 0]);
    const second = idAt(['root', 'componentProps', 'steps', 0, 'children', 1]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));

    session.setSelection([first, second]);
    expect(commands.get(UNGROUP_COMMAND_ID)?.enabled?.(whenContext())).toBe(false);
    session.setSelection([first]);
    expect(commands.get(UNGROUP_COMMAND_ID)?.enabled?.(whenContext())).toBe(true);
  });

  it('молчат в расхождении: правка затёрла бы незаконченный текст', () => {
    const { host, registry, session, idAt } = harness();
    session.setSelection([idAt(['root', 'componentProps', 'steps', 0, 'children', 0])]);
    host.setText('{ сломано');

    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    expect(commands.get(DELETE_COMMAND_ID)?.enabled?.(whenContext())).toBe(false);
    expect(commands.get(DELETE_COMMAND_ID)?.run()).toBe(false);
  });
});

/**
 * Быстрые исправления: команды, которых полгода не было ни у кого.
 *
 * Проверяется в первую очередь то, из-за чего механика не работала: команда существует,
 * зовётся ПО АДРЕСУ документа (а не по активному сеансу — из панели проблем чинят находку
 * неактивной вкладки) и правит именно то, что назвали аргументы.
 */
describe('быстрые исправления', () => {
  /** Сайдкар правил в памяти — то, чего композиция пока не даёт (см. отчёт). */
  function rulesPort(initial: FormRules) {
    const byResource = new Map<string, FormRules>([[DOCUMENT, initial]]);
    return {
      port: {
        get: (id: string) => byResource.get(id) ?? null,
        set: (id: string, rules: FormRules) => {
          byResource.set(id, rules);
        },
      },
      read: () => byResource.get(DOCUMENT),
    };
  }

  function rule(target: string): ValidationRuleIntent {
    return { target, rules: ['required'] };
  }

  it('регистрирует команды, которые называет валидатор', () => {
    const { host } = harness();
    const { ctx, commands } = fakeContext();
    createSchemaEditorPlugin({ host, modelPoint: MODEL_POINT }).activate(ctx);
    expect(commands).toContain(SET_COMPONENT_COMMAND_ID);
    expect(commands).toContain(RENAME_PROP_COMMAND_ID);
  });

  it('не регистрирует снятие правила, пока сайдкара правил нет: чинить нечем', () => {
    const { host } = harness();
    const { ctx, commands } = fakeContext();
    createSchemaEditorPlugin({ host, modelPoint: MODEL_POINT }).activate(ctx);
    expect(commands).not.toContain(REMOVE_RULE_COMMAND_ID);
  });

  it('регистрирует снятие правила, когда сайдкар дан', () => {
    const { host } = harness();
    const { ctx, commands } = fakeContext();
    const rules = rulesPort(emptyRules());
    createSchemaEditorPlugin({
      host: { ...host, rules: rules.port },
      modelPoint: MODEL_POINT,
    }).activate(ctx);
    expect(commands).toContain(REMOVE_RULE_COMMAND_ID);
  });

  it('заменяет компонент узла по адресу документа, а не активного сеанса', () => {
    // Сеанса нет вовсе: файл могли открыть текстовым редактором, а находку чинят из панели
    // проблем. Ручка документа при этом есть — и её достаточно.
    const { host, registry, idAt } = harness();
    const field = idAt(['root', 'componentProps', 'steps', 0, 'children', 1]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));

    const done = commands.get(SET_COMPONENT_COMMAND_ID)?.run({
      resource: DOCUMENT,
      nodeId: field,
      name: 'Textarea',
    });

    expect(done).toBe(true);
    expect(host.written.at(-1)).toContain('$component(Textarea)');
  });

  it('переименовывает свойство узла', () => {
    const { host, registry, idAt } = harness();
    const field = idAt(['root', 'componentProps', 'steps', 0, 'children', 1]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));

    const done = commands.get(RENAME_PROP_COMMAND_ID)?.run({
      resource: DOCUMENT,
      nodeId: field,
      from: 'label',
      to: 'caption',
    });

    expect(done).toBe(true);
    expect(host.written.at(-1)).toContain('"caption"');
  });

  it('чужие аргументы — отказ, а не правка наугад', () => {
    const { host, registry, idAt } = harness();
    const field = idAt(['root', 'componentProps', 'steps', 0, 'children', 1]);
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    const setComponent = commands.get(SET_COMPONENT_COMMAND_ID);

    expect(setComponent?.run(undefined)).toBe(false);
    expect(setComponent?.run({ resource: DOCUMENT, nodeId: field })).toBe(false);
    expect(setComponent?.run({ resource: 'fake:другой.json', nodeId: field, name: 'Input' })).toBe(
      false
    );
    expect(host.written).toEqual([]);
  });

  it('снимает названное правило, а не соседнее', () => {
    const { host, registry } = harness();
    const rules = rulesPort({ validation: [rule('a'), rule('b')], behavior: [], render: [] });
    const commands = new Map(
      schemaEditorCommands(registry, { ...host, rules: rules.port }).map((c) => [c.id, c])
    );

    const done = commands.get(REMOVE_RULE_COMMAND_ID)?.run({
      resource: DOCUMENT,
      list: 'validation',
      index: 0,
    });

    expect(done).toBe(true);
    expect(rules.read()?.validation.map((item) => item.target)).toEqual(['b']);
  });

  it('индекс за пределами списка — отказ: правило могли убрать до нажатия', () => {
    const { host, registry } = harness();
    const rules = rulesPort({ validation: [rule('a')], behavior: [], render: [] });
    const commands = new Map(
      schemaEditorCommands(registry, { ...host, rules: rules.port }).map((c) => [c.id, c])
    );
    const remove = commands.get(REMOVE_RULE_COMMAND_ID);

    expect(remove?.run({ resource: DOCUMENT, list: 'validation', index: 1 })).toBe(false);
    expect(remove?.run({ resource: DOCUMENT, list: 'выдумка', index: 0 })).toBe(false);
    expect(rules.read()?.validation).toHaveLength(1);
  });

  it('применимы, когда открыт хоть один документ: аргументы предикат не видит', () => {
    const { host, registry } = harness();
    const commands = new Map(schemaEditorCommands(registry, host).map((c) => [c.id, c]));
    const setComponent = commands.get(SET_COMPONENT_COMMAND_ID);
    expect(setComponent?.enabled?.(whenContext())).toBe(true);
    expect(setComponent?.enabled?.(whenContext({ activeEditorId: null }))).toBe(false);
  });
});
