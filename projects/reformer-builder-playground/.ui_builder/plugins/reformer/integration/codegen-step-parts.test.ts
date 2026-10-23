/**
 * «Сгенерировать в папку» разбитой формы оставляет её разбитой, а не затирает корень собранной
 * схемой — через хозяина и настоящий стек ReFormer.
 *
 * @module plugins/reformer/integration/codegen-step-parts.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { STEP_SCHEMA_MARKER } from '../core/form-model';
import { generateInto } from '../../forms/codegen/src/commands/generate-into';
import { createFakeHost } from '../../forms/codegen/src/testing';
import { BUILTIN_TARGETS, reformerStacks } from './codegen-harness';

const DIR = 'fake:forms/wizard' as ResourceId;
const ROOT = `${DIR}/form.schema.json` as ResourceId;
const REF = './steps/kontakty/form.schema.json';
const STEP_FILE = `${DIR}/steps/kontakty/form.schema.json`;

const step = {
  component: '$component(Step)',
  componentProps: { title: 'Контакты' },
  $nodeId: 'kontakt0',
  selector: 'kontakty-section',
  children: [
    {
      model: '$model(email)',
      component: '$component(Input)',
      componentProps: { label: 'Почта' },
      $nodeId: 'kontak0f',
      selector: 'email',
    },
  ],
};

const skeleton = {
  $schema: './form-schema.schema.json',
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    $nodeId: 'root0000',
    children: [
      {
        component: '$component(Wizard)',
        $nodeId: 'wizard00',
        selector: 'wizard',
        children: [{ $ref: REF }],
      },
    ],
  },
};

/**
 * Тот же шаг в ПРЕЖНЕМ формате: привязка поля — в `value`.
 *
 * Литерал прежнего формата здесь намеренно: это вход проверки перевода, а не недосмотр переноса.
 */
const legacyStep = {
  component: '$component(Step)',
  componentProps: { title: 'Контакты' },
  $nodeId: 'kontakt0',
  selector: 'kontakty-section',
  children: [
    {
      value: '$model(email)',
      component: '$component(Input)',
      componentProps: { label: 'Почта' },
      $nodeId: 'kontak0f',
      selector: 'email',
    },
  ],
};

/** Тот же корень в ПРЕЖНЕМ формате: без `format`, ссылка на шаг — в `componentProps.steps`. */
const legacySkeleton = {
  $schema: './form-schema.schema.json',
  version: '1.0',
  root: {
    component: '$component(Box)',
    $nodeId: 'root0000',
    children: [
      {
        component: '$component(Wizard)',
        $nodeId: 'wizard00',
        componentProps: { steps: [{ $ref: REF }] },
        selector: 'wizard',
      },
    ],
  },
};

const printed = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

function splitFiles(): Record<string, string> {
  return {
    [ROOT]: printed(skeleton),
    [STEP_FILE]: printed({ $schema: STEP_SCHEMA_MARKER, node: step }),
  };
}

function legacySplitFiles(): Record<string, string> {
  return {
    [ROOT]: printed(legacySkeleton),
    [STEP_FILE]: printed({ $schema: STEP_SCHEMA_MARKER, node: legacyStep }),
  };
}

describe('генерация в папку разбитой формы', () => {
  it('корень и файл шага остаются теми же байтами, правила шага — в папке валидации', async () => {
    // Документ лежит в корне каталога (форма прежней плоской раскладки): он и файлы шагов
    // остаются на месте, код печатается по папкам ролей.
    const files = splitFiles();
    const host = createFakeHost({ files });
    const outcome = await generateInto(
      { host, stacks: reformerStacks(), targets: () => BUILTIN_TARGETS },
      { dir: DIR }
    );

    expect(outcome.kind).toBe('delivered');
    expect(host.written.get(ROOT)).toBe(files[ROOT]);
    expect(host.written.get(STEP_FILE)).toBe(files[STEP_FILE]);
    expect(host.written.has(`${DIR}/validation/kontakty.ts`)).toBe(true);
    // Словарь схем шагов объявляет сама сборка — агрегатора `steps/index.ts` больше нет, — и
    // импортирует она их оттуда, где они лежат.
    const create = host.written.get(`${DIR}/application/create.ts`) ?? '';
    expect(create).toContain('const stepSchemas: Record<string, JsonFormStep> = {');
    expect(create).toContain('composeJsonFormSchema(');
    expect(create).toContain("import step1Schema from '../steps/kontakty/form.schema.json';");
    expect(host.written.has(`${DIR}/steps/index.ts`)).toBe(false);
  });

  it('документ в папке schema: корень и шаги остаются на месте, модуль — в выбранном каталоге', async () => {
    const nestedRoot = `${DIR}/schema/form.schema.json`;
    const nestedStep = `${DIR}/schema/steps/kontakty/form.schema.json`;
    const files = {
      [nestedRoot]: printed(skeleton),
      [nestedStep]: printed({ $schema: STEP_SCHEMA_MARKER, node: step }),
    };
    const host = createFakeHost({ files });
    const outcome = await generateInto(
      { host, stacks: reformerStacks(), targets: () => BUILTIN_TARGETS },
      { dir: DIR }
    );

    expect(outcome.kind).toBe('delivered');
    // Ссылка корня (`./steps/…`) относительна документу — шаги прочитаны и записаны рядом с ним.
    expect(host.written.get(nestedRoot)).toBe(files[nestedRoot]);
    expect(host.written.get(nestedStep)).toBe(files[nestedStep]);
    expect(host.written.has(`${DIR}/validation/kontakty.ts`)).toBe(true);
    expect(host.written.get(`${DIR}/application/create.ts`)).toContain(
      "import step1Schema from '../schema/steps/kontakty/form.schema.json';"
    );
    // В корне каталога документа не появилось: он один, в `schema/`.
    expect(host.written.has(ROOT)).toBe(false);
  });
});

describe('разбитая форма прежнего формата: генерация в папку', () => {
  it('генерация в папку даёт тот же модуль, что и по записи формата 2', async () => {
    const files = splitFiles();
    const legacyFiles = legacySplitFiles();
    // Посылка: на диске лежит не та запись, с которой работает генерация, — и в корне, и в шаге.
    expect(legacyFiles[ROOT]).not.toBe(files[ROOT]);
    expect(legacyFiles[STEP_FILE]).not.toBe(files[STEP_FILE]);

    const modern = createFakeHost({ files });
    const legacy = createFakeHost({ files: legacyFiles });
    const targets = () => BUILTIN_TARGETS;

    expect(
      (await generateInto({ host: modern, stacks: reformerStacks(), targets }, { dir: DIR })).kind
    ).toBe('delivered');
    expect(
      (await generateInto({ host: legacy, stacks: reformerStacks(), targets }, { dir: DIR })).kind
    ).toBe('delivered');

    // Весь модуль байт в байт: и код, и обе схемы. Схемы производные — они переписаны в формат 2.
    expect(Object.fromEntries(legacy.written)).toEqual(Object.fromEntries(modern.written));
    expect(legacy.written.get(ROOT)).toBe(printed(skeleton));
    expect(legacy.written.get(STEP_FILE)).toBe(
      printed({ $schema: STEP_SCHEMA_MARKER, node: step })
    );
    // Модуль — визарда, а не простой формы: шаг найден, его правила лежат своим файлом.
    expect(legacy.written.has(`${DIR}/validation/kontakty.ts`)).toBe(true);
  });
});
