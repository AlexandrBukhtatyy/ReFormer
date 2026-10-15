/**
 * Печать документа формы: ассистент и кодоген обязаны печатать ОДНИ И ТЕ ЖЕ байты.
 *
 * ## Что здесь удерживается
 *
 * Документ формы пишут трое: кодоген (`schema/form.schema.json`), редактор схемы (сохранение
 * правки) и ассистент (применение хода). Шапка `./schema-text` обещает, что печать ассистента
 * совпадает с печатью редактора, — и пока оба держали свой `JSON.stringify(…, null, 2)`, обещание
 * выполнялось, но оба расходились с кодогеном на массивах: тот кладёт `"children": ["Отправить"]`
 * в строку, как форматтер репозитория. Ход ассистента, поменявший одно свойство, переукладывал
 * каждый массив файла, а записанный им документ переставал проходить `prettier --check`.
 *
 * Теперь принтер один (`printJson` ядра), и этот файл не даёт печатям разойтись молча. Сверка
 * идёт с настоящим ЭМИТТЕРОМ кодогена (`emitSchema`), а не с самим принтером: сравнение
 * `printSchemaText` с `printJson` было бы сравнением функции с собой.
 *
 * Редактор сверяется с тем же эмиттером на тех же документах в своём пакете
 * (`plugins/reformer/editor/model/print-parity.test`): плагины домена друг друга не импортируют,
 * поэтому общая точка у трёх печатей — кодоген, и равенство каждой из двух ему даёт равенство
 * всех трёх. Документ под раскладку ({@link layoutSchema}) в обоих файлах один и тот же.
 *
 * Prettier здесь — инструмент теста (как в отпечатке кодогена); в рантайм плагина он не попадает.
 *
 * @module plugins/reformer/ai/model/schema-text-parity.test
 */

import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { emitSchema, prepare } from '../../../core/codegen';
import { emptyRules, ensureNodeIds, type NodeIdFactory } from '../../../core/form-model';
import {
  builtinEntries,
  builtinKit,
  partsSchema,
  plainSchema,
  richSchema,
  subpathSchema,
  wizardSchema,
} from '../../../core/testing';
import { createEditorToolRegistry } from '../index';
import { applyChangeSet } from '../session/apply';
import { createFakeHost } from '../testing';
import { createChangeSet, withOutcome } from './changeset';
import { parseSchemaText, printSchemaText } from './schema-text';

function sequentialIds(prefix: string): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

/**
 * Документ, собранный под раскладку: массивы примитивов (короткий, числовой, пустой, длинный —
 * не помещающийся в строку, вложенный), массив объектов и вложенные объекты, включая пустой.
 * Тот же, что в тесте редактора: кнопка отправки стоит в схеме, адреса выданы всем узлам.
 */
function layoutSchema(): JsonFormSchema {
  const schema = {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      componentProps: { className: 'space-y-4', title: 'Анкета' },
      children: [
        {
          model: '$model(city)',
          component: '$component(Select)',
          componentProps: {
            label: 'Город',
            // Массив объектов: разворачивается всегда.
            options: [
              { value: 'msk', label: 'Москва' },
              { value: 'spb', label: 'Санкт-Петербург' },
            ],
          },
        },
        {
          model: '$model(documents)',
          component: '$component(FileUploadDropzone)',
          componentProps: {
            label: 'Документы',
            // Короткий массив строк — в одну строку.
            accept: ['.pdf', '.png', '.jpg'],
            // Числа — тоже в строку.
            sizes: [1, 2, 3],
            // Пустые массив и объект.
            presets: [],
            meta: {},
            // Вложенные объекты.
            limits: { size: { min: 0, max: 10 }, count: { max: 5 } },
            // Массив массивов.
            grid: [
              [1, 2],
              [3, 4],
            ],
            // Массив, который в строку не помещается.
            hints: [
              'Паспорт: разворот с фотографией и страница с действующей регистрацией',
              'Справка о доходах за последние шесть месяцев по форме банка или 2-НДФЛ',
              'Согласие на обработку персональных данных',
            ],
          },
        },
        {
          model: '$model(contacts)',
          component: '$component(FieldArray)',
          initialValue: {
            tags: ['дом', 'работа'],
            address: { city: 'Москва', geo: [55.75, 37.62] },
          },
          item: {
            $template: {
              component: '$component(Box)',
              componentProps: { className: 'space-y-3' },
              children: [
                {
                  model: '$model(phone)',
                  component: '$component(Input)',
                  componentProps: { label: 'Телефон' },
                },
              ],
            },
          },
          componentProps: { addButtonLabel: '+ Добавить контакт' },
        },
        {
          component: '$component(Button)',
          selector: 'submit',
          componentProps: { type: 'submit' },
          children: ['Отправить'],
        },
      ],
    },
  } as unknown as JsonFormSchema;
  return ensureNodeIds(schema, sequentialIds('n'));
}

/** Документы сверки: собранный под раскладку и схемы-образцы ядра (те же, что у редактора). */
const DOCUMENTS: readonly (readonly [string, () => JsonFormSchema])[] = [
  ['документ под раскладку массивов', layoutSchema],
  ['простая форма', plainSchema],
  ['компоненты за подпутём кита, текст в children', subpathSchema],
  ['источники данных и массив с шаблоном', richSchema],
  ['именованные части документа', partsSchema],
  ['визард', wizardSchema],
];

const kit = builtinKit();

/** Документ формы так, как его печатает кодоген. */
function generate(schema: JsonFormSchema): string {
  return emitSchema(prepare({ schema, formName: 'anketa', kit }));
}

const prettierConfig = (await prettier.resolveConfig(fileURLToPath(import.meta.url))) ?? {};

/** Оставит ли форматтер репозитория текст документа как есть. */
function passesPrettier(text: string): Promise<boolean> {
  return prettier.check(text, { ...prettierConfig, filepath: 'schema/form.schema.json' });
}

describe('печать документа: ассистент и кодоген — один принтер', () => {
  it.each(DOCUMENTS)(
    '%s: документ кодогена после «прочитать → напечатать» возвращается байт в байт',
    (_name, make) => {
      // Ассистент адресов узлам не выдаёт, поэтому круг обязан сойтись с первого раза — в том
      // числе на документе, где кодоген вставил кнопку отправки без `$nodeId`.
      const generated = generate(make());
      expect(printSchemaText(parseSchemaText(generated))).toBe(generated);
    }
  );

  it.each(DOCUMENTS)(
    '%s: напечатанное ассистентом кодоген печатает теми же байтами',
    (_name, make) => {
      const printed = printSchemaText(parseSchemaText(generate(make())));
      expect(generate(parseSchemaText(printed))).toBe(printed);
    }
  );

  it('массив без объектов лежит в строку, объекты и массив объектов развёрнуты', () => {
    const text = printSchemaText(layoutSchema());
    expect(text).toContain('        "children": ["Отправить"]\n');
    expect(text).toContain('          "accept": [".pdf", ".png", ".jpg"],\n');
    expect(text).toContain('          "sizes": [1, 2, 3],\n');
    expect(text).toContain('          "presets": [],\n');
    expect(text).toContain('          "meta": {},\n');
    expect(text).toContain('          "tags": ["дом", "работа"],\n');
    expect(text).toContain('            "geo": [55.75, 37.62]\n');
    // Вложенные объекты — по ключу на строку.
    expect(text).toContain(
      [
        '          "limits": {',
        '            "size": {',
        '              "min": 0,',
        '              "max": 10',
        '            },',
        '            "count": {',
        '              "max": 5',
        '            }',
        '          },',
        '',
      ].join('\n')
    );
    // Массив объектов — по объекту на элемент.
    expect(text).toContain(
      [
        '          "options": [',
        '            {',
        '              "value": "msk",',
        '              "label": "Москва"',
        '            },',
        '',
      ].join('\n')
    );
    // Массив массивов — по вложенному массиву на строку, сами они в строку.
    expect(text).toContain(
      ['          "grid": [', '            [1, 2],', '            [3, 4]', '          ],', ''].join(
        '\n'
      )
    );
    // Не помещающийся в строку массив строк — по элементу на строку.
    expect(text).toContain(
      [
        '          "hints": [',
        '            "Паспорт: разворот с фотографией и страница с действующей регистрацией",',
        '',
      ].join('\n')
    );
    // Прежняя раскладка `JSON.stringify` — элемент массива на своей строке — ушла.
    expect(text).not.toContain('"children": [\n          "Отправить"');
    expect(text).not.toContain('"accept": [\n');
  });

  it.each(DOCUMENTS)(
    '%s: напечатанное ассистентом проходит форматтер репозитория без правок',
    async (_name, make) => {
      expect(await passesPrettier(printSchemaText(make()))).toBe(true);
    }
  );
});

describe('ход ассистента над документом кодогена', () => {
  const RESOURCE = 'form.json';

  /**
   * Форма, которую пропускает строгий гейт применения: только свойства, известные встроенному
   * киту (у `plainSchema` ядра контейнер несёт `title`, которого у `Box` нет). Кнопку отправки
   * с текстом в `children` — массивом примитивов — дописывает сам кодоген.
   */
  function turnSchema(): JsonFormSchema {
    return {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        componentProps: { className: 'space-y-4' },
        children: [
          {
            model: '$model(fullName)',
            component: '$component(Input)',
            componentProps: { label: 'Имя', required: true },
          },
        ],
      },
    } as unknown as JsonFormSchema;
  }

  /** Применить к документу кодогена один настоящий вызов инструмента и вернуть записанный текст. */
  async function applyTurn(generated: string): Promise<string> {
    const host = createFakeHost();
    host.openDocument(RESOURCE, generated);
    const base = parseSchemaText(generated);

    const outcome = await createEditorToolRegistry().invoke(
      'set_node_prop',
      { refs: ['/root/children/0'], props: { placeholder: 'Иванов Иван' } },
      {
        draft: base,
        base,
        rules: emptyRules(),
        catalog: builtinEntries(),
        validateForm: validateFormSchema,
      }
    );
    expect(outcome.error?.code, outcome.text).toBeUndefined();

    const applied = await applyChangeSet(
      { host, validateForm: () => Promise.resolve(validateFormSchema) },
      {
        set: withOutcome(createChangeSet(base, emptyRules()), outcome),
        resource: RESOURCE,
        baseText: generated,
      }
    );
    expect(applied).toEqual({ status: 'applied' });
    expect(host.writes).toHaveLength(1);
    return host.writes[0].text;
  }

  it('правка одного свойства даёт diff на это свойство, а не на весь файл', async () => {
    const generated = generate(turnSchema());
    // Посылка теста: в документе есть массив примитивов, который прежняя печать развернула бы.
    expect(generated).toContain('"children": ["Отправить"]');

    const written = await applyTurn(generated);

    const before = new Set(generated.split('\n'));
    // Новое свойство и запятая у предыдущего — больше в файле не изменилось ничего.
    expect(written.split('\n').filter((line) => !before.has(line))).toEqual([
      '          "required": true,',
      '          "placeholder": "Иванов Иван"',
    ]);
    expect(written).toContain('"children": ["Отправить"]');
  });

  it('записанное ходом проходит форматтер, и кодоген после него печатает те же байты', async () => {
    const written = await applyTurn(generate(turnSchema()));
    expect(await passesPrettier(written)).toBe(true);
    expect(generate(parseSchemaText(written))).toBe(written);
  });
});
