/**
 * `componentProps` в intent против props-схем ui-kit: что `form_build` назовёт незнакомым.
 *
 * Зачем. Грамматика показывает свойства только на примерах, и о полном наборе агент узнаёт из
 * предупреждения сборки. Ложное предупреждение на рабочей форме хуже его отсутствия: агент начнёт
 * «чинить» верный intent. Поэтому, кроме самих чужих ключей, здесь проверено, что пример грамматики
 * и форма кредита из калибровки проходят по настоящим схемам кита без замечаний.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { readIntent } from '../src/core/generate/form-intent';
import { GRAMMAR_EXAMPLE, intentGrammar } from '../src/core/generate/intent-grammar';
import {
  checkComponentProps,
  loadUiKitPropSchemas,
  type UiKitPropSchemas,
} from '../src/core/generate/ui-kit-props';
import { precondition } from './support/preconditions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const strict = (...names: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(names.map((name) => [name, { type: 'string' }])),
});

/** Кит из трёх компонентов: поле, контейнер и нестрогий. */
const fakeKit: UiKitPropSchemas = {
  defaults: {
    InputNumber: strict('placeholder', 'min', 'max'),
    Section: strict('title'),
    Box: strict('className'),
    Loose: { type: 'object', properties: { a: {} } },
  },
  mergeField: (schema) => ({
    ...schema,
    properties: {
      label: {},
      testId: {},
      ...(schema.properties as Record<string, unknown>),
    },
  }),
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
      'поле «price»: у InputNumber нет свойства «minValue» в componentProps. ' +
        'Есть: label, testId, placeholder, min, max.',
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
      'контейнер «main»: у Section нет свойства «label» в componentProps. Есть: title.',
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
      'поле «qty» массива «items»: у InputNumber нет свойства «step» в componentProps. ' +
        'Есть: label, testId, placeholder, min, max.',
      'контейнер «Box»: у Box нет свойства «gap» в componentProps. Есть: className.',
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
});

describe('грамматика intent', () => {
  it('перечисляет каждый компонент поля из каталога ui-kit', () => {
    const line = intentGrammar(CATALOGS)
      .split('\n')
      .find((l) => l.startsWith('- component: '));
    expect(line?.slice('- component: '.length, -1).split(' ')).toEqual(
      Object.keys(CATALOGS.uiKit.fields)
    );
  });
});

const hasKit = precondition(
  'собранный @reformer/ui-kit/meta',
  existsSync(resolve(repoRoot, 'packages/reformer-ui-kit/dist/meta.js')),
  'npm run build -w @reformer/ui-kit'
);

describe.runIf(hasKit)('настоящие схемы кита', () => {
  it('пример грамматики и форма кредита проходят без замечаний', async () => {
    const kit = await loadUiKitPropSchemas();
    expect(kit).toBeDefined();
    const credit = JSON.parse(
      readFileSync(resolve(here, '../eval/calibration/cases/credit/intent.json'), 'utf-8')
    );
    for (const raw of [GRAMMAR_EXAMPLE, credit]) {
      expect(checkComponentProps(readIntent(raw).intent, kit!, CATALOGS.uiKit)).toEqual([]);
    }
  });

  it('опечатку в свойстве настоящего InputNumber называет', async () => {
    const kit = await loadUiKitPropSchemas();
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
    expect(note).toContain('у InputNumber нет свойства «minValue»');
    expect(note).toMatch(/Есть: .*\bmin\b/);
  });
});
