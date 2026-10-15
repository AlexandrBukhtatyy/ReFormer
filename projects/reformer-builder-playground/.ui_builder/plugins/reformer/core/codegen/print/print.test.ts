/**
 * Раскладка кодогена против настоящего prettier.
 *
 * Здесь проверяется не «строка выглядит как ожидалось», а то единственное, ради чего раскладчик
 * существует: напечатанное им prettier репозитория оставляет БЕЗ ИЗМЕНЕНИЙ. Каждый случай
 * печатается, кладётся в файл на свою глубину отступа и прогоняется через форматтер с конфигом
 * репозитория; расхождение — это перенос, который prettier сделал бы иначе.
 *
 * Prettier здесь — инструмент теста: в рантайм плагина он не попадает.
 *
 * @module plugins/reformer/core/codegen/print/print.test
 */

import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import {
  formatBody,
  formatStatement,
  parseExpression,
  printChainCall,
  printConst,
  printImport,
  printJson,
  printLiteral,
  printSignature,
  quote,
} from './js';

const HERE = fileURLToPath(import.meta.url);

async function prettierOptions(parser: string): Promise<prettier.Options> {
  const config = (await prettier.resolveConfig(HERE)) ?? {};
  return { ...config, parser };
}

/** Текст, сдвинутый на `indent` колонок; пустые строки остаются пустыми. */
function shift(text: string, indent: number): string {
  const pad = ' '.repeat(indent);
  return text
    .split('\n')
    .map((row) => (row === '' ? '' : `${pad}${row}`))
    .join('\n');
}

/** Файл, в котором текст лежит на глубине `indent` (0, 2, 4 — вложенные блоки). */
function fileAt(text: string, indent: number): string {
  let body = shift(text, indent);
  for (let depth = indent - 2; depth >= 0; depth -= 2) {
    const pad = ' '.repeat(depth);
    body = `${pad}{\n${body}\n${pad}}`;
  }
  return `${body}\n`;
}

async function expectStable(text: string, indent = 0): Promise<void> {
  const file = fileAt(text, indent);
  const formatted = await prettier.format(file, await prettierOptions('typescript'));
  expect(file).toBe(formatted);
}

const LONG = 'someVeryLongIdentifierName';

describe('formatStatement: вызовы', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['короткий вызов остаётся строкой', 'validate(model.$.fullName, [required(), minLength(2)]);'],
    [
      'две стрелки — аргументы рвутся все',
      'validateWhen(() => model.fullName !== null, () => {\n  validate(model.$.agreed, [required()]);\n});',
    ],
    [
      'стрелка с выражением не «обнимается»',
      'computeFrom([model.$.fullName], model.$.agreed, (fullName) => fullName !== null && fullName.length > 1);',
    ],
    [
      'последний аргумент — массив: обнимается',
      `validate(model.$.${LONG}.${LONG}, [required(), minLength(2), maxLength(120), pattern(/^[a-z]+$/)]);`,
    ],
    [
      'последний аргумент — стрелка с блоком',
      'applyEach(model.$.references, ({ model: item }) => {\n  validate(item.$.name, [required()]);\n});',
    ],
    [
      'стрелка с блоком, первая строка не помещается',
      `onComponentEvent(schema.node('${LONG}-${LONG}-${LONG}'), 'onSubmit', async (values: ${LONG}) => {\n  void values;\n});`,
    ],
    [
      'объект последним аргументом',
      `enableWhen(model.$.${LONG}, () => model.${LONG} !== null, { resetOnDisable: true, debounce: 300 });`,
    ],
    [
      'объект в двойных кавычках из JSON',
      'copyFrom(model.$.shippingAddress, model.$.billingAddress, {"when":"always","debounce":300});',
    ],
    [
      'однострочный блок разворачивается',
      'onChange(model.$.total, (value) => { console.info(value) });',
    ],
    [
      'тернарный оператор телом стрелки берётся в скобки',
      'compute(model.$.total, () => model.qty > 0 ? model.price * model.qty : 0);',
    ],
    [
      'вызов телом стрелки обнимается',
      `hideWhen(schema.node('${LONG}-${LONG}'), () => isSectionHidden(model.${LONG}, form.${LONG}));`,
    ],
    [
      'длинное условие уходит под стрелку',
      `hideWhen(schema.node('${LONG}-section'), () => !model.${LONG} && !model.${LONG}Other && x);`,
    ],
    ['пустой вызов', 'reset();'],
    [
      'числовой массив последним аргументом не обнимается',
      `setRange(model.$.${LONG}.${LONG}.${LONG}, [100000, 200000, 300000, 400000, 500000, 600000]);`,
    ],
  ];
  it.each(cases)('%s', async (_name, code) => {
    for (const indent of [0, 2, 4]) await expectStable(formatStatement(code, { indent }), indent);
  });
});

describe('formatStatement: объявления и return', () => {
  const cases: readonly (readonly [string, string])[] = [
    [
      'объект поля потока',
      `export const formFlow: FormFlowConfig<Form> = {\n  steps: [{ id: 'a-section', rules: aRules }, { id: 'b-section', rules: bRules }],\n};`,
    ],
    [
      'единственный шаг — массив в строку',
      `export const formFlow: FormFlowConfig<Form> = {\n  steps: [{ id: 'a-section', rules: aRules }],\n};`,
    ],
    [
      'единственный шаг с длинными именами',
      `export const formFlow: FormFlowConfig<Form> = {\n  steps: [{ id: '${LONG}-${LONG}-${LONG}-section', rules: ${LONG}${LONG}Rules }],\n};`,
    ],
    [
      'объявление со стрелкой',
      `export const ${LONG}_${LONG} = (_item: unknown, index: number): string => '#' + (index + 1);`,
    ],
    [
      'объявление вызовом',
      `const ${LONG} = defineFormBehavior<${LONG}>(({ model, schema }) => {\n  void model;\n  void schema;\n});`,
    ],
    [
      'длинная строка уходит под оператор',
      `export const HINT = '${'очень длинная подсказка '.repeat(5)}';`,
    ],
    [
      'return с вызовом',
      `return createForm<Form>({ model: createModel(), schema: formSchema, registry: createRegistry(), behavior });`,
    ],
  ];
  it.each(cases)('%s', async (_name, code) => {
    for (const indent of [0, 2]) await expectStable(formatStatement(code, { indent }), indent);
  });

  it('неразобранное возвращается как есть', () => {
    const code = 'if (!ok) {\n  return;\n}';
    expect(formatStatement(code)).toBe(code);
    expect(formatStatement('const broken = (a, b;')).toBe('const broken = (a, b;');
  });
});

describe('formatStatement: текст человека не портится', () => {
  // Условие правила и тело обработчика пишет человек. Укладка обязана менять только раскладку:
  // после форматтера исходный текст и уложенный дают один и тот же файл.
  const cases: readonly (readonly [string, string])[] = [
    [
      'запятая и скобка внутри регулярного выражения — не разделители',
      `validate(model.$.code, [pattern(/^[a-z]{2,3}(,|\\))$/i), required()]);`,
    ],
    [
      'регулярное выражение аргументом верхнего уровня',
      `hideWhen(schema.node('promo'), () => !/^(sale|promo),?/.test(model.code) && ${LONG}.${LONG}.length > 3);`,
    ],
    [
      'деление — не регулярное выражение',
      `compute(model.$.share, () => (model.part / model.total) * 100, { precision: model.digits / 2 });`,
    ],
    [
      'шаблонная строка с подстановкой и скобками',
      'onChange(model.$.name, (value) => { console.info(`имя: ${value.trim()} (${value.length})`, { value }) });',
    ],
    [
      'строки с кавычками обоих видов',
      `validate(model.$.title, [pattern("it's", { message: 'say "hi"' }), maxLength(10)]);`,
    ],
    [
      'вложенные стрелки и вызовы',
      `enableWhen(model.$.items, () => model.items.some((item) => item.tags.includes(model.tag)), { resetOnDisable: true });`,
    ],
    [
      'комментарий в теле обработчика',
      `onComponentEvent(schema.node('save'), 'onClick', async () => {\n  // запятая, скобка ( и кавычка ' в комментарии\n  await save(model.get()); /* и тут ) */\n  done();\n});`,
    ],
    [
      'обобщённый вызов',
      `const ${LONG} = createStore<Map<string, number>>(initial, { name: 'store', devtools: true, persist: false });`,
    ],
  ];
  it.each(cases)('%s', async (_name, code) => {
    const options = await prettierOptions('typescript');
    for (const indent of [0, 2]) {
      const mine = formatStatement(code, { indent });
      expect(await prettier.format(fileAt(mine, indent), options)).toBe(
        await prettier.format(fileAt(code, indent), options)
      );
    }
  });
});

describe('formatBody: строки тела', () => {
  it('операторы укладываются по одному, комментарии и пустые строки сохраняются', async () => {
    const lines = formatBody(
      [
        '// Связи над моделью',
        'computeFrom([model.$.fullName], model.$.agreed, (fullName) => fullName !== null && fullName.length > 1);',
        '',
        'validate(model.$.fullName, [required()]);',
      ],
      { indent: 2 }
    );
    expect(lines).toEqual([
      '// Связи над моделью',
      'computeFrom(',
      '  [model.$.fullName],',
      '  model.$.agreed,',
      '  (fullName) => fullName !== null && fullName.length > 1',
      ');',
      '',
      'validate(model.$.fullName, [required()]);',
    ]);
    await expectStable(lines.join('\n'), 2);
  });
});

describe('printLiteral: значения', () => {
  const values: readonly (readonly [string, unknown])[] = [
    ['плоский объект', { fullName: '', agreed: false, age: null, score: 4.5 }],
    ['вложенные объекты и массивы', { a: { b: { c: [] } }, list: [{ value: 'x', label: 'Икс' }] }],
    ['массив строк в строку', { tags: ['a', 'b', 'c'] }],
    [
      'длинный массив строк рвётся',
      { tags: Array.from({ length: 14 }, (_, i) => `значение-${i}`) },
    ],
    ['числа заполняют строку', { points: Array.from({ length: 60 }, (_, i) => i * 1000) }],
    [
      'массив массивов',
      {
        grid: [
          [1, 2],
          [3, 4],
        ],
        pairs: [['a'], ['b']],
      },
    ],
    ['ключи с дефисом и кириллицей', { 'a-b': 1, имя: 'x', 'data-testid': 'y', valid_name$: true }],
    ['кавычки в строках', { a: "it's", b: 'say "hi"', c: `both ' and "`, d: 'back\\slash\nline' }],
    [
      'длинная строка уходит под ключ',
      { description: 'слово '.repeat(20), id: 'слово '.repeat(20) },
    ],
    ['пустые', { a: {}, b: [], c: '' }],
  ];
  it.each(values)('%s', async (_name, value) => {
    await expectStable(printLiteral(value, { prefix: 'export const X = ', suffix: ';' }));
    await expectStable(
      printLiteral(value, { prefix: 'return ', suffix: ' as Form;', indent: 2 }),
      2
    );
  });

  it('кавычки выбираются по содержимому', () => {
    expect(quote('a')).toBe("'a'");
    expect(quote("it's")).toBe('"it\'s"');
    expect(quote('say "hi"')).toBe('\'say "hi"\'');
    expect(quote(`' "`)).toBe(`'\\' "'`);
  });
});

describe('printConst, printImport, printSignature, printChainCall', () => {
  it('константа-строка', async () => {
    await expectStable(printConst('export const HINT_TEXT', 'значение'));
    await expectStable(printConst('export const HINT_TEXT', 'значение '.repeat(12)));
    await expectStable(printConst('export const LIMIT', 42));
    await expectStable(
      printConst('export const LIST: SelectOption[]', [{ value: 'a', label: 'А' }])
    );
  });

  it('импорт: в строку и по имени на строку', async () => {
    const short = printImport(
      ['defineRegistry', 'type ComponentRegistry'],
      '@reformer/renderer-json'
    );
    expect(short).toBe(
      "import { defineRegistry, type ComponentRegistry } from '@reformer/renderer-json';"
    );
    const long = printImport(
      ['computeFrom', 'defineFormBehavior', 'hideWhen', 'onComponentEvent', 'type BehaviorScope'],
      '@reformer/core/behaviors'
    );
    expect(long.split('\n')).toHaveLength(7);
    await expectStable(short);
    await expectStable(long);
    await expectStable(printImport(['Form'], '../types/form', { kind: 'import type' }));
    await expectStable(
      printImport(
        ['createLongNamedForm', 'createFormBehavior', 'formSchema', LONG],
        './application/create',
        {
          kind: 'export',
        }
      )
    );
  });

  it('заголовок функции', async () => {
    const body = '\n  return undefined as never;\n}';
    for (const type of ['Form', 'ContactForm', 'ZayavkaNaKreditForm', `${LONG}${LONG}Form`]) {
      await expectStable(
        printSignature(
          `export function create${type}Model`,
          [`initial?: Partial<${type}>`],
          `: FormModel<${type}> {`
        ) + body
      );
      await expectStable(
        printSignature(
          'export function behaviorRules',
          [`{ model, form, schema }: BehaviorScope<${type}>`],
          ': void {'
        ) + body
      );
      await expectStable(
        printSignature(
          'export function wireSubmit',
          [`{ model, schema }: BehaviorScope<${type}>`, '{ onResult }: SubmitOptions = {}'],
          ': void {'
        ) + body
      );
    }
  });

  it('цепочка с объектом в конце', async () => {
    const node = (props: string) => parseExpression(props) as never;
    await expectStable(
      printChainCall("schema.node('ref-name').patchProps", node("{ placeholder: 'Имя' }"), {
        indent: 2,
      }),
      2
    );
    await expectStable(
      printChainCall(
        "schema.node('full-name').patchProps",
        node("{ placeholder: 'Иванов Иван', maxLength: 64, disabled: !form.agreed.value.value }"),
        { indent: 2 }
      ),
      2
    );
  });
});

describe('printJson', () => {
  const values: readonly (readonly [string, unknown])[] = [
    [
      'документ формы',
      {
        $schema: './form-schema.schema.json',
        format: 2,
        root: {
          component: '$component(Box)',
          componentProps: { className: 'space-y-4' },
          children: [
            { component: '$component(Button)', children: ['Отправить'] },
            { model: '$model(tags)', componentProps: { options: ['a', 'b'], empty: [], none: {} } },
          ],
        },
      },
    ],
    ['длинный массив строк', { accept: Array.from({ length: 20 }, (_, i) => `image/type-${i}`) }],
    ['числа', { marks: Array.from({ length: 50 }, (_, i) => i * 500), pair: [1, 2] }],
    [
      'массив массивов',
      {
        rows: [
          [1, 2],
          [3, 4],
        ],
        one: [['a']],
      },
    ],
    ['длинная строка не переносится', { text: 'слово '.repeat(30) }],
  ];
  it.each(values)('%s', async (_name, value) => {
    const text = printJson(value);
    expect(JSON.parse(text)).toEqual(value);
    expect(await prettier.format(text, await prettierOptions('json'))).toBe(text);
  });
});
