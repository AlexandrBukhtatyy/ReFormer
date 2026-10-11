import { describe, expect, it } from 'vitest';
import { plainSchema } from '../../../core/testing';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { defaultFormName, runCodegen, schemaOf } from './run';
import { createCodegenSessions } from './state';
import { BUILTIN_TARGETS } from './targets';
import { createFakeDocument, createFakeHost } from '../testing';

const DOC = 'src/forms/credit.schema.json' as ResourceId;

/**
 * Форма в ПРЕЖНЕМ формате: без `format`, привязка поля — в `value`.
 *
 * Литерал прежнего формата здесь намеренно: это вход проверки перевода, а не недосмотр переноса.
 */
const LEGACY_FORM = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [{ value: '$model(fullName)', component: '$component(Input)' }],
  },
};

/** Она же в формате 2. */
const FORM = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [{ model: '$model(fullName)', component: '$component(Input)' }],
  },
};

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

  it('для канонического имени схемы имя формы — имя ПАПКИ, а не «form»/«renderer»', () => {
    const canon = 'src/forms/loan/form.schema.json';
    const legacy = 'src/forms/loan/renderer.schema.json';
    expect(defaultFormName(createFakeDocument(canon, '{}', 'form.schema.json'))).toBe('loan');
    expect(defaultFormName(createFakeDocument(legacy, '{}', 'renderer.schema.json'))).toBe('loan');
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

  it('текст и модель прежнего формата отдаются переведёнными в формат 2', () => {
    // Посылка: разметка прежнего формата — не та, с которой работает генерация.
    expect(LEGACY_FORM.root).not.toEqual(FORM.root);

    const fromText = createFakeDocument(DOC, JSON.stringify(LEGACY_FORM));
    expect(schemaOf(fromText)).toEqual(FORM);

    const fromModel = { ...createFakeDocument(DOC, 'сломанный текст'), model: () => LEGACY_FORM };
    expect(schemaOf(fromModel)).toEqual(FORM);
  });

  it('по документу прежнего формата печатает модуль с его полями, а не пустой', async () => {
    const document = createFakeDocument(DOC, JSON.stringify(LEGACY_FORM), 'credit.schema.json');
    const { host, store } = setup({ document });
    await runCodegen({ host, targets: BUILTIN_TARGETS, documentId: DOC, store });

    expect(store.get().errorKey).toBeNull();
    expect(host.written.get('src/forms/credit/types.ts')).toContain('fullName: string;');
    // Схема модуля — уже формата 2: привязка в `model`, пометка `format` на месте.
    const schema = JSON.parse(host.written.get('src/forms/credit/form.schema.json') ?? '') as {
      format?: unknown;
      root: { children: unknown[] };
    };
    expect(schema.format).toBe(2);
    expect(schema.root.children[0]).toMatchObject({ model: '$model(fullName)' });
  });
});
