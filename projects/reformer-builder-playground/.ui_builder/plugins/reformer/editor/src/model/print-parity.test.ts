/**
 * Печать документа формы: редактор и кодоген обязаны печатать ОДНИ И ТЕ ЖЕ байты.
 *
 * ## Что здесь удерживается
 *
 * Документ формы пишут трое: кодоген (`schema/form.schema.json` и файлы шагов), редактор схемы
 * (сохранение правки) и ассистент (применение хода). Пока у редактора стоял свой
 * `JSON.stringify(…, null, 2)`, раскладка массивов в одном файле «прыгала» между сохранением и
 * генерацией кода: кодоген клал `"children": ["Отправить"]` в строку, редактор разворачивал по
 * элементу на строку, и сохранённый документ переставал проходить `prettier --check`.
 *
 * Теперь принтер один (`printJson` ядра), и этот файл не даёт печатям разойтись молча. Сверка
 * идёт с настоящим ЭМИТТЕРОМ кодогена (`emitSchema` / `emitStepSchema`), а не с самим принтером:
 * сравнение `printFormSchema` с `printJson` было бы сравнением функции с собой и не заметило бы,
 * что кодоген перешёл на другую печать.
 *
 * Ассистент сверяется с тем же эмиттером на тех же документах ядра в своём пакете
 * (`plugins/reformer/ai/model/schema-text-parity.test`): плагины домена друг друга не
 * импортируют, поэтому общая точка у трёх печатей — кодоген, и равенство каждой из двух ему
 * даёт равенство всех трёх.
 *
 * ## Откуда в сверке два круга
 *
 * Редактор выдаёт узлам `$nodeId` при разборе, а кодоген вставляет кнопку отправки, если её нет
 * в схеме. Поэтому у документа «с нуля» первый круг честно меняет текст — адресами. Устойчивое
 * состояние наступает после него, и сверяется именно оно: документ, сохранённый редактором,
 * кодоген печатает теми же байтами, и наоборот.
 *
 * Prettier здесь — инструмент теста (как в отпечатке кодогена); в рантайм плагина он не попадает.
 *
 * @module plugins/reformer/editor/model/print-parity.test
 */

import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emitSchema, emitStepSchema, prepare, withStep } from '../../../core/codegen';
import { ensureNodeIds, type NodeIdFactory } from '../../../core/form-model';
import {
  builtinKit,
  partsSchema,
  plainSchema,
  richSchema,
  subpathSchema,
  wizardRulesSchema,
  wizardSchema,
} from '../../../core/testing';
import { createFakeSchemaHost } from '../testing';
import { formSchemaComposition } from './composition';
import { indexNodes } from './node-index';
import { setPropOp } from './ops';
import { parseFormSchema, printFormSchema } from './provider';

function sequentialIds(prefix: string): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

/**
 * Документ, собранный под раскладку: массивы примитивов (короткий, числовой, пустой, длинный —
 * не помещающийся в строку, вложенный), массив объектов и вложенные объекты, включая пустой.
 * Кнопка отправки стоит в схеме, а адреса выданы всем узлам: такому документу ни кодоген, ни
 * разбор редактора ничего не дописывают, и первый же круг обязан вернуть те же байты.
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

/** Документы сверки: собранный под раскладку и схемы-образцы ядра (те же, что у ассистента). */
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

describe('печать документа: редактор и кодоген — один принтер', () => {
  it('документ кодогена после «разобрать → напечатать» возвращается байт в байт', () => {
    // Адреса у узлов уже стоят, кнопка отправки в схеме есть: дописывать нечего ни одной стороне.
    const generated = generate(layoutSchema());
    expect(printFormSchema(parseFormSchema(generated))).toBe(generated);
  });

  it.each(DOCUMENTS)(
    '%s: сохранённое редактором кодоген печатает теми же байтами, и наоборот',
    (_name, make) => {
      // Первое сохранение: разбор выдаёт адреса узлам, у которых их нет (в том числе кнопке
      // отправки, которую вставил кодоген).
      const saved = printFormSchema(parseFormSchema(generate(make()), sequentialIds('a')));
      // Генерация кода по сохранённому документу раскладку не трогает…
      const regenerated = generate(parseFormSchema(saved));
      expect(regenerated).toBe(saved);
      // …и следующее сохранение из редактора — тоже.
      expect(printFormSchema(parseFormSchema(regenerated))).toBe(regenerated);
    }
  );

  it('массив без объектов лежит в строку, объекты и массив объектов развёрнуты', () => {
    const text = printFormSchema(layoutSchema());
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
    '%s: напечатанное редактором проходит форматтер репозитория без правок',
    async (_name, make) => {
      const model = parseFormSchema(generate(make()), sequentialIds('a'));
      expect(await passesPrettier(printFormSchema(model))).toBe(true);
    }
  );

  it('правка через ручку документа пишет в буфер ту же раскладку', async () => {
    const host = createFakeSchemaHost({ text: generate(layoutSchema()) });
    const handle = host.modelOf('fake:form.json');
    expect(handle).not.toBeNull();

    const field = indexNodes(handle!.document.getModel()).idAt(['root', 'children', 0]);
    expect(handle!.apply(setPropOp(field!, 'placeholder', 'Выберите город')).status).toBe(
      'applied'
    );

    expect(host.written).toHaveLength(1);
    const [written] = host.written;
    expect(written).toContain('"placeholder": "Выберите город"');
    // Правка одного свойства массивы соседних узлов не переукладывает.
    expect(written).toContain('"accept": [".pdf", ".png", ".jpg"],');
    expect(written).toContain('"children": ["Отправить"]');
    expect(await passesPrettier(written)).toBe(true);
    // И генерация кода после сохранения оставляет файл тем же.
    expect(generate(parseFormSchema(written))).toBe(written);
  });
});

describe('печать файлов шагов: редактор и кодоген — один принтер', () => {
  /** Разбитый по шагам визард так, как его печатает кодоген: корень и файл на каждый шаг. */
  function generateSplit(schema: JsonFormSchema): { root: string; parts: Map<string, string> } {
    const ctx = prepare({ schema, formName: 'anketa', kit, splitSteps: true });
    const parts = new Map<string, string>();
    for (const step of ctx.layout.steps) {
      expect(step.schemaRef, step.title).not.toBeNull();
      parts.set(step.schemaRef as string, emitStepSchema(withStep(ctx, step)));
    }
    return { root: emitSchema(ctx), parts };
  }

  /** Визард с двумя шагами; во втором — текст в `children` и массив примитивов в пропсах. */
  function splitSchema(): JsonFormSchema {
    const schema = wizardRulesSchema();
    const wizard = (schema.root as unknown as { children: { children: unknown[] }[] }).children[0];
    const second = wizard.children[1] as { children: unknown[] };
    second.children.push({
      model: '$model(contacts.channels)',
      component: '$component(CheckboxGroup)',
      componentProps: { label: 'Каналы связи', values: ['почта', 'телефон'], order: [2, 1] },
    });
    second.children.push({ component: '$html(p)', children: ['Мы не передаём контакты'] });
    return ensureNodeIds(schema, sequentialIds('s'));
  }

  const composition = formSchemaComposition();

  it('открыть разбитую форму кодогена и разложить обратно — те же байты корня и шагов', () => {
    const generated = generateSplit(splitSchema());
    expect(generated.parts.size).toBe(2);

    const root = parseFormSchema(generated.root);
    expect(composition.references(root)).toEqual([...generated.parts.keys()]);

    const { model, layout } = composition.compose(root, generated.parts);
    const laid = composition.decompose(model, layout);
    expect(printFormSchema(laid.root)).toBe(generated.root);
    expect([...laid.parts.keys()]).toEqual([...generated.parts.keys()]);
    for (const [ref, text] of generated.parts) expect(laid.parts.get(ref), ref).toBe(text);
  });

  it('«разбить по шагам» в редакторе даёт те же файлы, что печатает кодоген', () => {
    const schema = splitSchema();
    const generated = generateSplit(schema);

    // Тот же документ одним файлом, как его напечатал бы кодоген без разбиения, — и команда
    // редактора «разбить».
    const whole = parseFormSchema(generate(schema));
    const split = composition.decompose(whole, new Map(), 'split');
    expect(printFormSchema(split.root)).toBe(generated.root);
    for (const [ref, text] of generated.parts) expect(split.parts.get(ref), ref).toBe(text);
  });

  it('файл шага: массив примитивов в строку, и форматтер его не трогает', async () => {
    const generated = generateSplit(splitSchema());
    const { model, layout } = composition.compose(parseFormSchema(generated.root), generated.parts);
    const laid = composition.decompose(model, layout);
    const texts = [...laid.parts.values()];
    expect(texts.join('')).toContain('"values": ["почта", "телефон"],');
    expect(texts.join('')).toContain('"order": [2, 1]');
    expect(texts.join('')).toContain('"children": ["Мы не передаём контакты"]');
    for (const text of texts) expect(await passesPrettier(text)).toBe(true);
    expect(await passesPrettier(printFormSchema(laid.root))).toBe(true);
  });
});
