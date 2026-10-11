/**
 * Форма из корня и файлов шагов: сборка перед генерацией и то, что «Сгенерировать в папку»
 * разбитой формы оставляет её разбитой, а не затирает корень собранной схемой.
 *
 * Отдельно — форма ПРЕЖНЕГО формата на диске: она обязана собраться и напечататься так же, как
 * её запись в формате 2.
 *
 * @module plugins/reformer/codegen/pipeline/source.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { STEP_SCHEMA_MARKER } from '../../../core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { generateInto } from '../commands/context-menu';
import { createFakeHost } from '../testing';
import { asFormSchema, loadFormSource, StepPartsError } from './source';
import { BUILTIN_TARGETS } from './targets';

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

describe('loadFormSource', () => {
  it('собирает шаги из файлов и помнит происхождение', async () => {
    const host = createFakeHost({ files: splitFiles() });
    const source = await loadFormSource(host, ROOT, skeleton as unknown as JsonFormSchema);
    const wizard = (source.schema.root as unknown as { children: { children: unknown[] }[] })
      .children[0];
    expect(wizard.children).toEqual([step]);
    expect(source.origins?.get('kontakt0')?.ref).toBe(REF);
  });

  it('схема без ссылок — как есть', async () => {
    const plain = {
      format: 2,
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    };
    const source = await loadFormSource(createFakeHost(), ROOT, plain as unknown as JsonFormSchema);
    expect(source.schema).toBe(plain);
    expect(source.origins).toBeUndefined();
  });

  it('нет файла шага или он не разбирается — названный отказ', async () => {
    const missing = createFakeHost({ files: { [ROOT]: printed(skeleton) } });
    await expect(
      loadFormSource(missing, ROOT, skeleton as unknown as JsonFormSchema)
    ).rejects.toThrow(StepPartsError);

    const broken = createFakeHost({
      files: { ...splitFiles(), [STEP_FILE]: '{ не json' },
    });
    await expect(
      loadFormSource(broken, ROOT, skeleton as unknown as JsonFormSchema)
    ).rejects.toThrow(/не разбирается/);
  });
});

describe('генерация в папку разбитой формы', () => {
  it('корень и файл шага остаются теми же байтами, код шага — в папке шага', async () => {
    const files = splitFiles();
    const host = createFakeHost({ files });
    const outcome = await generateInto({ host, targets: () => BUILTIN_TARGETS }, { dir: DIR });

    expect(outcome.kind).toBe('delivered');
    expect(host.written.get(ROOT)).toBe(files[ROOT]);
    expect(host.written.get(STEP_FILE)).toBe(files[STEP_FILE]);
    expect(host.written.has(`${DIR}/steps/kontakty/form.validation.ts`)).toBe(true);
    expect(host.written.get(`${DIR}/steps/index.ts`)).toContain('export const stepSchemas');
    expect(host.written.get(`${DIR}/index.tsx`)).toContain('composeJsonFormSchema(');
  });
});

describe('разбитая форма прежнего формата на диске', () => {
  it('ссылки на шаги находятся в `componentProps.steps`: корень переводится ДО их поиска', async () => {
    const modern = await loadFormSource(
      createFakeHost({ files: splitFiles() }),
      ROOT,
      skeleton as unknown as JsonFormSchema
    );
    // Корень отдан как прочитан, без перевода на стороне вызывающего: переводить обязана сборка.
    const legacy = await loadFormSource(
      createFakeHost({ files: legacySplitFiles() }),
      ROOT,
      legacySkeleton as unknown as JsonFormSchema
    );

    expect(legacy.origins?.get('kontakt0')?.ref).toBe(REF);
    expect(legacy.schema).toEqual(modern.schema);
    expect([...(legacy.origins ?? [])]).toEqual([...(modern.origins ?? [])]);
  });

  it('корень без ссылок возвращается переведённым, а не как есть', async () => {
    const plain = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [{ value: '$model(email)', component: '$component(Input)' }],
      },
    };
    const source = await loadFormSource(createFakeHost(), ROOT, plain as unknown as JsonFormSchema);
    expect(source.schema).toEqual({
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [{ model: '$model(email)', component: '$component(Input)' }],
      },
    });
  });

  it('генерация в папку даёт тот же модуль, что и по записи формата 2', async () => {
    const files = splitFiles();
    const legacyFiles = legacySplitFiles();
    // Посылка: на диске лежит не та запись, с которой работает генерация, — и в корне, и в шаге.
    expect(legacyFiles[ROOT]).not.toBe(files[ROOT]);
    expect(legacyFiles[STEP_FILE]).not.toBe(files[STEP_FILE]);

    const modern = createFakeHost({ files });
    const legacy = createFakeHost({ files: legacyFiles });
    const targets = () => BUILTIN_TARGETS;

    expect((await generateInto({ host: modern, targets }, { dir: DIR })).kind).toBe('delivered');
    expect((await generateInto({ host: legacy, targets }, { dir: DIR })).kind).toBe('delivered');

    // Весь модуль байт в байт: и код, и обе схемы. Схемы производные — они переписаны в формат 2.
    expect(Object.fromEntries(legacy.written)).toEqual(Object.fromEntries(modern.written));
    expect(legacy.written.get(ROOT)).toBe(printed(skeleton));
    expect(legacy.written.get(STEP_FILE)).toBe(
      printed({ $schema: STEP_SCHEMA_MARKER, node: step })
    );
    // Модуль — визарда, а не простой формы: шаг найден, его код лежит в папке шага.
    expect(legacy.written.has(`${DIR}/steps/kontakty/form.validation.ts`)).toBe(true);
  });
});

describe('asFormSchema', () => {
  it('схему формата 2 возвращает той же ссылкой', () => {
    expect(asFormSchema(skeleton)).toBe(skeleton);
  });

  it('не схему формы отвергает, а не приводит', () => {
    expect(asFormSchema(null)).toBeNull();
    expect(asFormSchema({ version: '1.0' })).toBeNull();
    expect(asFormSchema({ root: 'не узел' })).toBeNull();
    // Файл шага — не форма: у него `node`, а не `root`.
    expect(asFormSchema({ $schema: STEP_SCHEMA_MARKER, node: step })).toBeNull();
  });
});
