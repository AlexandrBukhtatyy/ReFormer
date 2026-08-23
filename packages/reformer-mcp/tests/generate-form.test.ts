/**
 * Генерация бандла и кросс-проверка.
 *
 * Ценность здесь не в шаблонах, а в КРОСС-ПРОВЕРКЕ. Форма — это несколько файлов,
 * сгенерированных порознь, и типичная поломка живёт между ними: `$model(discount)` в разметке
 * при отсутствии `discount` в модели, `$component(Slider)` без регистрации, `selector`
 * render-поведения, которого нет в схеме. Каждая из них проходит и ajv, и `tsc`: форма
 * компилируется и молча делает не то. Поэтому каждый код C1..C9 закреплён отдельным кейсом
 * на НАМЕРЕННО рассогласованном intent.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeIntent,
  deriveInterfaceName,
  type FormIntent,
} from '../src/core/generate/form-intent.js';
import {
  buildBundle,
  buildModelTs,
  buildValidationTs,
  buildBehaviorTs,
  buildLayoutJson,
  collectUsedComponents,
} from '../src/core/generate/builders.js';
import { crossCheckBundle } from '../src/core/generate/cross-check.js';
import { generateFormTool, planFormTool } from '../src/core/tools/generate-form';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

/** Согласованный intent: две поля, справочник, правило, вычисление, массив. */
function goodIntent(): FormIntent {
  return normalizeIntent({
    formName: 'Order',
    target: 'renderer-json',
    fields: [
      { name: 'price', type: 'number', component: 'Input', label: 'Цена' },
      { name: 'quantity', type: 'number', component: 'Input' },
      { name: 'total', type: 'number', component: 'Input' },
      { name: 'currency', type: 'string', component: 'Select', optionsSource: 'CURRENCIES' },
    ],
    arrays: [
      {
        name: 'items',
        itemInterfaceName: 'OrderItem',
        itemFields: [{ name: 'sku', type: 'string', component: 'Input' }],
        initialValue: [{ sku: '' }],
      },
    ],
    dataSources: [{ name: 'CURRENCIES' }],
    validation: [{ target: 'price', rules: ['required()', 'min(1)'] }],
    behavior: [
      {
        kind: 'computeFrom',
        target: 'total',
        sources: ['price', 'quantity'],
        expr: 'price * quantity',
      },
    ],
    visibility: [{ selector: 'currency', condition: '!model.price' }],
  });
}

describe('form-intent', () => {
  it('имя интерфейса выводится из имени формы, кириллица даёт честный дефолт', () => {
    expect(deriveInterfaceName('Credit application')).toBe('CreditApplicationShape');
    // `slugify`-подобная латинизация вырезала бы кириллицу в пустую строку — лучше дефолт,
    // чем идентификатор-огрызок.
    expect(deriveInterfaceName('Заявка на кредит')).toBe('FormShape');
  });

  it('массив без initialValue получает пустой и говорит об этом', () => {
    const intent = normalizeIntent({
      formName: 'X',
      arrays: [
        {
          name: 'rows',
          itemInterfaceName: 'Row',
          itemFields: [],
          initialValue: undefined as never,
        },
      ],
    });
    expect(intent.arrays[0].initialValue).toEqual([]);
    expect(intent.warnings.join(' ')).toMatch(/rows.*initialValue/);
  });

  it('пустой intent предупреждает, а не притворяется формой', () => {
    expect(normalizeIntent({ formName: 'X' }).warnings.join(' ')).toMatch(/нет ни одного поля/);
  });
});

describe('builders', () => {
  it('model.ts объявляет интерфейс, элементы массива и начальные значения', () => {
    const ts = buildModelTs(goodIntent());
    expect(ts).toContain('export interface OrderItem');
    expect(ts).toContain('export interface OrderShape');
    expect(ts).toContain('price: number;');
    expect(ts).toContain('items: OrderItem[];');
    expect(ts).toContain('export const initialFormModel');
  });

  it('validation.ts импортирует ТОЛЬКО использованные валидаторы', () => {
    const ts = buildValidationTs(goodIntent());
    expect(ts).toContain("from '@reformer/core/validators'");
    expect(ts).toContain('required');
    expect(ts).toContain('min');
    // Проекты собираются с noUnusedLocals — лишний импорт «на всякий случай» не даст собраться.
    expect(ts).not.toContain('maxLength');
    expect(ts).not.toContain('validateAsync');
  });

  it('behavior.ts импортирует только использованные операторы', () => {
    const ts = buildBehaviorTs(goodIntent());
    expect(ts).toContain('computeFrom');
    expect(ts).not.toMatch(/\bcopyFrom\b/);
    expect(ts).toContain('computeFrom([model.$.price, model.$.quantity], model.$.total');
  });

  it('layout получает testId на каждом листе — этого ждёт e2e POM', () => {
    const json = JSON.parse(buildLayoutJson(goodIntent()));
    const leaf = json.root.children.find((c: { selector?: string }) => c.selector === 'price');
    expect(leaf.componentProps.testId).toBe('price');
    expect(leaf.value).toBe('$model(price)');
  });

  it('контейнеры из layout попадают в набор используемых компонентов', () => {
    // Первая версия собирала компоненты только из полей, и `Box` не попадал в реестр —
    // кросс-проверка честно ловила это как C2.
    expect(collectUsedComponents(goodIntent()).has('Box')).toBe(true);
  });

  it('бандл для renderer-json содержит реестр, для core — нет', () => {
    const json = buildBundle(goodIntent());
    expect(json.files.map((f) => f.path)).toContain('registry.ts');
    const core = buildBundle(normalizeIntent({ ...goodIntent(), target: 'core' }));
    expect(core.files.map((f) => f.path)).not.toContain('registry.ts');
    expect(core.warnings.join(' '), 'ограничение target должно быть названо').toMatch(
      /layout\.json/
    );
  });
});

describe('cross-check', () => {
  const run = (intent: FormIntent) => crossCheckBundle(intent, JSON.parse(buildLayoutJson(intent)));

  it('согласованный бандл проходит', () => {
    const report = run(goodIntent());
    expect(report.errors, report.errors.map((e) => e.message).join('; ')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('C4 — правило на несуществующий путь', () => {
    const intent = goodIntent();
    intent.validation.push({ target: 'discount', rules: ['required()'] });
    expect(run(intent).errors.map((e) => e.code)).toContain('C4');
  });

  it('C5 — поведение читает несуществующее поле', () => {
    const intent = goodIntent();
    intent.behavior.push({ kind: 'copyFrom', target: 'price', sources: ['nope'] });
    expect(run(intent).errors.map((e) => e.code)).toContain('C5');
  });

  it('C6 — селектор видимости отсутствует в разметке (правило было бы no-op)', () => {
    const intent = goodIntent();
    intent.visibility.push({ selector: 'ghost', condition: 'true' });
    const errors = run(intent).errors;
    expect(errors.map((e) => e.code)).toContain('C6');
    expect(errors.find((e) => e.code === 'C6')!.message).toMatch(/no-op/);
  });

  it('C7 — цикл в вычисляемых полях', () => {
    const intent = goodIntent();
    intent.behavior.push({ kind: 'computeFrom', target: 'price', sources: ['total'] });
    const errors = run(intent).errors;
    expect(errors.map((e) => e.code)).toContain('C7');
    expect(errors.find((e) => e.code === 'C7')!.message).toMatch(/Cycle detected/);
  });

  it('C3 — источник данных не объявлен', () => {
    const intent = goodIntent();
    intent.dataSources = [];
    expect(run(intent).errors.map((e) => e.code)).toContain('C3');
  });

  it('C9 — мёртвое объявление это предупреждение, а не ошибка', () => {
    const intent = goodIntent();
    intent.dataSources.push({ name: 'UNUSED' });
    const report = run(intent);
    expect(report.ok).toBe(true);
    expect(report.warnings.map((w) => w.code)).toContain('C9');
  });
});

describe('tools plan_form / generate_form', () => {
  it('plan_form без источника объясняет, что нужно', async () => {
    const { content } = await planFormTool({}, k);
    expect(content[0].text).toMatch(/specPath|description/);
  });

  it('plan_form с несуществующим путём не притворяется, что разобрал', async () => {
    const { content } = await planFormTool({ specPath: 'нет/такого/файла.md' }, k);
    expect(content[0].text).toMatch(/не найдена/);
  });

  it('generate_form без intent объясняет, что нужно', async () => {
    const { content } = await generateFormTool({ intent: undefined as never });
    expect(content[0].text).toMatch(/intent/);
  });

  it('generate_form отдаёт манифест и НЕ пишет на диск', async () => {
    const { content } = await generateFormTool({ intent: goodIntent() });
    const text = content[0].text;
    expect(text).toMatch(/Кросс-проверка пройдена/);
    expect(text).toContain('### `model.ts`');
    expect(text).toContain('### `registry.ts`');
    expect(text, 'контракт scaffolding должен быть назван').toMatch(/на диск не пишет/);
  });

  it('generate_form отдаёт файлы ДАЖЕ при ошибках, но не скрывает их', async () => {
    const intent = goodIntent();
    intent.validation.push({ target: 'ghost', rules: ['required()'] });
    const { content } = await generateFormTool({ intent });
    expect(content[0].text).toMatch(/Кросс-проверка не пройдена/);
    expect(content[0].text).toContain('**C4**');
    expect(content[0].text).toContain('### `model.ts`');
  });
});

describe('layout проходит НАСТОЯЩИЙ валидатор renderer-json', () => {
  // Тест кросс-пакетный, и до сих пор такого здесь не было ни одного: собственный вывод
  // генератор проверял только `crossCheckBundle`, а она структуру узлов renderer-json не знает.
  // Из-за этого форма с массивом уезжала пользователю с отметкой «✅ Кросс-проверка пройдена»
  // и отвергалась ajv-схемой уже у него: шаблон элемента лежал в `item` напрямую вместо
  // `item.$template`, а `initialValue` был списком строк вместо литерала пустого элемента.
  //
  // Локальный `interface JsonNode` в builders.ts с типами пакета не связан, поэтому дрейф
  // контракта компилятор не поймает — ловить его может только такой прогон.
  const validate = async (intent: FormIntent) => {
    const { validateFormSchema } = await import('@reformer/renderer-json/validate');
    return validateFormSchema(JSON.parse(buildLayoutJson(intent)));
  };

  it('форма с массивом валидна', async () => {
    const res = await validate(goodIntent());
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('массив без объявленных начальных строк тоже даёт валидную схему', async () => {
    // Пустой `initialValue` — обычное состояние intent, пришедшего от модели: `normalizeIntent`
    // подставляет `[]` и предупреждает. Пустой элемент обязан синтезироваться из itemFields,
    // иначе первое нажатие «Добавить» упадёт.
    const intent = normalizeIntent({
      formName: 'Order',
      target: 'renderer-json',
      fields: [{ name: 'customer', type: 'string', component: 'Input' }],
      arrays: [
        {
          name: 'items',
          itemInterfaceName: 'OrderItem',
          itemFields: [
            { name: 'sku', type: 'string', component: 'Input' },
            { name: 'qty', type: 'number', component: 'Input' },
            { name: 'gift', type: 'boolean', component: 'Checkbox' },
          ],
          initialValue: [],
        },
      ],
    });

    const res = await validate(intent);
    expect(res.errors).toEqual([]);

    const layout = JSON.parse(buildLayoutJson(intent));
    const arrayNode = layout.root.children.find((c: { array?: string }) => c.array);
    // Пустое значение по типу поля: строка — '', число — null, флаг — false.
    expect(arrayNode.initialValue).toEqual({ sku: '', qty: null, gift: false });
  });

  it('форма без массивов валидна', async () => {
    const intent = normalizeIntent({
      formName: 'Simple',
      target: 'renderer-json',
      fields: [{ name: 'email', type: 'string', component: 'Input', label: 'Email' }],
    });
    const res = await validate(intent);
    expect(res.errors).toEqual([]);
  });
});
