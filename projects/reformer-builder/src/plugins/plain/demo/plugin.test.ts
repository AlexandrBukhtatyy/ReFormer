import { describe, expect, it, vi } from 'vitest';
import {
  applyPlainOp,
  parsePlainForm,
  printPlainForm,
  sampleForm,
  type PlainForm,
  type PlainOp,
} from '@/plugins/plain/core';
import {
  splitDiagnosticCode,
  type DocumentModelsService,
  type DocumentsService,
  type ModelDocumentHandle,
  type ResourceId,
  type WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import {
  addPlainField,
  componentNameOf,
  createPlainForm,
  exportPlainForm,
  plainCommands,
  type PlainServices,
} from './commands';
import {
  PLAIN_PLUGIN_ID,
  PLAIN_PROVIDER_ID,
  PLAIN_REDO_COMMAND_ID,
  PLAIN_UNDO_COMMAND_ID,
} from './contract';
import { PLAIN_MESSAGES } from './messages';
import { createPlainModelProvider, isPlainResource } from './provider';
import { createPlainValidator, nameRanges } from './validator';

const ref = (name: string, mediaType = 'application/json') => ({
  id: `mem:${name}`,
  sourceId: 'mem',
  path: name,
  name,
  kind: 'file' as const,
  mediaType,
});
const peek = (text: string) => ({ text: () => Promise.resolve(text), peek: () => text });

/** Ручка модели в объёме команд: модель, `apply` через операции стека, провайдер. */
function fakeHandle(initial: PlainForm, name = 'contact.plain.json') {
  let model = initial;
  const undone: PlainForm[] = [];
  const history: PlainForm[] = [];
  const handle = {
    document: {
      providerId: PLAIN_PROVIDER_ID,
      ref: ref(name),
      getModel: () => model,
    },
    apply: (op: PlainOp) => {
      history.push(model);
      model = applyPlainOp(model, op).model;
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
    activeResource: () => (handle === null ? null : 'mem:contact.plain.json'),
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
    exists: (id: ResourceId) => Promise.resolve(id === 'mem:contact.plain.json'),
    canWrite: () => true,
    refresh: () => Promise.resolve(),
  } as unknown as WorkspaceFilesService;
  const models = { handleOf: () => handle } as DocumentModelsService;
  const services: PlainServices = {
    documents: () => documents,
    files: () => files,
    models: () => models,
    save: () => ({ save }),
  };
  return { services, written, opened, save };
}

describe('провайдер модели', () => {
  it('берётся за схему стека по содержимому, а не по расширению', () => {
    const text = printPlainForm(sampleForm());
    expect(isPlainResource(ref('form.json'), peek(text))).toBe(true);
    expect(isPlainResource(ref('form.json'), peek('{"version":"1.0","root":{}}'))).toBe(false);
    expect(isPlainResource(ref('notes.md', 'text/markdown'), peek(text))).toBe(false);
  });

  it('печать разбора — тот же текст', () => {
    const provider = createPlainModelProvider();
    const text = printPlainForm(sampleForm());
    expect(provider.print(provider.parse(text))).toBe(text);
  });
});

describe('валидатор', () => {
  const broken = printPlainForm({
    $schema: 'plain-form/1',
    fields: [
      { name: 'a', label: 'A', type: 'text' },
      { name: 'a', label: 'A2', type: 'text' },
    ],
  });

  it('дубликат имени: код с владельцем и диапазон второго имени', () => {
    const validator = createPlainValidator();
    const found = validator.validate!({
      doc: { ...ref('form.json'), kind: 'model', providerId: PLAIN_PROVIDER_ID } as never,
      text: () => broken,
      model: () => parsePlainForm(broken),
    });

    expect(found).toHaveLength(1);
    expect(splitDiagnosticCode(found[0]!.code)).toEqual({
      pluginId: PLAIN_PLUGIN_ID,
      code: 'duplicate-name',
    });
    const target = found[0]!.target;
    expect(target.kind).toBe('range');
    if (target.kind === 'range') {
      expect(broken.slice(target.range.start, target.range.end)).toBe('"a"');
      expect(target.range.start).toBe(nameRanges(broken)[1]!.start);
    }
  });

  it('текст каждого кода — в словаре плагина, на обеих локалях', () => {
    for (const code of ['empty-name', 'duplicate-name', 'no-options']) {
      expect(PLAIN_MESSAGES.ru![`errors.${code}`]).toBeDefined();
      expect(PLAIN_MESSAGES.en![`errors.${code}`]).toBeDefined();
    }
  });

  it('за чужой документ не берётся', () => {
    expect(createPlainValidator().applies({ providerId: 'form.schema' } as never)).toBe(false);
  });
});

describe('команды', () => {
  it('новая форма ложится под свободным именем и открывается', async () => {
    const { services, written, opened } = fakeServices();
    const id = await createPlainForm(services);

    expect(id).toBe('mem:contact-2.plain.json');
    expect(parsePlainForm(written.get(id!)!)).toEqual(sampleForm());
    expect(opened).toEqual([id]);
  });

  it('новое поле — операцией через ручку модели', () => {
    const fake = fakeHandle(sampleForm());
    const { services } = fakeServices(fake.handle);

    expect(addPlainField(services, 'mem:contact.plain.json')).toBe(true);
    expect(fake.model().fields.at(-1)?.name).toBe('field1');
  });

  it('экспорт пишет Form.tsx рядом и сохраняет его привилегированной службой', async () => {
    const fake = fakeHandle(sampleForm());
    const { services, written, save } = fakeServices(fake.handle);
    const outcome = await exportPlainForm(services, 'mem:contact.plain.json');

    expect(outcome).toEqual({ status: 'written', id: 'mem:Form.tsx', saved: true });
    expect(written.get('mem:Form.tsx')).toContain('export function ContactForm(');
    expect(save).toHaveBeenCalledWith(['mem:Form.tsx']);
  });

  it('чужой документ не экспортируется', async () => {
    const { services } = fakeServices(null);
    expect(await exportPlainForm(services, 'mem:x.json')).toEqual({
      status: 'refused',
      reason: 'no-document',
    });
  });

  it('отмена и повтор идут через историю ручки активного документа', () => {
    const fake = fakeHandle(sampleForm());
    const { services } = fakeServices(fake.handle);
    const commands = new Map(plainCommands(services).map((command) => [command.id, command]));
    const undo = commands.get(PLAIN_UNDO_COMMAND_ID)!;
    const redo = commands.get(PLAIN_REDO_COMMAND_ID)!;

    expect(undo.enabled?.({} as never)).toBe(false);
    addPlainField(services, 'mem:contact.plain.json');
    expect(undo.enabled?.({} as never)).toBe(true);
    expect(undo.run()).toBe(true);
    expect(fake.model().fields.map((field) => field.name)).not.toContain('field1');
    expect(redo.run()).toBe(true);
    expect(fake.model().fields.at(-1)?.name).toBe('field1');
    // Клавиши сужены видом документа стека: `mod+z` схемы ReFormer с ними не спорит.
    expect(undo.when).toBe(`activeResourceKind == ${PLAIN_PROVIDER_ID}`);
  });

  it('имя компонента из имени файла', () => {
    expect(componentNameOf('contact.plain.json')).toBe('ContactForm');
    expect(componentNameOf('sign-up.plain.json')).toBe('SignUpForm');
  });
});
