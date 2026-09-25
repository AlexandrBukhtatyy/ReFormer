/**
 * Форма из корня и файлов шагов: сборка перед генерацией и то, что «Сгенерировать в папку»
 * разбитой формы оставляет её разбитой, а не затирает корень собранной схемой.
 *
 * @module plugins/reformer/codegen/pipeline/source.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { STEP_SCHEMA_MARKER } from '@reformer/builder-stack-reformer/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { generateInto } from '../commands/context-menu';
import { createFakeHost } from '../testing';
import { loadFormSource, StepPartsError } from './source';
import { BUILTIN_TARGETS } from './targets';

const DIR = 'fake:forms/wizard' as ResourceId;
const ROOT = `${DIR}/form.schema.json` as ResourceId;
const REF = './steps/kontakty/form.schema.json';

const step = {
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

const skeleton = {
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
    [`${DIR}/steps/kontakty/form.schema.json`]: printed({
      $schema: STEP_SCHEMA_MARKER,
      node: step,
    }),
  };
}

describe('loadFormSource', () => {
  it('собирает шаги из файлов и помнит происхождение', async () => {
    const host = createFakeHost({ files: splitFiles() });
    const source = await loadFormSource(host, ROOT, skeleton as unknown as JsonFormSchema);
    const wizard = (
      source.schema.root as unknown as { children: { componentProps: { steps: unknown[] } }[] }
    ).children[0];
    expect(wizard.componentProps.steps).toEqual([step]);
    expect(source.origins?.get('kontakt0')?.ref).toBe(REF);
  });

  it('схема без ссылок — как есть', async () => {
    const plain = { version: '1.0', root: { component: '$component(Box)', children: [] } };
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
      files: { ...splitFiles(), [`${DIR}/steps/kontakty/form.schema.json`]: '{ не json' },
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
    expect(host.written.get(`${DIR}/steps/kontakty/form.schema.json`)).toBe(
      files[`${DIR}/steps/kontakty/form.schema.json`]
    );
    expect(host.written.has(`${DIR}/steps/kontakty/form.validation.ts`)).toBe(true);
    expect(host.written.get(`${DIR}/steps/index.ts`)).toContain('export const stepSchemas');
    expect(host.written.get(`${DIR}/index.tsx`)).toContain('composeJsonFormSchema(');
  });
});
