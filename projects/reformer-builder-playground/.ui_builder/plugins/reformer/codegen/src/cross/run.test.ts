/**
 * Прогон панели через настоящий стек ReFormer: что печатается, куда ложится, чем отказывает.
 *
 * @module plugins/reformer/codegen/cross/run.test
 */

import { describe, expect, it } from 'vitest';
import { plainSchema } from '../../../core/testing';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { printRulesText } from '../../../core/codegen/rules-file';
import type { KitView } from '../../../core/codegen';
import { runCodegen } from '../pipeline/run';
import { createCodegenSessions } from '../pipeline/state';
import { createFakeDocument, createFakeHost } from '../testing';
import { BUILTIN_TARGETS, reformerStacks } from './harness';

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

function setup(
  options: Parameters<typeof createFakeHost>[0] & { readonly kit?: KitView | null } = {}
) {
  const { kit, ...hostOptions } = options;
  const document = createFakeDocument(DOC, JSON.stringify(plainSchema()), 'credit.schema.json');
  const host = createFakeHost({ document, ...hostOptions });
  const sessions = createCodegenSessions();
  const stacks = reformerStacks(kit === undefined ? {} : { kit });
  const run = (formName?: string) =>
    runCodegen({
      host,
      stacks,
      targets: BUILTIN_TARGETS,
      documentId: DOC,
      store: sessions.storeFor(DOC),
      ...(formName === undefined ? {} : { formName }),
    });
  return { host, store: sessions.storeFor(DOC), run };
}

describe('прогон генерации', () => {
  it('печатает и записывает модуль рядом с документом', async () => {
    const { host, store, run } = setup({ withSave: true });
    await run();

    const state = store.get();
    expect(state.error).toBeNull();
    expect(state.stack).toBe('reformer');
    expect(state.delivery?.written).toContain('types/credit.ts');
    expect(host.written.has('src/forms/credit/types/credit.ts')).toBe(true);
  });

  it('правила берутся из файла правил рядом с документом и печатаются в валидацию', async () => {
    const { host, store, run } = setup();
    host.written.set(
      'src/forms/credit.rules.json',
      printRulesText({
        validation: [{ target: 'fullName', rules: ['required'] }],
        behavior: [],
        render: [],
      })
    );
    await run();

    expect(store.get().error).toBeNull();
    expect(host.written.get('src/forms/credit/validation/form.ts')).toContain('required');
  });

  it('битый файл правил — отказ стека с адресом файла, ничего не записано', async () => {
    const { host, store, run } = setup();
    host.written.set('src/forms/credit.rules.json', '{ broken');
    await run();

    expect(store.get().error).toMatchObject({ key: 'error.rules-file', stack: 'reformer' });
    expect(store.get().error?.detail).toContain('credit.rules.json');
    expect([...host.written.keys()]).toEqual(['src/forms/credit.rules.json']);
  });

  it('без кита стек отказывает НАЗВАННО и ничего не пишет', async () => {
    const { host, store, run } = setup({ kit: null });
    await run();
    expect(store.get().error).toEqual({ key: 'error.no-kit', stack: 'reformer' });
    expect(host.written.size).toBe(0);
  });

  it('документ, который не разбирается в схему, отказывает названно', async () => {
    const document = createFakeDocument(DOC, 'не json');
    const { store, run } = setup({ document });
    await run();
    expect(store.get().error).toEqual({ key: 'error.not-a-schema' });
  });

  it('источник без записи отказывает названно, а не исключением', async () => {
    const { store, run } = setup({ write: false });
    await run();
    expect(store.get().error).toEqual({ key: 'error.read-only' });
  });

  it('модуль, напечатанный другим китом, — отказ с именами китов, ничего не записано', async () => {
    // Реестр на диске напечатан HexaUI: обёртка поля — из её пакета.
    const foreign = [
      "import { FormField } from '@reformer/kit-hexa-ui';",
      'reg.component(FIELD_WRAPPER, FormField);',
    ].join('\n');
    const { host, store, run } = setup({
      withSave: true,
      files: { 'src/forms/credit/schema/registry.ts': foreign },
    });
    await run();

    expect(store.get().error).toEqual({
      key: 'error.kit-mismatch',
      stack: 'reformer',
      params: { module: '@reformer/kit-hexa-ui', active: '@reformer/ui-kit' },
    });
    expect(host.written.get('src/forms/credit/schema/registry.ts')).toBe(foreign);
    expect(host.written.has('src/forms/credit/types/credit.ts')).toBe(false);
  });

  it('сниппет регистрации собран из имени формы', async () => {
    const { store, run } = setup();
    await run('Профиль пользователя');
    expect(store.get().snippet).toContain('profilPolzovatelyaFormEntry');
  });

  it('по документу прежнего формата печатает модуль с его полями, а не пустой', async () => {
    const document = createFakeDocument(DOC, JSON.stringify(LEGACY_FORM), 'credit.schema.json');
    const { host, store, run } = setup({ document });
    await run();

    expect(store.get().error).toBeNull();
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
  async function runAt(
    path: string,
    name: string,
    files: Record<string, string> = {},
    formName?: string
  ) {
    const id = path as ResourceId;
    const text = JSON.stringify(plainSchema());
    const document = createFakeDocument(path, text, name);
    const host = createFakeHost({ document, files: { [path]: text, ...files } });
    const store = createCodegenSessions().storeFor(id);
    await runCodegen({
      host,
      stacks: reformerStacks(),
      targets: BUILTIN_TARGETS,
      documentId: id,
      store,
      ...(formName === undefined ? {} : { formName }),
    });
    return { host, state: store.get() };
  }

  it('документ в <модуль>/schema/ — модуль печатается НА МЕСТЕ, в родителе папки', async () => {
    const { host, state } = await runAt(
      'src/forms/loan/schema/form.schema.json',
      'form.schema.json'
    );

    expect(state.error).toBeNull();
    expect(state.delivery?.dir).toBe('src/forms/loan');
    expect(state.rootPath).toBe('src/forms/loan');
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
    // Файлы прежней раскладки названы заметкой стека и не тронуты.
    expect(state.delivery?.notes.find((note) => note.id === 'flat')?.paths).toEqual([
      'index.tsx',
      'form.render.ts',
    ]);
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

  it('свободное имя: каталог модуля — по имени документа, введённое имя меняет только код', async () => {
    // Модуль под введённым именем (`zayavka-na-kredit/`) не нашли бы ни превью, ни фикстура, ни
    // превью приложением: у них есть только адрес документа.
    const { host, state } = await runAt(
      'src/forms/credit.schema.json',
      'credit.schema.json',
      {},
      'Заявка на кредит'
    );
    expect(state.delivery?.dir).toBe('src/forms/credit');
    expect(host.written.has('src/forms/credit/ZayavkaNaKreditForm.tsx')).toBe(true);
    expect(host.written.has('src/forms/zayavka-na-kredit/ZayavkaNaKreditForm.tsx')).toBe(false);
  });
});
