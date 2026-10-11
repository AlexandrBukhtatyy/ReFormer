import { describe, expect, it } from 'vitest';
import { plainSchema } from '../../../core/testing';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { defaultFormName, moduleRootOf, runCodegen, schemaOf } from './run';
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
    expect(state.delivery?.written).toContain('types/credit.ts');
    expect(host.written.has('src/forms/credit/types/credit.ts')).toBe(true);
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

  it('документ в папке schema называет форму каталогом МОДУЛЯ, а не «schema»', () => {
    const nested = 'src/forms/loan/schema/form.schema.json';
    expect(defaultFormName(createFakeDocument(nested, '{}', 'form.schema.json'))).toBe('loan');
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
    expect(host.written.get('src/forms/credit/types/credit.ts')).toContain('fullName: string;');
    // Схема модуля — уже формата 2: привязка в `model`, пометка `format` на месте.
    const schema = JSON.parse(
      host.written.get('src/forms/credit/schema/form.schema.json') ?? ''
    ) as {
      format?: unknown;
      root: { children: unknown[] };
    };
    expect(schema.format).toBe(2);
    expect(schema.root.children[0]).toMatchObject({ model: '$model(fullName)' });
  });
});

describe('куда ложится модуль: три места документа', () => {
  /** Прогон по документу с таким адресом; на «диске» — только он сам. */
  async function runAt(path: string, name: string, files: Record<string, string> = {}) {
    const id = path as ResourceId;
    const text = JSON.stringify(plainSchema());
    const document = createFakeDocument(path, text, name);
    const host = createFakeHost({ document, files: { [path]: text, ...files } });
    const store = createCodegenSessions().storeFor(id);
    await runCodegen({ host, targets: BUILTIN_TARGETS, documentId: id, store });
    return { host, state: store.get() };
  }

  it('документ в <модуль>/schema/ — модуль печатается НА МЕСТЕ, в родителе папки', async () => {
    const { host, state } = await runAt(
      'src/forms/loan/schema/form.schema.json',
      'form.schema.json'
    );

    expect(state.errorKey).toBeNull();
    expect(state.delivery?.dir).toBe('src/forms/loan');
    // Код — по папкам ролей от корня модуля, документ переписан на своём месте.
    expect(host.written.has('src/forms/loan/LoanForm.tsx')).toBe(true);
    expect(host.written.has('src/forms/loan/application/create.ts')).toBe(true);
    expect(host.written.has('src/forms/loan/schema/registry.ts')).toBe(true);
    expect(state.delivery?.written).toContain('schema/form.schema.json');
    // Ни вложенного модуля, ни копии документа рядом.
    expect([...host.written.keys()].some((id) => id.includes('/loan/loan/'))).toBe(false);
    expect([...host.written.keys()].some((id) => id.includes('/schema/schema/'))).toBe(false);
    expect([...host.written.keys()].filter((id) => id.endsWith('form.schema.json'))).toEqual([
      'src/forms/loan/schema/form.schema.json',
    ]);
  });

  it('канонический документ в другом каталоге — модуль в его каталог, схема остаётся в корне', async () => {
    // Форма прежней плоской раскладки: документ не переезжает, код печатается по папкам ролей.
    const { host, state } = await runAt('src/forms/loan/form.schema.json', 'form.schema.json', {
      'src/forms/loan/index.tsx': 'прежняя страница\n',
      'src/forms/loan/form.render.ts': 'мои правила рендера\n',
    });

    expect(state.delivery?.dir).toBe('src/forms/loan');
    expect(state.delivery?.written).toContain('form.schema.json');
    expect(host.written.has('src/forms/loan/schema/form.schema.json')).toBe(false);
    expect(host.written.has('src/forms/loan/schema/registry.ts')).toBe(true);
    // Сборка импортирует документ оттуда, где он лежит.
    expect(host.written.get('src/forms/loan/application/create.ts')).toContain(
      "import rawSchema from '../form.schema.json';"
    );
    // Файлы прежней раскладки названы и не тронуты.
    expect(state.delivery?.flat).toEqual(['index.tsx', 'form.render.ts']);
    expect(host.written.get('src/forms/loan/form.render.ts')).toBe('мои правила рендера\n');
  });

  it('документ со свободным именем — новый модуль в подкаталоге, документ кладётся в schema/', async () => {
    const { host, state } = await runAt('src/forms/credit.schema.json', 'credit.schema.json');

    expect(state.delivery?.dir).toBe('src/forms/credit');
    expect(host.written.has('src/forms/credit/schema/form.schema.json')).toBe(true);
    expect(host.written.has('src/forms/credit/CreditForm.tsx')).toBe(true);
    // Исходный документ остался, где был: модуль заведён рядом, а не поверх него.
    expect(host.written.has('src/forms/credit.schema.json')).toBe(true);
    expect(host.written.has('src/forms/types/credit.ts')).toBe(false);
  });

  it('свободное имя: каталог нового модуля — по имени формы, которое ввёл человек', async () => {
    const path = 'src/forms/credit.schema.json';
    const text = JSON.stringify(plainSchema());
    const host = createFakeHost({
      document: createFakeDocument(path, text, 'credit.schema.json'),
      files: { [path]: text },
    });
    const store = createCodegenSessions().storeFor(path as ResourceId);
    await runCodegen({
      host,
      targets: BUILTIN_TARGETS,
      documentId: path as ResourceId,
      store,
      formName: 'Заявка на кредит',
    });
    expect(store.get().delivery?.dir).toBe('src/forms/zayavka-na-kredit');
  });

  it('moduleRootOf: место документа решает, имя формы — только у свободного имени', () => {
    const host = createFakeHost();
    const root = (path: string, kind: 'nested' | 'flat' | 'detached') =>
      moduleRootOf(host, path as ResourceId, { kind, schemaPath: 'x' }, 'my-form');
    expect(root('a/b/schema/form.schema.json', 'nested')).toBe('a/b');
    expect(root('a/b/form.schema.json', 'flat')).toBe('a/b');
    expect(root('a/b.schema.json', 'detached')).toBe('a/my-form');
  });
});
