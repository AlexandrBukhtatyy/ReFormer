import { describe, expect, it, vi } from 'vitest';
import {
  parseRjsfForm,
  printRjsfForm,
  RJSF_PROVIDER_ID,
  sampleForm,
  type RjsfForm,
  type RjsfProblemCode,
} from '../../core';
import {
  RESOURCE_GENERATE_MENU,
  splitDiagnosticCode,
  type KitsService,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import {
  addRjsfField,
  componentNameOf,
  createRjsfForm,
  exportRjsfForm,
  rjsfCommands,
} from './commands';
import { RJSF_GENERATE_SUBMENU, rjsfGenerateMenuItems } from './context-menu';
import {
  RJSF_EDITOR_PLUGIN_ID,
  RJSF_INSPECTOR_PANEL_ID,
  RJSF_NEW_COMMAND_ID,
  RJSF_REDO_COMMAND_ID,
  RJSF_UNDO_COMMAND_ID,
} from './contract';
import { RJSF_EDITOR_MESSAGES } from './messages';
import { rjsfInspectorPanel, rjsfPanelVisible } from './plugin';
import { createRjsfModelProvider, isRjsfResource } from './provider';
import {
  createFakeKits,
  createFakeRjsfHandle,
  createFakeRjsfWorkspace,
  fakeKitRecord,
  fakeProbe,
  fakeRef,
} from './testing';
import { availableWidgets, createRjsfValidator, locateNames } from './validator';
import { createRjsfViewStore, rjsfViewCommands, rjsfViewMenuItems } from './view';

const DOCUMENT = 'mem:contact.rjsf.json';

function context(activeResourceKind: string | null): WhenContext {
  return {
    focus: 'none',
    activeEditorId: DOCUMENT,
    activeResourceKind,
    hasSelection: false,
    previewMode: null,
  };
}

describe('провайдер модели', () => {
  it('берётся за форму домена по содержимому, а не по расширению', () => {
    const text = printRjsfForm(sampleForm());

    expect(isRjsfResource(fakeRef('form.json'), fakeProbe(text))).toBe(true);
    expect(isRjsfResource(fakeRef('form.json'), fakeProbe('{"version":"1.0","root":{}}'))).toBe(
      false
    );
    expect(isRjsfResource(fakeRef('form.json'), fakeProbe('{"$schema":"plain-form/1"}'))).toBe(
      false
    );
    expect(isRjsfResource(fakeRef('notes.md', 'text/markdown'), fakeProbe(text))).toBe(false);
  });

  it('печать разбора — тот же текст', () => {
    const provider = createRjsfModelProvider();
    const text = printRjsfForm(sampleForm());

    expect(provider.print(provider.parse(text))).toBe(text);
  });

  it('операция называет, куда переехало выделение: платформа берёт это из результата', () => {
    const provider = createRjsfModelProvider();
    const added = provider.apply(sampleForm(), {
      type: 'add-field',
      params: { name: 'email', field: { type: 'string' } },
    });

    expect(added.focus).toBe('email');
  });
});

describe('валидатор', () => {
  const validate = (form: RjsfForm, kits?: KitsService) => {
    const text = printRjsfForm(form);
    const found = createRjsfValidator(() => kits).validate!({
      doc: { ...fakeRef('form.json'), kind: 'model', providerId: RJSF_PROVIDER_ID } as never,
      text: () => text,
      model: () => parseRjsfForm(text),
    });
    return { text, found };
  };

  it('неполный ui:order: код с владельцем и диапазон ключа поля в properties', () => {
    // Поле зовётся как ключ JSON Schema: поиск по тексту нашёл бы `"title"` у соседнего поля.
    const form: RjsfForm = {
      ...sampleForm(),
      schema: {
        ...sampleForm().schema,
        properties: { ...sampleForm().schema.properties, title: { type: 'string' } },
      },
      uiSchema: { 'ui:order': ['name', 'age', 'channel', 'agree'] },
    };
    const { text, found } = validate(form);

    expect(found).toHaveLength(1);
    expect(splitDiagnosticCode(found[0]!.code)).toEqual({
      pluginId: RJSF_EDITOR_PLUGIN_ID,
      code: 'order-missing',
    });
    const target = found[0]!.target;
    expect(target.kind).toBe('range');
    if (target.kind === 'range') {
      expect(text.slice(target.range.start, target.range.end)).toBe('"title"');
      expect(text.slice(target.range.end).trimStart().startsWith(':')).toBe(true);
      // Это ключ поля (значение — схема), а не подпись поля `name` выше (значение — строка).
      expect(text.slice(target.range.end).trimStart().slice(1).trimStart()).toMatch(/^\{/);
    }
  });

  it('чужие имена в required и ui:order — подчёркнуты там, где написаны', () => {
    const form: RjsfForm = {
      ...sampleForm(),
      schema: { ...sampleForm().schema, required: ['name', 'ghost'] },
      uiSchema: { 'ui:order': ['phantom', '*'] },
    };
    const { text, found } = validate(form);
    const at = (code: string) => {
      const diagnostic = found.find((d) => splitDiagnosticCode(d.code).code === code)!;
      return diagnostic.target.kind === 'range'
        ? text.slice(diagnostic.target.range.start, diagnostic.target.range.end)
        : null;
    };

    expect(at('required-unknown')).toBe('"ghost"');
    expect(at('order-unknown')).toBe('"phantom"');
  });

  it('виджет кита известен, чужой — находка; пока каталог едет, виджеты не проверяются', () => {
    const form: RjsfForm = {
      ...sampleForm(),
      uiSchema: { agree: { 'ui:widget': 'Switch' }, age: { 'ui:widget': 'Knob' } },
    };
    const fake = createFakeKits([]);
    const codes = () =>
      validate(form, fake.kits).found.map((d) => splitDiagnosticCode(d.code).code);

    expect(codes()).toEqual([]);
    fake.load([fakeKitRecord('Switch'), fakeKitRecord('Box', 'container')]);
    expect(codes()).toEqual(['widget-unknown']);
    // Контейнер кита виджетом не бывает.
    expect(availableWidgets(fake.kits)?.has('Box')).toBe(false);
    // Кита в составе нет — известен только реестр RJSF.
    expect(validate(form).found).toHaveLength(2);
  });

  it('смена кита перепроверяет документы', () => {
    const fake = createFakeKits([]);
    const validator = createRjsfValidator(() => fake.kits);
    const changed = vi.fn();
    validator.onDidChangeInputs!(changed);

    fake.load([fakeKitRecord('Switch')]);

    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('текст каждого кода ядра — в словаре плагина, на обеих локалях', () => {
    const codes: RjsfProblemCode[] = [
      'empty-name',
      'required-unknown',
      'order-unknown',
      'order-missing',
      'enum-empty',
      'widget-unknown',
    ];
    for (const code of codes) {
      expect(RJSF_EDITOR_MESSAGES.ru![`errors.${code}`]).toBeDefined();
      expect(RJSF_EDITOR_MESSAGES.en![`errors.${code}`]).toBeDefined();
    }
  });

  it('за чужой документ не берётся', () => {
    expect(
      createRjsfValidator(() => undefined).applies({ providerId: 'form.schema' } as never)
    ).toBe(false);
  });
});

describe('пути имён в тексте', () => {
  it('ключ и элемент массива находятся по пути, а не первым вхождением', () => {
    const text = '{"a":{"b":"x","x":1},"list":["y","x"],"x":2}';
    const names = locateNames(text);
    const slice = (path: string) => {
      const range = names.get(path);
      return range === undefined ? null : [range.start, text.slice(range.start, range.end)];
    };

    expect(slice('x')).toEqual([text.lastIndexOf('"x"'), '"x"']);
    expect(slice('a\u0000x')).toEqual([text.indexOf('"x":1'), '"x"']);
    expect(slice('list=x')).toEqual([text.indexOf('"x"]'), '"x"']);
  });
});

describe('команды', () => {
  it('новая форма ложится под свободным именем и открывается', async () => {
    const { services, written, opened } = createFakeRjsfWorkspace();
    const id = await createRjsfForm(services);

    expect(id).toBe('mem:contact-2.rjsf.json');
    expect(parseRjsfForm(written.get(id!)!)).toEqual(sampleForm());
    expect(opened).toEqual([id]);
  });

  it('каталог называет тот, кто зовёт: форма ложится в него, а не рядом с активной вкладкой', async () => {
    const fake = createFakeRjsfHandle(sampleForm());
    const { services, written, opened } = createFakeRjsfWorkspace({ handles: [fake.handle] });
    const id = await createRjsfForm(services, 'mem:forms/');

    expect(id).toBe('mem:forms/contact.rjsf.json');
    expect(parseRjsfForm(written.get(id!)!)).toEqual(sampleForm());
    expect(opened).toEqual([id]);
  });

  it('команда берёт каталог из аргументов пункта меню, а чужому значению не верит', async () => {
    const { services, opened } = createFakeRjsfWorkspace();
    const create = rjsfCommands(services).find((command) => command.id === RJSF_NEW_COMMAND_ID)!;

    await create.run({ dir: 'mem:forms/' });
    // Не строка — не адрес: команда ведёт себя как из палитры и кладёт форму в корень.
    await create.run({ dir: 42 });

    expect(opened).toEqual(['mem:forms/contact.rjsf.json', 'mem:contact-2.rjsf.json']);
  });

  it('новое поле — операцией через ручку модели, со свободным именем', () => {
    const fake = createFakeRjsfHandle(sampleForm());
    const { services } = createFakeRjsfWorkspace({ handles: [fake.handle] });

    expect(addRjsfField(services, DOCUMENT)).toBe('field1');
    expect(Object.keys(fake.model().schema.properties).at(-1)).toBe('field1');
  });

  it('новое поле становится выбранным, а отмена возвращает прежний выбор', () => {
    const fake = createFakeRjsfHandle(sampleForm());
    const { services } = createFakeRjsfWorkspace({ handles: [fake.handle] });
    fake.handle.setSelection(['age']);

    addRjsfField(services, DOCUMENT);
    // Выделение переносит сама операция (`focus`): панель свойств сразу показывает новое поле.
    expect(fake.selection()).toEqual(['field1']);

    fake.handle.undo();
    expect(fake.selection()).toEqual(['age']);
  });

  it('экспорт пишет Form.tsx рядом и сохраняет его привилегированной службой', async () => {
    const fake = createFakeRjsfHandle(sampleForm());
    const { services, written, saved } = createFakeRjsfWorkspace({ handles: [fake.handle] });
    const outcome = await exportRjsfForm(services, DOCUMENT);

    expect(outcome).toEqual({ status: 'written', id: 'mem:Form.tsx', saved: true });
    expect(written.get('mem:Form.tsx')).toContain('export function ContactForm(');
    expect(written.get('mem:Form.tsx')).toContain("from '@rjsf/core'");
    expect(saved).toEqual([['mem:Form.tsx']]);
  });

  it('чужой документ не экспортируется', async () => {
    const { services } = createFakeRjsfWorkspace();

    expect(await exportRjsfForm(services, 'mem:x.json')).toEqual({
      status: 'refused',
      reason: 'no-document',
    });
  });

  it('отмена и повтор идут через историю ручки активного документа', () => {
    const fake = createFakeRjsfHandle(sampleForm());
    const { services } = createFakeRjsfWorkspace({ handles: [fake.handle] });
    const commands = new Map(rjsfCommands(services).map((command) => [command.id, command]));
    const undo = commands.get(RJSF_UNDO_COMMAND_ID)!;
    const redo = commands.get(RJSF_REDO_COMMAND_ID)!;

    expect(undo.enabled?.({} as never)).toBe(false);
    addRjsfField(services, DOCUMENT);
    expect(undo.run()).toBe(true);
    expect(fake.model().schema.properties.field1).toBeUndefined();
    expect(redo.run()).toBe(true);
    expect(fake.model().schema.properties.field1).toBeDefined();
    // Клавиши сужены видом документа домена: `mod+z` схемы ReFormer с ними не спорит.
    expect(undo.when).toBe(`activeResourceKind == ${RJSF_PROVIDER_ID}`);
  });

  it('имя компонента из имени файла', () => {
    expect(componentNameOf('contact.rjsf.json')).toBe('ContactForm');
    expect(componentNameOf('sign-up.rjsf.json')).toBe('SignUpForm');
  });
});

describe('подраздел «RJSF» подменю «Сгенерировать»', () => {
  const [header, create, ...rest] = rjsfGenerateMenuItems().map((item) => item.value);

  it('заголовок встаёт в общее подменю дерева, а новая форма — в подраздел, не в «Файл»', () => {
    expect(rest).toEqual([]);
    expect(header).toMatchObject({
      kind: 'submenu',
      menu: RESOURCE_GENERATE_MENU,
      submenu: RJSF_GENERATE_SUBMENU,
      titleKey: 'menu.generate.rjsf',
    });
    expect(create).toMatchObject({
      kind: 'item',
      menu: RJSF_GENERATE_SUBMENU,
      command: RJSF_NEW_COMMAND_ID,
    });
    // Адрес подраздела лежит ПОД общим: иначе пункт стека встал бы рядом с подразделами.
    expect(RJSF_GENERATE_SUBMENU.startsWith(`${RESOURCE_GENERATE_MENU}/`)).toBe(true);
  });

  it('пункт называет каталог щелчка — у файла это каталог рядом с ним', () => {
    const target = {
      ref: fakeRef('forms/a.rjsf.json'),
      dir: 'mem:forms/',
      selection: [],
      rootId: 'mem:',
    };

    expect(create?.kind === 'item' ? create.argsOf?.(target) : null).toEqual({ dir: 'mem:forms/' });
  });

  it('на файле не гаснет: форму можно положить рядом с любой строкой дерева', () => {
    expect(header?.kind === 'submenu' ? header.enabledWhen : null).toBeUndefined();
    expect(create?.kind === 'item' ? create.enabledWhen : null).toBeUndefined();
  });
});

describe('панель свойств поля', () => {
  const { services } = createFakeRjsfWorkspace();
  const panel = rjsfInspectorPanel({
    services,
    kits: () => undefined,
    useTranslate: () => (k) => k,
  });

  it('стоит в правом доке под своим именем', () => {
    expect(panel.id).toBe(RJSF_INSPECTOR_PANEL_ID);
    expect(panel.slot).toBe('panel.right');
    // Значок обязателен: без него рейл рисует первую букву заголовка.
    expect(panel.icon).toBeDefined();
    expect(panel.when).toBe(rjsfPanelVisible);
  });

  it('видна только на форме домена: на чужом JSON и на markdown её нет', () => {
    expect(rjsfPanelVisible(context(RJSF_PROVIDER_ID))).toBe(true);
    expect(rjsfPanelVisible(context('form.schema'))).toBe(false);
    expect(rjsfPanelVisible(context('application/json'))).toBe(false);
    expect(rjsfPanelVisible(context(null))).toBe(false);
  });
});

describe('словарь: подписи команд, кнопок и панели', () => {
  it('каждый ключ заголовка есть на обеих локалях', () => {
    // Проверка состава поднимает только профиль ReFormer, и забытый ключ домена RJSF доехал бы
    // до человека маркером промаха при зелёном прогоне.
    const { services } = createFakeRjsfWorkspace();
    const view = createRjsfViewStore({ hasLive: () => true });
    const deps = { view, hasLive: () => true, activeIsRjsf: () => true };
    const keys = [
      ...rjsfCommands(services).map((command) => command.titleKey),
      ...rjsfViewCommands(deps).map((command) => command.titleKey),
      ...rjsfViewMenuItems(deps).map((item) =>
        item.value.kind === 'item' ? item.value.titleKey : undefined
      ),
      ...rjsfGenerateMenuItems().map((item) =>
        item.value.kind === 'item' || item.value.kind === 'submenu'
          ? item.value.titleKey
          : undefined
      ),
      rjsfInspectorPanel({ services, kits: () => undefined, useTranslate: () => (k) => k })
        .titleKey,
    ];

    expect(keys.every((key) => typeof key === 'string')).toBe(true);
    for (const key of keys) {
      expect(RJSF_EDITOR_MESSAGES.ru![key!], `ru: ${key}`).toBeDefined();
      expect(RJSF_EDITOR_MESSAGES.en![key!], `en: ${key}`).toBeDefined();
    }
  });
});
