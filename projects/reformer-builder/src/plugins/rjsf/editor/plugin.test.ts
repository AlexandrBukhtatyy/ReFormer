import { describe, expect, it, vi } from 'vitest';
import {
  applyRjsfOp,
  parseRjsfForm,
  printRjsfForm,
  RJSF_PROVIDER_ID,
  sampleForm,
  type RjsfForm,
  type RjsfOp,
  type RjsfProblemCode,
} from '@/plugins/rjsf/core';
import {
  splitDiagnosticCode,
  type CatalogJson,
  type DocumentModelsService,
  type DocumentsService,
  type KitsService,
  type ModelDocumentHandle,
  type ResourceId,
  type WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import {
  addRjsfField,
  componentNameOf,
  createRjsfForm,
  exportRjsfForm,
  rjsfCommands,
  type RjsfServices,
} from './commands';
import { RJSF_EDITOR_PLUGIN_ID, RJSF_REDO_COMMAND_ID, RJSF_UNDO_COMMAND_ID } from './contract';
import { RJSF_EDITOR_MESSAGES } from './messages';
import { createRjsfModelProvider, isRjsfResource } from './provider';
import { availableWidgets, createRjsfValidator, locateNames } from './validator';

const ref = (name: string, mediaType = 'application/json') => ({
  id: `mem:${name}`,
  sourceId: 'mem',
  path: name,
  name,
  kind: 'file' as const,
  mediaType,
});
const peek = (text: string) => ({ text: () => Promise.resolve(text), peek: () => text });

/** Ручка модели в объёме команд: модель, `apply` через операции домена, история. */
function fakeHandle(initial: RjsfForm, name = 'contact.rjsf.json') {
  let model = initial;
  const undone: RjsfForm[] = [];
  const history: RjsfForm[] = [];
  const handle = {
    document: { providerId: RJSF_PROVIDER_ID, ref: ref(name), getModel: () => model },
    apply: (op: RjsfOp) => {
      history.push(model);
      model = applyRjsfOp(model, op).model;
      undone.length = 0;
      return { status: 'applied' };
    },
    canUndo: () => history.length > 0,
    canRedo: () => undone.length > 0,
    undo: () => {
      const previous = history.pop();
      if (previous === undefined) return false;
      undone.push(model);
      model = previous;
      return true;
    },
    redo: () => {
      const next = undone.pop();
      if (next === undefined) return false;
      history.push(model);
      model = next;
      return true;
    },
  };
  return { handle: handle as unknown as ModelDocumentHandle<unknown>, model: () => model };
}

function fakeServices(handle: ModelDocumentHandle<unknown> | null = null) {
  const written = new Map<ResourceId, string>();
  const opened: ResourceId[] = [];
  const save = vi.fn(() => Promise.resolve(true));
  const documents = {
    activeResource: () => (handle === null ? null : 'mem:contact.rjsf.json'),
    writeText: (id: ResourceId, text: string) => {
      written.set(id, text);
      return Promise.resolve();
    },
    open: (id: ResourceId) => {
      opened.push(id);
      return Promise.resolve();
    },
  } as unknown as DocumentsService;
  const files = {
    projectRoot: () => 'mem:',
    parentOf: () => 'mem:',
    resolve: (dir: string, name: string) => `${dir}${name}`,
    exists: (id: ResourceId) => Promise.resolve(id === 'mem:contact.rjsf.json'),
    canWrite: () => true,
    refresh: () => Promise.resolve(),
  } as unknown as WorkspaceFilesService;
  const models = { handleOf: () => handle } as DocumentModelsService;
  const services: RjsfServices = {
    documents: () => documents,
    files: () => files,
    models: () => models,
    save: () => ({ save }),
  };
  return { services, written, opened, save };
}

/** Служба китов в объёме валидатора: каталог и подписка на смену. */
function fakeKits(components: CatalogJson['components']) {
  const listeners = new Set<() => void>();
  let catalog: CatalogJson = { version: '2.1', components };
  const kits = {
    catalogJson: () => catalog,
    onDidChange: (cb: () => void) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  } as unknown as KitsService;
  return {
    kits,
    load(next: CatalogJson['components']): void {
      catalog = { version: '2.1', components: next };
      for (const cb of listeners) cb();
    },
  };
}

const record = (name: string, role = 'field') =>
  ({ name, role, propsSchema: {} }) as CatalogJson['components'][number];

describe('провайдер модели', () => {
  it('берётся за форму домена по содержимому, а не по расширению', () => {
    const text = printRjsfForm(sampleForm());

    expect(isRjsfResource(ref('form.json'), peek(text))).toBe(true);
    expect(isRjsfResource(ref('form.json'), peek('{"version":"1.0","root":{}}'))).toBe(false);
    expect(isRjsfResource(ref('form.json'), peek('{"$schema":"plain-form/1"}'))).toBe(false);
    expect(isRjsfResource(ref('notes.md', 'text/markdown'), peek(text))).toBe(false);
  });

  it('печать разбора — тот же текст', () => {
    const provider = createRjsfModelProvider();
    const text = printRjsfForm(sampleForm());

    expect(provider.print(provider.parse(text))).toBe(text);
  });
});

describe('валидатор', () => {
  const validate = (form: RjsfForm, kits?: KitsService) => {
    const text = printRjsfForm(form);
    const found = createRjsfValidator(() => kits).validate!({
      doc: { ...ref('form.json'), kind: 'model', providerId: RJSF_PROVIDER_ID } as never,
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
    const fake = fakeKits([]);
    const codes = () =>
      validate(form, fake.kits).found.map((d) => splitDiagnosticCode(d.code).code);

    expect(codes()).toEqual([]);
    fake.load([record('Switch'), record('Box', 'container')]);
    expect(codes()).toEqual(['widget-unknown']);
    // Контейнер кита виджетом не бывает.
    expect(availableWidgets(fake.kits)?.has('Box')).toBe(false);
    // Кита в составе нет — известен только реестр RJSF.
    expect(validate(form).found).toHaveLength(2);
  });

  it('смена кита перепроверяет документы', () => {
    const fake = fakeKits([]);
    const validator = createRjsfValidator(() => fake.kits);
    const changed = vi.fn();
    validator.onDidChangeInputs!(changed);

    fake.load([record('Switch')]);

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
    const { services, written, opened } = fakeServices();
    const id = await createRjsfForm(services);

    expect(id).toBe('mem:contact-2.rjsf.json');
    expect(parseRjsfForm(written.get(id!)!)).toEqual(sampleForm());
    expect(opened).toEqual([id]);
  });

  it('новое поле — операцией через ручку модели, со свободным именем', () => {
    const fake = fakeHandle(sampleForm());
    const { services } = fakeServices(fake.handle);

    expect(addRjsfField(services, 'mem:contact.rjsf.json')).toBe('field1');
    expect(Object.keys(fake.model().schema.properties).at(-1)).toBe('field1');
  });

  it('экспорт пишет Form.tsx рядом и сохраняет его привилегированной службой', async () => {
    const fake = fakeHandle(sampleForm());
    const { services, written, save } = fakeServices(fake.handle);
    const outcome = await exportRjsfForm(services, 'mem:contact.rjsf.json');

    expect(outcome).toEqual({ status: 'written', id: 'mem:Form.tsx', saved: true });
    expect(written.get('mem:Form.tsx')).toContain('export function ContactForm(');
    expect(written.get('mem:Form.tsx')).toContain("from '@rjsf/core'");
    expect(save).toHaveBeenCalledWith(['mem:Form.tsx']);
  });

  it('чужой документ не экспортируется', async () => {
    const { services } = fakeServices(null);

    expect(await exportRjsfForm(services, 'mem:x.json')).toEqual({
      status: 'refused',
      reason: 'no-document',
    });
  });

  it('отмена и повтор идут через историю ручки активного документа', () => {
    const fake = fakeHandle(sampleForm());
    const { services } = fakeServices(fake.handle);
    const commands = new Map(rjsfCommands(services).map((command) => [command.id, command]));
    const undo = commands.get(RJSF_UNDO_COMMAND_ID)!;
    const redo = commands.get(RJSF_REDO_COMMAND_ID)!;

    expect(undo.enabled?.({} as never)).toBe(false);
    addRjsfField(services, 'mem:contact.rjsf.json');
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
