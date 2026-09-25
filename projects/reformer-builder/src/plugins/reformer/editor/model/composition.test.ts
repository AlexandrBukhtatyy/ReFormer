/**
 * Способность `composition` провайдера схемы: сборка из файлов шагов, обратимость, перестройка.
 *
 * Сами правила разбиения покрыты стеком (`form-model/composite.test.ts`); здесь — то, что
 * добавляет провайдер: разбор текстов частей, печать файлов и перестройка раскладки.
 *
 * @module plugins/reformer/editor/model/composition.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { STEP_SCHEMA_MARKER } from '@reformer/builder-stack-reformer/form-model';
import { formSchemaComposition } from './composition';
import { parseFormSchema, printFormSchema } from './provider';

const REF = './steps/kontakty/form.schema.json';

const STEP = {
  component: '$component(Step)',
  componentProps: { title: 'Контакты' },
  $nodeId: 'kontakt0',
  children: [{ value: '$model(email)', component: '$component(Input)', $nodeId: 'kontak0f' }],
};

const ROOT_TEXT = printFormSchema({
  version: '1.0',
  root: {
    component: '$component(Box)',
    $nodeId: 'root0000',
    children: [
      {
        component: '$component(Wizard)',
        $nodeId: 'wizard00',
        componentProps: { steps: [{ $ref: REF }] },
      },
    ],
  },
} as unknown as JsonFormSchema);

const PART_TEXT = `${JSON.stringify({ $schema: STEP_SCHEMA_MARKER, node: STEP }, null, 2)}\n`;

describe('composition провайдера схемы', () => {
  const composition = formSchemaComposition();

  it('открыть и разложить без правок — те же байты корня и шага', () => {
    const root = parseFormSchema(ROOT_TEXT);
    expect(composition.references(root)).toEqual([REF]);

    const { model, layout } = composition.compose(root, new Map([[REF, PART_TEXT]]));
    const laid = composition.decompose(model, layout);
    expect(printFormSchema(laid.root)).toBe(ROOT_TEXT);
    expect(laid.parts.get(REF)).toBe(PART_TEXT);
  });

  it('битый файл шага — ошибка с именем файла', () => {
    expect(() =>
      composition.compose(parseFormSchema(ROOT_TEXT), new Map([[REF, '{ не json']]))
    ).toThrow(/kontakty\/form\.schema\.json.*не разбирается/);
  });

  it('«собрать» — частей нет, «разбить» — снова файл шага', () => {
    const { model, layout } = composition.compose(
      parseFormSchema(ROOT_TEXT),
      new Map([[REF, PART_TEXT]])
    );
    const joined = composition.decompose(model, layout, 'join');
    expect(joined.parts.size).toBe(0);
    expect(printFormSchema(joined.root)).toContain('"title": "Контакты"');

    const split = composition.decompose(model, joined.layout, 'split');
    expect([...split.parts.keys()]).toEqual([REF]);
  });
});
