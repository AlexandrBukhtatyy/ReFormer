import { validateFormSchema } from '@reformer/renderer-json/validate';
import { describe, expect, it } from 'vitest';
import { emptyRules, emptySchema } from '../../../core/form-model';
import { builtinEntries } from '../../../core/testing';
import { printSchemaText } from '../model/schema-text';
import { createFakeFiles, createTestFileTurn, FORM_PATH } from '../testing';
import { composeForm, jsonError } from './compose';
import { gateWrite } from './gate';
import { createFileJournal } from './journal';
import { moduleFileOf, normalizeModulePath, isRefusal } from './scope';
import type { FileToolContext, FileTurn } from './turn';

const catalog = builtinEntries();

/** Пустая форма образцового модуля. */
const EMPTY = printSchemaText(emptySchema());

/** Форма с одним полем. */
const WITH_FIELD = printSchemaText({
  ...emptySchema(),
  root: {
    component: '$component(Box)',
    children: [
      {
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
} as never);

/** Визард, разбитый по файлам: корень со ссылкой и файл шага. */
const SPLIT_ROOT = printSchemaText({
  format: 2,
  root: {
    component: '$component(Wizard)',
    children: [{ $ref: './steps/kontakty/form.schema.json' }],
  },
} as never);
const STEP = (label: string): string =>
  JSON.stringify({
    $schema: '../../form-step.schema.json',
    node: {
      component: '$component(Step)',
      componentProps: { title: 'Контакты' },
      children: [
        { model: '$model(email)', component: '$component(Input)', componentProps: { label } },
      ],
    },
  });

const ctxOf = (turn: FileTurn): FileToolContext => ({
  draft: turn.draft(),
  base: turn.base,
  rules: emptyRules(),
  catalog,
  validateForm: validateFormSchema,
  files: turn,
});

describe('scope — пути от корня модуля', () => {
  it('нормализует и снимает префикс модуля', () => {
    expect(normalizeModulePath('./schema/form.schema.json', 'forms/loan')).toBe(
      'schema/form.schema.json'
    );
    expect(normalizeModulePath('validation\\form.ts', 'forms/loan')).toBe('validation/form.ts');
    expect(normalizeModulePath('forms/loan/behavior/index.ts', 'forms/loan')).toBe(
      'behavior/index.ts'
    );
  });

  it('за модуль не выводит никакой путь', () => {
    for (const path of [
      '../other/form.schema.json',
      'schema/../../x.ts',
      '/etc/passwd',
      'C:/x.ts',
      'schema//form.schema.json',
      'node_modules/a/index.ts',
      '.ui_builder/settings.json',
      '',
    ]) {
      expect(normalizeModulePath(path, 'forms/loan'), path).toBeNull();
    }
  });

  it('отказ — ответом инструмента PATH_REFUSED', () => {
    const files = createFakeFiles({ [FORM_PATH]: EMPTY });
    const scope = files.scopeOf(FORM_PATH)!;
    const refused = moduleFileOf(files, scope, '../x.ts');
    expect(isRefusal(refused) && refused.error?.code).toBe('PATH_REFUSED');
    const file = moduleFileOf(files, scope, 'validation/form.ts');
    expect(isRefusal(file)).toBe(false);
    expect(!isRefusal(file) && file.id).toBe('forms/loan/validation/form.ts');
  });

  it('модуль находится по раскладке документа; у документа со свободным именем модуля нет', () => {
    const files = createFakeFiles({
      [FORM_PATH]: EMPTY,
      'forms/contact/form.schema.json': EMPTY,
      'forms/credit.schema.json': EMPTY,
    });
    expect(files.scopeOf(FORM_PATH)).toMatchObject({
      root: 'forms/loan',
      rootPath: 'forms/loan',
      schemaPath: 'schema/form.schema.json',
    });
    expect(files.scopeOf('forms/contact/form.schema.json')).toMatchObject({
      root: 'forms/contact',
      schemaPath: 'form.schema.json',
    });
    expect(files.scopeOf('forms/credit.schema.json')).toBeNull();
  });
});

describe('compose — форма из файлов', () => {
  const readerOf =
    (files: Record<string, string>) =>
    (rel: string): Promise<string | null> =>
      Promise.resolve(files[rel] ?? null);

  it('одна схема — как есть', async () => {
    const composed = await composeForm(
      readerOf({ 'schema/form.schema.json': EMPTY }),
      'schema/form.schema.json'
    );
    expect(composed.ok && composed.stepFiles).toEqual([]);
  });

  it('визард по файлам собирается, файлы шагов названы от корня модуля', async () => {
    const composed = await composeForm(
      readerOf({
        'schema/form.schema.json': SPLIT_ROOT,
        'schema/steps/kontakty/form.schema.json': STEP('Email'),
      }),
      'schema/form.schema.json'
    );
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    expect(composed.stepFiles).toEqual(['schema/steps/kontakty/form.schema.json']);
    expect(JSON.stringify(composed.schema)).toContain('$model(email)');
  });

  it('нет файла шага — причина называет и ссылку, и порядок действий', async () => {
    const composed = await composeForm(
      readerOf({ 'schema/form.schema.json': SPLIT_ROOT }),
      'schema/form.schema.json'
    );
    expect(composed.ok).toBe(false);
    expect(!composed.ok && composed.error).toMatch(/create the step file first/);
  });

  it('ошибка JSON — со строкой и столбцом', () => {
    const text = '{\n  "a": 1,\n  "b": }';
    let error: unknown;
    try {
      JSON.parse(text);
    } catch (e) {
      error = e;
    }
    // V8 на «неожиданном символе» места не называет — оно находится, и цитата текста срезается.
    expect(jsonError(text, error)).toBe("Unexpected token '}' (line 3 column 8)");
  });
});

describe('journal — before при первом касании, after при каждом', () => {
  it('ход из двух записей отменяется к состоянию до первой', () => {
    const journal = createFileJournal();
    journal.record('f', 'f', 'v0', 'v1');
    journal.record('f', 'f', 'v1', 'v2');
    expect(journal.get('f')).toEqual({ rel: 'f', before: 'v0', after: 'v2' });
  });
});

describe('gate — ломающая запись не пишется', () => {
  const setup = async (initial: Record<string, string>) => {
    const files = createFakeFiles(initial);
    const turn = await createTestFileTurn(files);
    const file = (rel: string) => {
      const found = turn.file(rel);
      if (isRefusal(found)) throw new Error('refused');
      return found;
    };
    return { files, turn, ctx: ctxOf(turn), file };
  };

  it('битый JSON документа — отказ с местом ошибки', async () => {
    const { ctx, file } = await setup({ [FORM_PATH]: EMPTY });
    const verdict = await gateWrite(ctx, file('schema/form.schema.json'), '{ "format": 2, ', EMPTY);
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.outcome.error?.code).toBe('SCHEMA_INVALID');
    expect(!verdict.ok && verdict.outcome.text).toMatch(/line \d+ column \d+/);
  });

  it('выдуманный компонент — отказ', async () => {
    const { ctx, file } = await setup({ [FORM_PATH]: EMPTY });
    const next = WITH_FIELD.replace('$component(Input)', '$component(EmailField)');
    const verdict = await gateWrite(ctx, file('schema/form.schema.json'), next, EMPTY);
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.outcome.text).toMatch(/EmailField/);
  });

  it('законная правка проходит и отдаёт новую форму', async () => {
    const { ctx, file } = await setup({ [FORM_PATH]: EMPTY });
    const verdict = await gateWrite(ctx, file('schema/form.schema.json'), WITH_FIELD, EMPTY);
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && JSON.stringify(verdict.draft)).toContain('$model(email)');
  });

  it('старая ошибка формы правке не вменяется', async () => {
    const broken = WITH_FIELD.replace('$component(Input)', '$component(Legacy)');
    const { ctx, file } = await setup({ [FORM_PATH]: broken });
    // Правка рядом со сломанным узлом, сам узел не тронут.
    const next = broken.replace('"Email"', '"E-mail"');
    expect((await gateWrite(ctx, file('schema/form.schema.json'), next, broken)).ok).toBe(true);
  });

  it('ссылка на несуществующий шаг — отказ; шаг сначала, ссылка потом — проходит', async () => {
    const { files, turn, ctx, file } = await setup({ [FORM_PATH]: EMPTY });
    const rootWithRef = SPLIT_ROOT;
    const early = await gateWrite(ctx, file('schema/form.schema.json'), rootWithRef, EMPTY);
    expect(early.ok).toBe(false);

    const step = file('schema/steps/kontakty/form.schema.json');
    const stepVerdict = await gateWrite(ctx, step, STEP('Email'), null);
    expect(stepVerdict.ok).toBe(true);
    await turn.write(step, null, STEP('Email'));
    expect(files.text('forms/loan/schema/steps/kontakty/form.schema.json')).toBe(STEP('Email'));

    const late = await gateWrite(ctx, file('schema/form.schema.json'), rootWithRef, EMPTY);
    expect(late.ok).toBe(true);
  });

  it('шаг, на который ссылается корень, проверяется в собранной форме', async () => {
    const { ctx, file } = await setup({
      [FORM_PATH]: SPLIT_ROOT,
      'forms/loan/schema/steps/kontakty/form.schema.json': STEP('Email'),
    });
    const next = STEP('Email').replace('$component(Input)', '$component(Nope)');
    const verdict = await gateWrite(
      ctx,
      file('schema/steps/kontakty/form.schema.json'),
      next,
      STEP('Email')
    );
    expect(verdict.ok).toBe(false);
  });

  it('производный файл — запись проходит с предупреждением', async () => {
    const { ctx, file } = await setup({ [FORM_PATH]: EMPTY });
    const verdict = await gateWrite(ctx, file('model/model.ts'), 'export {};\n', null);
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.notes.join(' ')).toMatch(/derived/);
  });
});
