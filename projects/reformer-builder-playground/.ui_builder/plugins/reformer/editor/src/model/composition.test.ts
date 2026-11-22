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
import { STEP_SCHEMA_MARKER } from '../../../core/form-model';
import { formSchemaComposition } from './composition';
import { parseFormSchema, printFormSchema } from './provider';

const REF = './steps/kontakty/form.schema.json';

const STEP = {
  component: '$component(Step)',
  componentProps: { title: 'Контакты' },
  $nodeId: 'kontakt0',
  children: [{ model: '$model(email)', component: '$component(Input)', $nodeId: 'kontak0f' }],
};

const ROOT_TEXT = printFormSchema({
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    $nodeId: 'root0000',
    children: [
      {
        component: '$component(Wizard)',
        $nodeId: 'wizard00',
        // Шаги — `children` визарда; вынесенный шаг стоит там ссылкой на свой файл.
        children: [{ $ref: REF }],
      },
    ],
  },
} as unknown as JsonFormSchema);

const PART_TEXT = `${JSON.stringify({ $schema: STEP_SCHEMA_MARKER, node: STEP }, null, 2)}\n`;

/** Та же разбитая форма, как её писали до формата 2: без `format`, шаги в пропсах визарда. */
const LEGACY_ROOT_TEXT = `${JSON.stringify(
  {
    version: '1.0',
    root: {
      component: '$component(Box)',
      $nodeId: 'root0000',
      children: [
        {
          component: '$component(Wizard)',
          $nodeId: 'wizard00',
          componentProps: { className: 'w-full', steps: [{ $ref: REF }] },
        },
      ],
    },
  },
  null,
  2
)}\n`;

/** Файл шага прежнего формата: привязки в `value` и `array`. */
const LEGACY_PART_TEXT = `${JSON.stringify(
  {
    $schema: STEP_SCHEMA_MARKER,
    node: {
      component: '$component(Step)',
      componentProps: { title: 'Контакты' },
      $nodeId: 'kontakt0',
      children: [
        { value: '$model(email)', component: '$component(Input)', $nodeId: 'kontak0f' },
        {
          array: '$model(phones)',
          $nodeId: 'kontak0a',
          item: {
            $template: {
              component: '$component(Box)',
              $nodeId: 'kontak0t',
              children: [
                { value: '$model(number)', component: '$component(Input)', $nodeId: 'kontak0n' },
              ],
            },
          },
        },
      ],
    },
  },
  null,
  2
)}\n`;

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

  it('разбитая форма прежнего формата открывается и раскладывается обратно форматом 2', () => {
    // Корень переводит разбор: ссылка на шаг уже лежит в `children` визарда.
    const root = parseFormSchema(LEGACY_ROOT_TEXT);
    expect(composition.references(root)).toEqual([REF]);

    // Файл шага переводит сборка: собранная модель — формата 2 целиком.
    const { model, layout } = composition.compose(root, new Map([[REF, LEGACY_PART_TEXT]]));
    expect(model.format).toBe(2);
    const wizard = (model.root as unknown as { children: Record<string, unknown>[] }).children[0];
    expect(wizard.componentProps).toEqual({ className: 'w-full' });
    const [step] = wizard.children as { $nodeId: string; children: Record<string, unknown>[] }[];
    expect(step.$nodeId).toBe('kontakt0');
    expect(step.children.map((child) => child.model)).toEqual(['$model(email)', '$model(phones)']);

    // Обратно: в корне — ссылка в `children` визарда, в файле шага — ключ `model`.
    const laid = composition.decompose(model, layout);
    const rootText = printFormSchema(laid.root);
    const laidRoot = JSON.parse(rootText) as {
      format: number;
      root: { children: Record<string, unknown>[] };
    };
    expect(laidRoot.format).toBe(2);
    expect(laidRoot.root.children[0]).toEqual({
      component: '$component(Wizard)',
      $nodeId: 'wizard00',
      componentProps: { className: 'w-full' },
      children: [{ $ref: REF }],
    });
    expect(rootText).not.toContain('"steps"');

    expect([...laid.parts.keys()]).toEqual([REF]);
    const partText = laid.parts.get(REF) ?? '';
    expect(partText).not.toMatch(/"(value|array)":/);
    expect(JSON.parse(partText)).toEqual({
      $schema: STEP_SCHEMA_MARKER,
      node: {
        component: '$component(Step)',
        componentProps: { title: 'Контакты' },
        $nodeId: 'kontakt0',
        children: [
          { model: '$model(email)', component: '$component(Input)', $nodeId: 'kontak0f' },
          {
            model: '$model(phones)',
            $nodeId: 'kontak0a',
            item: {
              $template: {
                component: '$component(Box)',
                $nodeId: 'kontak0t',
                children: [
                  { model: '$model(number)', component: '$component(Input)', $nodeId: 'kontak0n' },
                ],
              },
            },
          },
        ],
      },
    });

    // Второй круг уже ничего не меняет: формат 2 раскладывается в те же байты.
    const again = composition.compose(parseFormSchema(rootText), new Map([[REF, partText]]));
    const relaid = composition.decompose(again.model, again.layout);
    expect(printFormSchema(relaid.root)).toBe(rootText);
    expect(relaid.parts.get(REF)).toBe(partText);
  });
});
