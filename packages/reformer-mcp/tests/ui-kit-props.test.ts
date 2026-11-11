/**
 * `componentProps` в intent против props-схем ui-kit: что `form_build` назовёт незнакомым.
 *
 * Зачем. Грамматика показывает свойства только на примерах, и о полном наборе агент узнаёт из
 * предупреждения сборки. Ложное предупреждение на рабочей форме хуже его отсутствия: агент начнёт
 * «чинить» верный intent. Поэтому, кроме самих чужих ключей, здесь проверено, что пример грамматики
 * и форма кредита из калибровки проходят по настоящим схемам кита без замечаний.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { readIntent } from '../src/core/generate/form-intent';
import { GRAMMAR_EXAMPLE, intentGrammar } from '../src/core/generate/intent-grammar';
import {
  checkComponentProps,
  uiKitPropsFromCatalog,
  type UiKitPropSchemas,
} from '../src/core/generate/ui-kit-props';

const here = dirname(fileURLToPath(import.meta.url));

const strict = (...names: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(names.map((name) => [name, { type: 'string' }])),
});

/**
 * Кит из трёх компонентов: поле, контейнер и нестрогий. Схема поля в каталоге уже слита с пропсами
 * обёртки (`label`, `testId`), как её пишет генератор каталога кита.
 */
const fakeKit: UiKitPropSchemas = {
  defaults: {
    InputNumber: strict('label', 'testId', 'placeholder', 'min', 'max'),
    Section: strict('title'),
    Box: strict('className'),
    Loose: { type: 'object', properties: { a: {} } },
  },
};

function intentOf(partial: Record<string, unknown>) {
  const { intent, problems } = readIntent({
    formName: 'Тест',
    interfaceName: 'Test',
    target: 'renderer-json',
    fields: [],
    layoutRoot: { kind: 'container', component: 'Box', children: [] },
    ...partial,
  });
  expect(problems).toEqual([]);
  return intent;
}

describe('checkComponentProps', () => {
  it('называет чужой ключ поля и перечисляет свойства компонента вместе с обёрткой', () => {
    const intent = intentOf({
      fields: [
        {
          name: 'price',
          type: 'number',
          component: 'InputNumber',
          componentProps: { minValue: 1, label: 'Цена', testId: 'price' },
        },
      ],
    });
    expect(checkComponentProps(intent, fakeKit, CATALOGS.uiKit)).toEqual([
      'the field «price»: InputNumber has no prop «minValue» in componentProps — they would go ' +
        'to the DOM. It has: label, testId, placeholder, min, max.',
    ]);
  });

  it('у контейнера пропсы обёртки поля чужие', () => {
    const intent = intentOf({
      layoutRoot: {
        kind: 'container',
        component: 'Section',
        selector: 'main',
        componentProps: { title: 'Раздел', label: 'Раздел' },
        children: [],
      },
    });
    expect(checkComponentProps(intent, fakeKit, CATALOGS.uiKit)).toEqual([
      'the container «main»: Section has no prop «label» in componentProps — they would go to ' +
        'the DOM. It has: title.',
    ]);
  });

  it('поле строки массива и контейнер подформы тоже проверяются', () => {
    const intent = intentOf({
      fields: [{ name: 'address.city', type: 'string', component: 'Input' }],
      arrays: [
        {
          name: 'items',
          itemInterfaceName: 'Item',
          initialValue: [],
          itemFields: [
            { name: 'qty', type: 'number', component: 'InputNumber', componentProps: { step: 1 } },
          ],
        },
      ],
      parts: {
        address: {
          kind: 'container',
          component: 'Box',
          componentProps: { gap: 4 },
          children: ['city'],
        },
      },
    });
    expect(checkComponentProps(intent, fakeKit, CATALOGS.uiKit)).toEqual([
      'the field «qty» of the array «items»: InputNumber has no prop «step» in componentProps — ' +
        'they would go to the DOM. It has: label, testId, placeholder, min, max.',
      'the container «Box»: Box has no prop «gap» in componentProps — they would go to the DOM. ' +
        'It has: className.',
    ]);
  });

  it('молчит там, где схема кита не про этот узел', () => {
    const intent = intentOf({
      fields: [
        // Атрибуты DOM компонент передаёт дальше.
        {
          name: 'a',
          type: 'number',
          component: 'InputNumber',
          componentProps: { 'data-role': 'x', 'aria-describedby': 'hint' },
        },
        // Нестрогая схема и компонент без схемы.
        { name: 'b', type: 'string', component: 'Loose', componentProps: { any: 1 } },
        { name: 'c', type: 'string', component: 'MyInput', componentProps: { any: 1 } },
      ],
      layoutRoot: {
        // Корень из одних шагов рисует FormWizard: `submitLabel` — его свойство, не Box.
        kind: 'container',
        component: 'Box',
        componentProps: { submitLabel: 'Отправить' },
        children: [
          {
            kind: 'step',
            title: 'Шаг',
            children: [
              // Тег, а не компонент кита.
              {
                kind: 'container',
                component: 'Box',
                htmlTag: 'fieldset',
                componentProps: { legend: 'x' },
                children: ['a', 'b', 'c'],
              },
            ],
          },
        ],
      },
    });
    expect(checkComponentProps(intent, fakeKit, CATALOGS.uiKit)).toEqual([]);
  });

  it('схемы строятся из каталога: имя записи → её propsSchema', () => {
    const kit = uiKitPropsFromCatalog({
      components: [
        { name: 'Rating', role: 'field', propsSchema: strict('label', 'max') },
        { name: 'Broken', role: 'field' },
      ],
    });
    expect(Object.keys(kit!.defaults)).toEqual(['Rating']);
    expect(uiKitPropsFromCatalog({ components: [] })).toBeUndefined();
    expect(uiKitPropsFromCatalog(null)).toBeUndefined();
  });
});

describe('грамматика intent', () => {
  it('раздел components называет каждый компонент кита ровно раз, поля — в inputs и choice [ReFormer-11oe.15]', () => {
    const grammar = intentGrammar(CATALOGS);
    const section = grammar.slice(grammar.indexOf('\n## components'), grammar.indexOf('\n## More'));
    const rows = Object.fromEntries(
      section
        .split('\n')
        .filter((line) => /^[a-z]+: /.test(line))
        .map((line) => {
          const [group, names] = line.split(': ');
          return [group, names.split(' ')];
        })
    );
    const listed = Object.values(rows).flat();
    expect(new Set(listed).size).toBe(listed.length);
    expect([...rows.inputs, ...rows.choice].sort()).toEqual(
      Object.keys(CATALOGS.uiKit.fields).sort()
    );
    // Части составных — в описании корня, служебные обёртки кита (`kit.infra`) — нигде.
    const parts = new Set(Object.values(CATALOGS.uiKit.parts ?? {}).flat());
    const infra = ['FormField', 'FieldFrame', 'AsyncBoundary', 'List'];
    const expected = Object.keys(CATALOGS.uiKit.exports).filter(
      (name) => !parts.has(name) && !infra.includes(name)
    );
    expect([...listed].sort()).toEqual(expected.sort());
    // Страница — не только форма: типографика и отображение в перечне.
    expect(rows.typography).toContain('TypographyH1');
    expect(rows.layout).toEqual(expect.arrayContaining(['Box', 'Section', 'Card', 'Tabs']));
  });
});

describe('настоящие схемы кита — из закоммиченного component-catalog.json', () => {
  it('каталог даёт схемы, строгих среди них — большинство', () => {
    const kit = CATALOGS.uiKitProps;
    expect(kit).toBeDefined();
    const strictCount = Object.values(kit!.defaults).filter(
      (schema) => schema.additionalProperties === false
    ).length;
    expect(strictCount).toBeGreaterThan(100);
  });

  it('пример грамматики и форма кредита проходят без замечаний', () => {
    const kit = CATALOGS.uiKitProps;
    expect(kit).toBeDefined();
    const credit = JSON.parse(
      readFileSync(resolve(here, '../eval/calibration/cases/credit/intent.json'), 'utf-8')
    );
    for (const raw of [GRAMMAR_EXAMPLE, credit]) {
      expect(checkComponentProps(readIntent(raw).intent, kit!, CATALOGS.uiKit)).toEqual([]);
    }
  });

  it('опечатку в свойстве настоящего InputNumber называет', () => {
    const kit = CATALOGS.uiKitProps;
    const intent = intentOf({
      fields: [
        {
          name: 'price',
          type: 'number',
          component: 'InputNumber',
          componentProps: { minValue: 1 },
        },
      ],
    });
    const [note] = checkComponentProps(intent, kit!, CATALOGS.uiKit);
    expect(note).toContain('InputNumber has no prop «minValue»');
    expect(note).toMatch(/It has: .*\bmin\b/);
  });
});
