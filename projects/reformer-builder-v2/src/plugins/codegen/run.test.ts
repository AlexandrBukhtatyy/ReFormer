import { describe, expect, it } from 'vitest';
import { plainSchema } from '@/lib/codegen/__fixtures__/kit';
import type { ResourceId } from '@/sdk';
import { defaultFormName, runCodegen, schemaOf } from './run';
import { createCodegenSessions } from './state';
import { BUILTIN_TARGETS } from './targets';
import { createFakeDocument, createFakeHost } from './testing';

const DOC = 'src/forms/credit.schema.json' as ResourceId;

function setup(options: Parameters<typeof createFakeHost>[0] = {}) {
  const document = createFakeDocument(DOC, JSON.stringify(plainSchema()), 'credit.schema.json');
  const host = createFakeHost({ document, ...options });
  const sessions = createCodegenSessions();
  return { host, store: sessions.storeFor(DOC) };
}

describe('прогон генерации', () => {
  it('печатает и записывает модуль рядом с документом', async () => {
    const { host, store } = setup({ withSave: true });
    await runCodegen({ host, targets: BUILTIN_TARGETS, documentId: DOC, store });

    const state = store.get();
    expect(state.errorKey).toBeNull();
    expect(state.delivery?.written).toContain('types.ts');
    expect(host.written.has('src/forms/credit/types.ts')).toBe(true);
  });

  it('имя формы по умолчанию — имя файла до ПЕРВОЙ точки, а не до последней', () => {
    // `credit.schema` дал бы каталог `creditschema/` и тип `CreditschemaForm`: точку `kebab`
    // выкидывает, а не заменяет разделителем.
    expect(defaultFormName(createFakeDocument(DOC, '{}', 'credit.schema.json'))).toBe('credit');
  });

  it('без кита отказывает НАЗВАННО и ничего не пишет', async () => {
    const { host, store } = setup({ kit: null });
    await runCodegen({ host, targets: BUILTIN_TARGETS, documentId: DOC, store });
    expect(store.get().errorKey).toBe('error.no-kit');
    expect(host.written.size).toBe(0);
  });

  it('документ, который не разбирается в схему, отказывает названно', async () => {
    const document = createFakeDocument(DOC, 'не json');
    const { host, store } = setup({ document });
    await runCodegen({ host, targets: BUILTIN_TARGETS, documentId: DOC, store });
    expect(store.get().errorKey).toBe('error.not-a-schema');
  });

  it('источник без записи отказывает названно, а не исключением', async () => {
    const { host, store } = setup({ write: false });
    await runCodegen({ host, targets: BUILTIN_TARGETS, documentId: DOC, store });
    expect(store.get().errorKey).toBe('error.read-only');
  });

  it('сниппет регистрации собран из имени формы', async () => {
    const { host, store } = setup();
    await runCodegen({
      host,
      targets: BUILTIN_TARGETS,
      documentId: DOC,
      store,
      formName: 'Профиль пользователя',
    });
    expect(store.get().snippet).toContain('profilPolzovatelyaFormEntry');
  });

  it('модель документа предпочтительнее текста буфера', () => {
    const schema = plainSchema();
    const document = {
      ...createFakeDocument(DOC, 'сломанный текст'),
      model: () => schema,
    };
    expect(schemaOf(document)).toBe(schema);
  });
});
