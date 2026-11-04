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
import { CATALOGS } from './support/catalogs';
import {
  normalizeIntent,
  readIntent,
  deriveComponentName,
  deriveInterfaceName,
  type FormIntent,
  type LayoutNode,
  type ValidationRuleIntent,
} from '../src/core/generate/form-intent.js';
import {
  buildAssemblyTsx,
  buildBundle,
  buildModelTs,
  buildValidationTs,
  buildValidationSchemaTs,
  buildBehaviorTs,
  collectUsedComponents,
  renderLayoutChecklist,
} from '../src/core/generate/builders.js';
import { crossCheckBundle } from '../src/core/generate/cross-check.js';
import { groupUiKitImports } from '../src/core/generate/ui-kit-components.js';
import { buildFormSchemaJson } from '../src/core/generate/schema-emit.js';
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
  it('имя интерфейса выводится из имени формы, кириллица — транслитом, как в конструкторе', () => {
    expect(deriveInterfaceName('Credit application')).toBe('CreditApplicationShape');
    // Прежний дефолт `FormShape` для любого кириллического названия давал безликие имена и
    // компонент `FormShapeForm` (калибровка, трек T2). Таблица — та же, что у кодогенерации
    // конструктора: «Заявка на кредит» там — `ZayavkaNaKreditForm`.
    expect(deriveInterfaceName('Заявка на кредит')).toBe('ZayavkaNaKreditShape');
    expect(deriveComponentName('Заявка на кредит')).toBe('ZayavkaNaKreditForm');
    expect(deriveComponentName('RegistrationForm')).toBe('RegistrationForm');
    // Название без букв — по-прежнему дефолт, а не огрызок.
    expect(deriveInterfaceName('—')).toBe('FormShape');
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
  it('model.ts объявляет тип формы, элементы массива и начальные значения', () => {
    const ts = buildModelTs(goodIntent());
    // Генератор печатает `type`: единый стиль сгенерированных типов, чтобы снимки и примеры
    // не расходились. Ядро принимает и `interface` (ограничения `Record<string, unknown>` на
    // FormGroup<T> / FormArray<T> нет) — это правило стиля генератора, а не требование типов.
    expect(ts).toContain('export type OrderItem = {');
    expect(ts).toContain('export type OrderShape = {');
    expect(ts, 'генератор печатает type, а не interface').not.toMatch(
      /export interface (OrderItem|OrderShape)/
    );
    expect(ts).toContain('price: number;');
    expect(ts).toContain('items: OrderItem[];');
    expect(ts).toContain('export const createFormModel = () =>');
  });

  /**
   * Замер показал три места, где генератор молча расходился с каноном и с самим intent'ом
   * (`.tmp/verdicts/b2-generate-form-antipattern-invalid-ts.md`). Все три не ловились ничем:
   * кросс-проверка сверяет файлы между собой, а они были согласованно неверны.
   *
   * Разметка — документ формата 2 из `buildFormSchemaJson`: его `generate_form` кладёт в
   * `form.schema.ts` и его же передаёт кросс-проверке.
   */
  describe('layout соответствует канону renderer-json', () => {
    const schemaDoc = (intent: FormIntent) => JSON.parse(buildFormSchemaJson(intent));
    const layout = (intent: FormIntent) => schemaDoc(intent).root;

    it('шаги — дети узла FormWizard, а не componentProps.steps', () => {
      const intent = normalizeIntent({
        formName: 'Order',
        target: 'renderer-json',
        fields: [{ name: 'price', type: 'number', component: 'Input' }],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'step', title: 'Шаг 1', children: [{ kind: 'field', ref: 'price' }] }],
        },
      });
      const root = layout(intent);
      // Формат 2: библиотечный `FormWizard` строит шаги из узлов-детей. Шаги в
      // `componentProps.steps` и прикладной шим `Wizard` — прежний формат 1.
      expect(root.component).toBe('$component(FormWizard)');
      expect(root.componentProps?.steps, 'шагов в componentProps быть не должно').toBeUndefined();
      expect(root.children, 'шаги обязаны быть детьми визарда').toHaveLength(1);
      const [step] = root.children;
      expect(step.component).toBe('$component(Step)');
      expect(step.componentProps).toEqual({ title: 'Шаг 1' });
      expect(step.children.map((c: { model?: string }) => c.model)).toEqual(['$model(price)']);
    });

    it('selector массива из layoutRoot не подменяется именем массива', () => {
      const intent = normalizeIntent({
        formName: 'Order',
        target: 'renderer-json',
        fields: [],
        arrays: [
          {
            name: 'items',
            itemInterfaceName: 'OrderItem',
            initialValue: [],
            itemFields: [{ name: 'sku', type: 'string', component: 'Input' }],
          },
        ],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'array', ref: 'items', selector: 'items-array' }],
        },
      });
      // Подмена ломала адресацию из behavior/visibility: правило ссылалось на selector,
      // которого после генерации в разметке не оказывалось.
      expect(layout(intent).children[0].selector).toBe('items-array');
    });

    it('testId выводится из пути модели, одноимённые листья разных массивов не сталкиваются', () => {
      const intent = normalizeIntent({
        formName: 'Loan',
        target: 'renderer-json',
        fields: [],
        arrays: [
          {
            name: 'properties',
            itemInterfaceName: 'PropertyItem',
            initialValue: [],
            itemFields: [{ name: 'type', type: 'string', component: 'Select' }],
          },
          {
            name: 'existingLoans',
            itemInterfaceName: 'LoanItem',
            initialValue: [],
            itemFields: [{ name: 'type', type: 'string', component: 'Select' }],
          },
        ],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [
            { kind: 'array', ref: 'properties' },
            { kind: 'array', ref: 'existingLoans' },
          ],
        },
      });
      const doc = schemaDoc(intent);
      // Строка массива — именованная часть документа: узел ссылается на неё `$part(имя)`.
      const ids = doc.root.children.map((c: { item: string }) => {
        const part = /^\$part\((.+)\)$/.exec(c.item)?.[1] ?? '';
        return doc.parts[part]?.children[0].componentProps.testId;
      });
      // Раньше оба давали `type`, селектор разрешался в два элемента и playwright падал.
      expect(ids).toEqual(['properties-type', 'existingLoans-type']);
    });

    it('дубль testId — ошибка кросс-проверки, а не «✅ пройдена»', () => {
      const report = crossCheckBundle(
        normalizeIntent({
          formName: 'X',
          fields: [
            { name: 'a', type: 'string', component: 'Input' },
            { name: 'b', type: 'string', component: 'Input' },
          ],
        }),
        {
          format: 2,
          root: {
            component: '$component(Box)',
            children: [
              {
                model: '$model(a)',
                component: '$component(Input)',
                componentProps: { testId: 'x' },
              },
              {
                model: '$model(b)',
                component: '$component(Input)',
                componentProps: { testId: 'x' },
              },
            ],
          },
        }
      );
      expect(report.errors.map((e) => e.code)).toContain('C10');
    });

    it('initialValue поля элемента массива не затирается пустышкой по типу', () => {
      const intent = normalizeIntent({
        formName: 'Order',
        target: 'renderer-json',
        fields: [],
        arrays: [
          {
            name: 'properties',
            itemInterfaceName: 'PropertyItem',
            initialValue: [],
            itemFields: [
              { name: 'type', type: 'string', component: 'Select', initialValue: 'apartment' },
              { name: 'estimatedValue', type: 'number', component: 'Input', initialValue: 0 },
            ],
          },
        ],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'array', ref: 'properties' }],
        },
      });
      // Формат 2: узел массива `initialValue` не несёт — шаблон нового элемента объявлен в
      // модели (`arrayOf(blank…)`), и значения полей элемента обязаны дойти туда.
      expect(layout(intent).children[0].initialValue).toBeUndefined();
      const model = buildModelTs(intent);
      expect(model).toContain('properties: arrayOf(blankPropertyItem),');
      // `type` различает исход: пустышка по типу дала бы `''`.
      expect(model).toMatch(
        /const blankPropertyItem = \(\): PropertyItem => \(\{\s+type: "apartment",\s+estimatedValue: 0,\s+\}\);/
      );
    });
  });

  it('validation.ts импортирует ТОЛЬКО использованные валидаторы', () => {
    const ts = buildValidationTs(goodIntent(), CATALOGS.core);
    expect(ts).toContain("from '@reformer/core/validators'");
    expect(ts).toContain('required');
    expect(ts).toContain('min');
    // Проекты собираются с noUnusedLocals — лишний импорт «на всякий случай» не даст собраться.
    expect(ts).not.toContain('maxLength');
    expect(ts).not.toContain('validateAsync');
  });

  describe('buildValidationSchemaTs — одна схема над подмножеством правил', () => {
    const MIX: ValidationRuleIntent[] = [
      { target: 'name', rules: ['required', 'minLength(2)'] },
      { target: 'email', rules: ['required', 'email()'], async: 'checkEmail' },
      { target: 'inn', rules: ['minLength(10)'], when: 'model.type.value === "legal"' },
      { target: 'amount', each: 'items', rules: ['required', 'min(1)'] },
      { target: 'x', rules: [], async: 'checkX' },
    ];

    it('validation.ts после выделения — байт-в-байт прежний (закреплённый вывод)', () => {
      // Вывод снят с `buildValidationTs` ДО выделения общей части и вставлен сюда целиком:
      // билдер кладёт этот файл в проекты пользователей, и любая «косметика» в нём — дифф
      // у каждого, кто перегенерирует форму.
      const ts = buildValidationTs(
        normalizeIntent({ formName: 'Mix', interfaceName: 'MixForm', validation: MIX }),
        CATALOGS.core
      );
      expect(ts).toBe(
        [
          '/**',
          ' * Валидация формы «Mix» — правила над МОДЕЛЬЮ, не в layout-схеме.',
          ' * Запуск: validateModel(model, formValidation).',
          ' */',
          "import { validate, defineValidation, validateAsync, validateWhen, applyEach } from '@reformer/core/validation';",
          "import { email, min, minLength, required } from '@reformer/core/validators';",
          "import type { MixForm } from './model';",
          '',
          'export const formValidation = defineValidation<MixForm>(({ model }) => {',
          '  validate(model.$.name, [required(), minLength(2)]);',
          '  validate(model.$.email, [required(), email()]);',
          '  validateAsync(model.$.email, [checkEmail]);',
          '  validateWhen(() => model.type.value === "legal", () => {',
          '    validate(model.$.inn, [minLength(10)]);',
          '  });',
          '  applyEach(model.$.items, ({ model: item }) => {',
          '    validate(item.$.amount, [required(), min(1)]);',
          '  });',
          '  validateAsync(model.$.x, [checkX]);',
          '});',
          '',
        ].join('\n')
      );
      const empty = buildValidationTs(
        normalizeIntent({ formName: 'Empty', interfaceName: 'EmptyForm', validation: [] }),
        CATALOGS.core
      );
      expect(empty).toBe(
        [
          '/**',
          ' * Валидация формы «Empty» — правила над МОДЕЛЬЮ, не в layout-схеме.',
          ' * Запуск: validateModel(model, formValidation).',
          ' */',
          "import { validate, defineValidation } from '@reformer/core/validation';",
          "import type { EmptyForm } from './model';",
          '',
          'export const formValidation = defineValidation<EmptyForm>(({ model }) => {',
          '  // Правил в intent не было — добавьте их здесь.',
          '});',
          '',
        ].join('\n')
      );
    });

    it('buildValidationTs — та же функция с именами корня', () => {
      const intent = normalizeIntent({
        formName: 'Mix',
        interfaceName: 'MixForm',
        validation: MIX,
      });
      const viaSchema = buildValidationSchemaTs(intent.validation, {
        interfaceName: 'MixForm',
        exportName: 'formValidation',
        typeImport: './model',
        header:
          'Валидация формы «Mix» — правила над МОДЕЛЬЮ, не в layout-схеме.\n' +
          'Запуск: validateModel(model, formValidation).',
      });
      expect(viaSchema).toBe(buildValidationTs(intent, CATALOGS.core));
    });

    it('модуль шага: своё имя экспорта, свой путь до типа, импорты ровно под свои правила', () => {
      const ts = buildValidationSchemaTs([MIX[0]], {
        interfaceName: 'MixForm',
        exportName: 'stepValidation',
        typeImport: '../../types',
      });
      expect(ts).toBe(
        [
          "import { validate, defineValidation } from '@reformer/core/validation';",
          "import { minLength, required } from '@reformer/core/validators';",
          "import type { MixForm } from '../../types';",
          '',
          'export const stepValidation = defineValidation<MixForm>(({ model }) => {',
          '  validate(model.$.name, [required(), minLength(2)]);',
          '});',
          '',
        ].join('\n')
      );
      // Сборка корня — дело потребителя: ни apply, ни makeStepCheck здесь нет.
      expect(ts).not.toMatch(/makeStepCheck|makeValidationConfig|apply/);
    });

    it('операторы берутся по подмножеству: applyEach/validateWhen только когда нужны', () => {
      const opts = { interfaceName: 'T', exportName: 'v', typeImport: './types' };
      const eachOnly = buildValidationSchemaTs([MIX[3]], opts);
      expect(eachOnly).toContain('import { validate, defineValidation, applyEach } from');
      expect(eachOnly).not.toContain('validateWhen');
      expect(eachOnly).not.toContain('validateAsync');
      const header = buildValidationSchemaTs([], {
        ...opts,
        header: 'Шаг «Контакты».\n\nПравила полей.',
      });
      expect(header.startsWith('/**\n * Шаг «Контакты».\n *\n * Правила полей.\n */\n')).toBe(true);
    });

    it('правило строки с условием: validateWhen оборачивает привязку applyEach', () => {
      // Условие записано над корневой моделью. Раньше ветка строки собирала блок заново из
      // проверок и выбрасывала обёртку: правило становилось безусловным, а импорт `validateWhen`
      // оставался неиспользованным — модуль не компилировался под `noUnusedLocals`.
      const ts = buildValidationSchemaTs(
        [
          {
            target: 'items.amount',
            each: 'items',
            rules: ['required'],
            async: 'checkAmount',
            when: 'model.hasItems',
          },
        ],
        { interfaceName: 'T', exportName: 'v', typeImport: './types' }
      );

      expect(ts).toContain(
        [
          '  validateWhen(() => model.hasItems, () => {',
          '    applyEach(model.$.items, ({ model: item }) => {',
          '      validate(item.$.amount, [required()]);',
          '      validateAsync(item.$.amount, [checkAmount]);',
          '    });',
          '  });',
        ].join('\n')
      );
      // Цель полным путём срезается до пути от строки: `item.$.items.amount` у строки нет.
      expect(ts).not.toContain('item.$.items');
    });

    it('кросс-полевое правило: cross над снимком формы, параметр схемы — только когда нужен', () => {
      const opts = { interfaceName: 'T', exportName: 'v', typeImport: './types' };
      const ts = buildValidationSchemaTs(
        [
          {
            target: 'confirm',
            rules: [],
            cross: 'values.confirm === values.password',
            code: 'passwordMismatch',
          },
        ],
        opts
      );
      expect(ts).toContain('defineValidation<T>(({ model, cross }) => {');
      expect(ts).toContain(
        "cross(model.$.confirm, (values) => ((values.confirm === values.password) ? null : { code: 'passwordMismatch' }));"
      );
      // Без кросс-полевых правил параметр не объявляется: noUnusedLocals.
      expect(buildValidationSchemaTs([MIX[0]], opts)).toContain('(({ model }) => {');
    });

    it('кросс-полевое правило строки: свой cross у applyEach, код по умолчанию', () => {
      const ts = buildValidationSchemaTs(
        [{ target: 'items.to', each: 'items', rules: [], cross: 'values.to >= values.from' }],
        { interfaceName: 'T', exportName: 'v', typeImport: './types' }
      );
      expect(ts).toContain('defineValidation<T>(({ model }) => {');
      expect(ts).toContain('applyEach(model.$.items, ({ model: item, cross }) => {');
      expect(ts).toContain(
        "cross(item.$.to, (values) => ((values.to >= values.from) ? null : { code: 'cross' }));"
      );
    });
  });

  describe('правило валидации: кросс-полевое, код и текст замечания', () => {
    it('правило из одной кросс-полевой проверки законно; код и текст читаются', () => {
      const { intent } = readIntent({
        formName: 'Pw',
        interfaceName: 'PwForm',
        validation: [
          {
            target: 'confirm',
            cross: 'values.confirm === values.password',
            code: 'passwordMismatch',
            message: 'Пароли не совпадают',
          },
        ],
      });
      expect(intent.validation).toEqual([
        {
          target: 'confirm',
          rules: [],
          cross: 'values.confirm === values.password',
          code: 'passwordMismatch',
          message: 'Пароли не совпадают',
        },
      ]);
    });
  });

  it('behavior.ts импортирует только использованные операторы', () => {
    const ts = buildBehaviorTs(goodIntent());
    expect(ts).toContain('computeFrom');
    expect(ts).not.toMatch(/\bcopyFrom\b/);
    expect(ts).toContain('computeFrom([model.$.price, model.$.quantity], model.$.total');
  });

  describe('поведение строк массива', () => {
    function rowsIntent(): FormIntent {
      const intent = goodIntent();
      intent.behavior = [
        {
          kind: 'computeFrom',
          each: 'items',
          target: 'items.lineTotal',
          sources: ['items.qty', 'items.price'],
          expr: 'qty * price',
        },
        { kind: 'enableWhen', each: 'items', target: 'note', sources: [], expr: 'item.qty > 0' },
        { kind: 'exclusiveFlag', each: 'items', target: 'items.primary', sources: [] },
        {
          kind: 'aggregateInto',
          target: 'items',
          sources: [],
          expr: 'rows.length ? [{ index: rows.length - 1, patch: { qty: 1 } }] : []',
        },
      ];
      return intent;
    }

    it('связи одной строки — одним applyEach, ручки от строки', () => {
      const ts = buildBehaviorTs(rowsIntent());
      expect(ts).toContain(
        [
          '  applyEach(model.$.items, defineFormBehavior(({ model: item }) => {',
          '    computeFrom([item.$.qty, item.$.price], item.$.lineTotal, (qty, price) => qty * price);',
          '    enableWhen(item.$.note, () => item.qty > 0);',
          '  }));',
        ].join('\n')
      );
      expect(ts).toMatch(/import \{ defineFormBehavior, .*applyEach.* \} from/);
    });

    it('флаг одной строки и итог по строкам — операторы над массивом целиком', () => {
      const ts = buildBehaviorTs(rowsIntent());
      expect(ts).toContain('  exclusiveFlag(model.$.items, (row) => row.$.primary);');
      expect(ts).toContain(
        '  aggregateInto(model.$.items, (rows) => rows.length ? [{ index: rows.length - 1, patch: { qty: 1 } }] : []);'
      );
      expect(ts).toMatch(/import \{[^}]*aggregateInto[^}]*exclusiveFlag[^}]*\} from/);
    });

    it('вход читает each и новые виды', () => {
      const { intent } = readIntent({
        formName: 'Rows',
        behavior: [
          { kind: 'exclusiveFlag', each: 'contacts', target: 'contacts.primary' },
          { kind: 'aggregateinto', target: 'rows', expr: '[]' },
        ],
      });
      expect(intent.behavior).toEqual([
        { kind: 'exclusiveFlag', each: 'contacts', target: 'contacts.primary', sources: [] },
        { kind: 'aggregateInto', target: 'rows', sources: [], expr: '[]' },
      ]);
    });
  });

  it('resetWhen по полю без null получает resetValue — начальное значение поля [ReFormer-2183]', () => {
    // Без resetValue ядро пишет null, и для поля без null в типе он обязателен по типу.
    const intent = goodIntent();
    intent.fields.push({ name: 'note', type: 'number', component: 'Input', initialValue: null });
    intent.behavior.push(
      { kind: 'resetWhen', target: 'currency', sources: [], expr: '!model.price' },
      { kind: 'resetWhen', target: 'quantity', sources: [], expr: '!model.price' },
      { kind: 'resetWhen', target: 'note', sources: [], expr: '!model.price' },
      {
        kind: 'resetWhen',
        target: 'price',
        sources: [],
        expr: 'false',
        options: { resetValue: 1 },
      }
    );
    const ts = buildBehaviorTs(intent);

    // `currency` необязательна: в её типе есть `null` (ReFormer-b464), и `resetValue` не нужен.
    expect(ts).toContain('resetWhen(model.$.currency, () => !model.price);');
    expect(ts).toContain('resetWhen(model.$.quantity, () => !model.price, { resetValue: 0 });');
    expect(ts).toContain('resetWhen(model.$.note, () => !model.price);');
    expect(ts).toContain('resetWhen(model.$.price, () => false, {"resetValue":1});');
  });

  it('цель compute — узел disabled, componentProps.disabled переезжает на узел [ReFormer-j356.6]', () => {
    // Обёртка поля затирает componentProps.disabled состоянием узла: на core вычисляемый `total`
    // оставался редактируемым в 3 из 3 прогонов. Блокирует ключ узла.
    const intent = normalizeIntent({
      formName: 'Order',
      fields: [
        { name: 'price', type: 'number', component: 'InputNumber' },
        { name: 'total', type: 'number', component: 'InputNumber' },
        { name: 'note', type: 'string', component: 'Input', componentProps: { disabled: true } },
        { name: 'discount', type: 'number', component: 'InputNumber' },
      ],
      arrays: [
        {
          name: 'rows',
          itemInterfaceName: 'Row',
          initialValue: [],
          itemFields: [
            { name: 'qty', type: 'number', component: 'InputNumber' },
            { name: 'sum', type: 'number', component: 'InputNumber' },
          ],
        },
      ],
      behavior: [
        { kind: 'computeFrom', target: 'total', sources: ['price'], expr: 'price * 2' },
        { kind: 'compute', target: 'sum', each: 'rows', sources: [], expr: 'model.qty * 2' },
        // Вычисляемое, но включаемое правилом — блокирует правило, а не узел.
        { kind: 'compute', target: 'discount', sources: [], expr: '0' },
        { kind: 'enableWhen', target: 'discount', sources: [], expr: 'model.price > 10' },
      ],
    });
    const json = JSON.parse(buildFormSchemaJson(intent));
    const node = (selector: string) =>
      json.root.children.find((c: { selector?: string }) => c.selector === selector);
    expect(node('total').disabled).toBe(true);
    expect(node('note')).toMatchObject({ disabled: true });
    expect(node('note').componentProps).not.toHaveProperty('disabled');
    expect(node('price')).not.toHaveProperty('disabled');
    expect(node('discount')).not.toHaveProperty('disabled');
    const row = Object.values(
      json.parts as Record<string, { children: { selector: string }[] }>
    )[0];
    expect(row.children.find((c) => c.selector === 'sum')).toMatchObject({ disabled: true });
    expect(row.children.find((c) => c.selector === 'qty')).not.toHaveProperty('disabled');
  });

  it('layout получает testId на каждом листе — этого ждёт e2e POM', () => {
    const json = JSON.parse(buildFormSchemaJson(goodIntent()));
    const leaf = json.root.children.find((c: { selector?: string }) => c.selector === 'price');
    expect(leaf.componentProps.testId).toBe('price');
    // Формат 2: привязка одним ключом `model`; `value` — ключ прежнего формата.
    expect(leaf.model).toBe('$model(price)');
    expect(leaf).not.toHaveProperty('value');
  });

  it('контейнеры из layout попадают в набор используемых компонентов', () => {
    // Первая версия собирала компоненты только из полей, и `Box` не попадал в реестр —
    // кросс-проверка честно ловила это как C2.
    expect(collectUsedComponents(goodIntent()).has('Box')).toBe(true);
  });

  it('бандл для renderer-json содержит реестр, для core — нет', () => {
    const json = buildBundle(goodIntent(), CATALOGS);
    expect(json.files.map((f) => f.path)).toContain('registry.ts');
    // Валидация — тоже артефакт формы: `form.validation.ts`, прежний `validation.ts` не печатается.
    expect(json.files.map((f) => f.path)).toContain('form.validation.ts');
    expect(json.files.map((f) => f.path)).not.toContain('validation.ts');
    // Схема отдаётся каноничным `form.schema.ts`, а не `.json`: предупреждение о потере
    // типизации читают не все, а блок кода из манифеста копируют все.
    const schema = json.files.find((f) => f.path === 'form.schema.ts');
    expect(schema, 'схема renderer-json отдаётся как form.schema.ts').toBeDefined();
    expect(schema?.content).toContain(`defineJsonSchema<${deriveInterfaceName('Order')}>(`);
    expect(json.files.map((f) => f.path)).not.toContain('form.schema.json');
    const core = buildBundle(normalizeIntent({ ...goodIntent(), target: 'core' }), CATALOGS);
    expect(core.files.map((f) => f.path)).not.toContain('registry.ts');
    // Схема одна на все таргеты: `core` получает ту же `form.schema.ts`, а не `layout.json`
    // с просьбой перенести разметку руками.
    expect(core.files.map((f) => f.path)).toContain('form.schema.ts');
    expect(core.files.map((f) => f.path)).not.toContain('layout.json');
    expect(core.warnings.join(' '), 'ограничение target должно быть названо').toMatch(
      /правила узлов схемы исполняет рендерер/
    );
  });

  it('чек-лист раскладки печатает канон, а вариант имени засчитывает канонической строке', () => {
    // Генератор отдаёт схему renderer-json как канонический `.ts`, но `.json` остаётся
    // допустимым вариантом — консумент может прийти с ним. Строка в таблице обязана остаться
    // канонической, иначе чек-лист переучивает консумента на вариант.
    const out = renderLayoutChecklist('renderer-json', ['model.ts', 'form.schema.json']);
    expect(out).toMatch(/`form\.schema\.ts`.*сгенерирован ниже как `form\.schema\.json`/);
    // Несгенерированные файлы названы поимённо — это и есть сигнал неполноты, которого не было.
    expect(out).toMatch(/`registry\.ts`.*создайте сами/);
    expect(out).toContain('find_recipe directory-layout');
    // У core рендер-слоя нет: иначе консумент создаст мёртвый файл.
    expect(renderLayoutChecklist('core', [])).not.toContain('form.render.ts');
    // Раскладка шагов названа поимённо — иначе агент заводит `components/steps/Step1.tsx`.
    expect(out).toContain('steps/index.ts');
    expect(out).toContain('steps/<slug>/');
  });

  // Калибровка по форме регистрации (eval/calibration): без словаря форма показывала пользователю
  // код замечания (`passwords-mismatch`) — `message` из intent принимался и терялся.
  it('тексты замечаний из intent — словарь form.messages.ts и провайдер в образце сборки', () => {
    const intent = normalizeIntent({
      formName: 'Signup',
      target: 'renderer-react',
      fields: [
        { name: 'phone', type: 'string', component: 'Input' },
        { name: 'password', type: 'string', component: 'InputPassword' },
        { name: 'confirm', type: 'string', component: 'InputPassword' },
        { name: 'nick', type: 'string', component: 'Input' },
      ],
      validation: [
        {
          target: 'phone',
          rules: ["required({ code: 'phone.required' })"],
          message: 'Укажите телефон',
        },
        {
          target: 'confirm',
          rules: [],
          cross: 'values.confirm === values.password',
          code: 'passwords-mismatch',
          message: 'Пароли не совпадают',
        },
        // Текст без кода, и в вызовах кодов два — привязать не к чему.
        {
          target: 'nick',
          rules: ["required({ code: 'a' })", "minLength(2, { code: 'b' })"],
          message: 'Ник?',
        },
      ],
    });
    const bundle = buildBundle(intent, CATALOGS);
    const messages = bundle.files.find((f) => f.path === 'form.messages.ts')?.content ?? '';
    expect(messages).toContain('export const formMessages = defineIssueMessages({');
    expect(messages).toContain("'phone.required': 'Укажите телефон'");
    expect(messages).toContain("'passwords-mismatch': 'Пароли не совпадают'");
    expect(bundle.warnings.join(' ')).toMatch(/«Ник\?».*задайте правилу `code`/);

    const assembly = buildAssemblyTsx(intent);
    expect(assembly).toContain("import { formMessages } from './form.messages';");
    expect(assembly).toContain('<ValidationMessagesProvider messages={formMessages}>');
    // Без текстов — ни файла, ни провайдера.
    const plain = normalizeIntent({
      ...intent,
      validation: [{ target: 'phone', rules: ['required()'] }],
    });
    expect(buildBundle(plain, CATALOGS).files.map((f) => f.path)).not.toContain('form.messages.ts');
    expect(buildAssemblyTsx(plain)).not.toContain('ValidationMessagesProvider');
  });

  it('выражение поведения видит form, когда к нему обращается', () => {
    const intent = normalizeIntent({
      formName: 'Signup',
      target: 'renderer-react',
      fields: [
        { name: 'password', type: 'string', component: 'InputPassword' },
        { name: 'confirm', type: 'string', component: 'InputPassword' },
      ],
      behavior: [
        {
          kind: 'onChange',
          target: 'password',
          sources: ['password'],
          expr: 'form.confirm.clearIssues();',
        },
      ],
    });
    const behavior = buildBundle(intent, CATALOGS).files.find(
      (f) => f.path === 'form.behavior.ts'
    )?.content;
    expect(behavior).toContain('defineFormBehavior<');
    expect(behavior).toMatch(/\(\(\{ model, form \}\) =>/);
    // Без обращения — прежняя область, без неиспользуемых параметров.
    const plain = normalizeIntent({
      ...intent,
      behavior: [{ ...intent.behavior[0], expr: 'void value;' }],
    });
    expect(
      buildBundle(plain, CATALOGS).files.find((f) => f.path === 'form.behavior.ts')?.content
    ).toMatch(/\(\(\{ model \}\) =>/);
  });

  it('составной путь в строке массива — вложенный объект в типе элемента и в шаблоне', () => {
    const model = buildModelTs(
      normalizeIntent({
        formName: 'Loan',
        fields: [{ name: 'amount', type: 'number', component: 'InputNumber' }],
        arrays: [
          {
            name: 'coBorrowers',
            itemInterfaceName: 'CoBorrower',
            initialValue: [],
            itemFields: [
              { name: 'personalData.lastName', type: 'string', component: 'Input' },
              { name: 'personalData.firstName', type: 'string', component: 'Input' },
              { name: 'monthlyIncome', type: 'number', component: 'InputNumber' },
            ],
          },
        ],
      })
    );
    // Прежде печаталось `personalData.lastName: string;` — не TypeScript.
    expect(model).not.toMatch(/personalData\.lastName/);
    expect(model).toMatch(
      /export type CoBorrower = \{\n {2}personalData: \{\n {4}lastName: string \| null;/
    );
    expect(model).toMatch(
      /const blankCoBorrower = \(\): CoBorrower => \(\{\n {2}personalData: \{\n {4}lastName: '',/
    );
  });

  it('onChange объявляет value, только когда выражение его читает', () => {
    const files = (expr: string) =>
      buildBundle(
        normalizeIntent({
          formName: 'Flags',
          target: 'renderer-react',
          fields: [
            { name: 'hasCar', type: 'boolean', component: 'Checkbox' },
            { name: 'carBrand', type: 'string', component: 'Input' },
          ],
          behavior: [{ kind: 'onChange', target: 'hasCar', sources: ['hasCar'], expr }],
        }),
        CATALOGS
      ).files.find((f) => f.path === 'form.behavior.ts')?.content ?? '';
    expect(files("model.carBrand = '';")).toContain('onChange(model.$.hasCar, () => {');
    expect(files("if (!value) model.carBrand = '';")).toContain(
      'onChange(model.$.hasCar, (value) => {'
    );
    // Загрузка по значению: `await` — колбэк async, `signal` — второй параметр отмены.
    expect(
      files(
        'const r = await fetch(`/api?x=${value}`, { signal }); if (!signal.aborted) model.carBrand = await r.text();'
      )
    ).toContain('onChange(model.$.hasCar, async (value, { signal }) => {');
    expect(files('await Promise.resolve(); if (!signal.aborted) model.carBrand = "";')).toContain(
      'onChange(model.$.hasCar, async (_value, { signal }) => {'
    );
  });

  it('необязательное текстовое поле — string | null, обязательное — string [ReFormer-b464]', () => {
    // Текстовые компоненты кита пишут `null` в пустое поле. С типом `string` агент писал
    // `model.promo.trim()`, tsc молчал, а стёртый промокод ронял шаг.
    const model = buildModelTs(
      normalizeIntent({
        formName: 'Promo',
        fields: [
          { name: 'email', type: 'string', component: 'Input' },
          { name: 'promo', type: 'string', component: 'Input' },
          { name: 'inn', type: 'string', component: 'Input' },
          { name: 'age', type: 'number', component: 'InputNumber' },
        ],
        arrays: [
          {
            name: 'phones',
            itemInterfaceName: 'Phone',
            initialValue: [],
            itemFields: [
              { name: 'number', type: 'string', component: 'Input' },
              { name: 'note', type: 'string', component: 'Input' },
            ],
          },
        ],
        validation: [
          { target: 'email', rules: ['required()', 'email()'] },
          // Условная обязательность — поле бывает пустым.
          { target: 'inn', rules: ['required()'], when: 'model.isCompany' },
          { target: 'number', each: 'phones', rules: ['required()'] },
        ],
      })
    );
    expect(model).toMatch(/email: string;/);
    expect(model).toMatch(/promo: string \| null;/);
    expect(model).toMatch(/inn: string \| null;/);
    expect(model).toMatch(/age: number;/);
    expect(model).toMatch(/export type Phone = \{\n {2}number: string;\n {2}note: string \| null;/);
    // Начальное значение прежнее: пустая строка подходит под оба типа.
    expect(model).toMatch(/promo: '',/);
  });

  it('дата: тип модели совпадает со значением компонента, пустое начальное — по типу', () => {
    const model = buildModelTs(
      normalizeIntent({
        formName: 'Dates',
        fields: [
          // Нативное поле даты — строка `YYYY-MM-DD`, как в рабочей кредитной форме.
          { name: 'birthDate', type: 'date', component: 'Input', initialValue: '' },
          // Календарь кита — `Date`; пустая строка из спеки — «даты нет».
          { name: 'startDate', type: 'date', component: 'DatePicker', initialValue: '' },
          { name: 'endDate', type: 'date', component: 'DatePicker', initialValue: '2026-01-31' },
          { name: 'shipDate', type: 'date', component: 'DatePicker' },
        ],
      })
    );
    // Необязательное текстовое поле: компонент пишет `null` в пустое (ReFormer-b464).
    expect(model).toMatch(/birthDate: string \| null;/);
    expect(model).toMatch(/birthDate: ""/);
    expect(model).toMatch(/startDate: Date \| null;/);
    expect(model).toMatch(/startDate: null/);
    expect(model).toMatch(/endDate: new Date\("2026-01-31"\)/);
    expect(model).toMatch(/shipDate: null/);
  });
});

describe('cross-check', () => {
  // Тот же документ, что `generate_form` передаёт кросс-проверке: формат 2, прочитанный из JSON.
  const run = (intent: FormIntent) =>
    crossCheckBundle(intent, JSON.parse(buildFormSchemaJson(intent)));

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

  it('C11 — ссылка раскладки в никуда: генератор выбрасывает узел, поэтому C1 её не видит', () => {
    const intent = goodIntent();
    intent.layoutRoot = {
      kind: 'container',
      component: 'Box',
      children: [
        { kind: 'field', ref: 'ghost' },
        { kind: 'array', ref: 'ghostRows' },
        { kind: 'part', ref: 'group', part: 'ghostPart' },
      ],
    };
    const messages = run(intent).errors.filter((e) => e.code === 'C11');
    expect(messages.map((e) => e.message).join()).toMatch(/ghost.*ghostRows.*ghostPart/);
  });
});

describe('импорты кита', () => {
  it('компонент только в подпути импортируется из подпути, а не из корня', () => {
    const groups = groupUiKitImports(
      ['DatePicker', 'FormField', 'Input', 'Combobox'],
      CATALOGS.uiKit
    );
    expect(groups).toEqual([
      ['@reformer/ui-kit', ['FormField', 'Input']],
      ['@reformer/ui-kit/combobox', ['Combobox']],
      ['@reformer/ui-kit/date-picker', ['DatePicker']],
    ]);
  });
});

describe('tools plan_form / generate_form', () => {
  it('plan_form без источника объясняет, что нужно', async () => {
    const { content } = await planFormTool({}, k);
    expect(content[0].text).toMatch(/specPath|description/);
  });

  it('plan_form: что дописать руками — до intent, в пределах бюджета ответа клиента', async () => {
    // Фасад `mcp_call` ассистента конструктора режет ответ на 1400 символов: перечень после
    // JSON крупной спеки модель не видела никогда (калибровка, трек T6).
    const { content } = await planFormTool(
      {
        description:
          '| Ключ в форме | Тип поля | Валидация |\n| --- | --- | --- |\n' +
          '| login | Input | Обязательное, должно быть уникальным на сервере |',
      },
      k
    );
    const text = content[0].text;
    const warnings = text.indexOf('## Warnings');
    expect(warnings).toBeGreaterThan(0);
    expect(warnings).toBeLessThan(text.indexOf('```json'));
    expect(warnings).toBeLessThan(1400);
  });

  it('plan_form с несуществующим путём не притворяется, что разобрал', async () => {
    const { content } = await planFormTool({ specPath: 'нет/такого/файла.md' }, k);
    expect(content[0].text).toMatch(/не найдена/);
  });

  it('generate_form без intent объясняет, что нужно', async () => {
    const { content } = await generateFormTool({ intent: undefined as never }, cliKnowledge());
    expect(content[0].text).toMatch(/intent/);
  });

  it('generate_form отдаёт манифест и НЕ пишет на диск', async () => {
    const { content } = await generateFormTool({ intent: goodIntent() }, cliKnowledge());
    const text = content[0].text;
    expect(text).toMatch(/Кросс-проверка пройдена/);
    expect(text).toContain('### `model.ts`');
    expect(text).toContain('### `registry.ts`');
    expect(text, 'контракт scaffolding должен быть назван').toMatch(/на диск не пишет/);
  });

  it('манифест печатает полный набор имён, а не только сгенерированные файлы', async () => {
    // Раньше манифест отдавал 5 файлов из 10 без единого признака неполноты, и консумент
    // достраивал остальные под своими именами. Молчание читается как «файлов ровно столько».
    const { content } = await generateFormTool({ intent: goodIntent() }, cliKnowledge());
    const text = content[0].text;
    const row = (name: string) =>
      new RegExp(`\\| \`${name.replace(/\./g, '\\.')}\` \\|[^\\n]*создайте сами`);
    for (const name of ['index.tsx', 'types.ts', 'api.ts']) {
      expect(text, `${name} не назван в чек-листе раскладки`).toMatch(row(name));
    }
    expect(text).toMatch(/\| `model\.ts` \|[^\n]*сгенерирован ниже/);
    // У формы со справочником файл справочников печатает сам генератор (калибровка: раньше
    // схема импортировала из `./data-sources`, которого в бандле не было).
    expect(text).toMatch(/\| `data-sources\.ts` \|[^\n]*сгенерирован ниже/);
  });

  it('справочники: значения из intent — в data-sources.ts и в реестр renderer-json', () => {
    const intent = goodIntent();
    intent.dataSources = [
      { name: 'CURRENCIES', values: [{ value: 'rub', label: 'Рубль' }, 'usd'] },
      { name: 'EMPTY' },
    ];
    const bundle = buildBundle(intent, CATALOGS);
    const sources = bundle.files.find((f) => f.path === 'data-sources.ts')?.content ?? '';
    expect(sources).toContain('export const CURRENCIES = [');
    expect(sources).toContain('"label": "Рубль"');
    expect(sources).toContain('"value": "usd"');
    expect(sources).toContain('export const EMPTY: Array<{ value: string; label: string }> = [];');
    expect(bundle.warnings.join(' ')).toMatch(/Справочник `EMPTY` без значений/);
    const registry = bundle.files.find((f) => f.path === 'registry.ts')?.content ?? '';
    expect(registry).toContain("import { CURRENCIES, EMPTY } from './data-sources';");
    expect(registry).toContain("reg.dataSource('CURRENCIES', CURRENCIES);");
    expect(registry).not.toContain('TODO: reg.dataSource');
  });

  it('пропсы массива из intent доходят до узла FieldArray', () => {
    const intent = goodIntent();
    intent.arrays[0].componentProps = { addButtonLabel: '+ Добавить позицию', title: 'Позиции' };
    const layout = JSON.parse(buildBundle(intent, CATALOGS).layoutJson);
    const find = (n: Record<string, unknown>): Record<string, unknown> | null => {
      if (n.component === '$component(FieldArray)') return n;
      for (const c of (n.children as Record<string, unknown>[] | undefined) ?? []) {
        const hit = find(c);
        if (hit) return hit;
      }
      return null;
    };
    expect(find(layout.root)?.componentProps).toEqual({
      addButtonLabel: '+ Добавить позицию',
      title: 'Позиции',
    });
  });

  it('generate_form отдаёт файлы ДАЖЕ при ошибках, но не скрывает их', async () => {
    const intent = goodIntent();
    intent.validation.push({ target: 'ghost', rules: ['required()'] });
    const { content } = await generateFormTool({ intent }, cliKnowledge());
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
  // Теперь генератор печатает документ формата 2 (`schema-emit.ts`). Его локальный
  // `SchemaDocNode` с типами пакета не связан, поэтому дрейф контракта компилятор не поймает —
  // ловить его может только такой прогон.
  const validate = async (intent: FormIntent) => {
    const { validateFormSchema } = await import('@reformer/renderer-json/validate');
    return validateFormSchema(JSON.parse(buildFormSchemaJson(intent)));
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

    // Формат 2: узел массива ссылается на часть-строку, собранную из itemFields, а `initialValue`
    // не несёт — пустой элемент для «Добавить» объявлен в модели (`arrayOf(blank…)`).
    const layout = JSON.parse(buildFormSchemaJson(intent));
    const arrayNode = layout.root.children.find((c: { item?: string }) => c.item);
    expect(arrayNode.item).toBe('$part(itemsRow)');
    expect(arrayNode.initialValue).toBeUndefined();
    expect(layout.parts.itemsRow.children.map((c: { model: string }) => c.model)).toEqual([
      '$model(sku)',
      '$model(qty)',
      '$model(gift)',
    ]);
    const model = buildModelTs(intent);
    expect(model).toContain('items: arrayOf(blankOrderItem),');
    // Пустое значение по типу поля: строка — '', число — 0, флаг — false.
    expect(model).toMatch(
      /const blankOrderItem = \(\): OrderItem => \(\{\s+sku: '',\s+qty: 0,\s+gift: false,\s+\}\);/
    );
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

/**
 * Вход, каким его присылает модель, а не `plan_form`.
 *
 * Ровно эта форма записи роняла `generate_form` внутренней ошибкой MCP `-32603` («Cannot read
 * properties of undefined (reading 'split')»): поля названы `path`, поведение — `behaviors`, его
 * источники — `reads`, шаги отдельным списком `steps`. Диагноз консумент не получал никакой,
 * хотя описание инструмента обещало «Partial input is normalised with warnings».
 */
function intuitiveIntent(): Record<string, unknown> {
  return {
    name: 'Заявка на кредит',
    target: 'renderer-json',
    fields: [
      {
        path: 'personal.lastName',
        type: 'string',
        label: 'Фамилия',
        component: 'Input',
        required: true,
      },
      { path: 'loanAmount', type: 'number', label: 'Сумма', component: 'Input', required: true },
    ],
    steps: [
      { title: 'Личные данные', fields: ['personal.lastName'] },
      { title: 'Кредит', fields: ['loanAmount'] },
    ],
    behaviors: [{ kind: 'computeFrom', target: 'loanAmount', reads: ['personal.lastName'] }],
  };
}

describe('readIntent — вход не из plan_form', () => {
  it('интуитивные имена ключей приводятся к контракту, а не роняют вызов', () => {
    const { intent, problems } = readIntent(intuitiveIntent());
    expect(problems).toEqual([]);
    expect(intent.target).toBe('renderer-json');
    expect(intent.fields.map((f) => f.modelPath)).toEqual(['personal.lastName', 'loanAmount']);
    expect(intent.behavior[0].sources).toEqual(['personal.lastName']);
    expect(intent.wizard?.steps).toHaveLength(2);
    // Переименования названы: иначе консумент не узнает, что его ключи читались не буквально.
    expect(intent.warnings.join(' ')).toMatch(/path → modelPath/);
    expect(intent.warnings.join(' ')).toMatch(/reads → sources/);
  });

  it('`required: true` поднимается в правило валидации, а не теряется', () => {
    // Контракт держит обязательность отдельным списком, и до сих пор флаг у поля молча пропадал:
    // форма собиралась вообще без валидации, хотя консумент её запросил.
    const { intent } = readIntent(intuitiveIntent());
    expect(intent.validation.map((v) => v.target)).toEqual(['personal.lastName', 'loanAmount']);
    expect(intent.validation[0].rules).toEqual(['required()']);
    expect(intent.warnings.join(' ')).toMatch(/required: true/);
  });

  it('сокращение steps без своей раскладки становится узлами шагов мастера', () => {
    // Раньше шаги оставались в `wizard`, а разметка собиралась плоской: форма без деления на
    // шаги с отметкой ✓ (ReFormer-j356.5).
    const { intent } = readIntent(intuitiveIntent());
    const root = intent.layoutRoot as Extract<LayoutNode, { kind: 'container' }>;
    expect(root.selector).toBe('wizard');
    expect(root.children).toEqual([
      {
        kind: 'step',
        title: 'Личные данные',
        children: [{ kind: 'field', ref: 'personal.lastName' }],
      },
      { kind: 'step', title: 'Кредит', children: [{ kind: 'field', ref: 'loanAmount' }] },
    ]);
    expect(intent.warnings.join(' ')).not.toMatch(/плоской/);
  });

  it('таргет читается в любом написании и не становится core молча', () => {
    expect(readIntent({ target: 'react' }).intent.target).toBe('renderer-react');
    expect(readIntent({ target: 'renderer_json' }).intent.target).toBe('renderer-json');
    const odd = readIntent({ target: 'vue' }).intent;
    expect(odd.target).toBe('core');
    expect(odd.warnings.join(' ')).toMatch(/vue/);
  });

  it('безымянная запись выброшена и названа поимённо, остальное собрано', () => {
    const { intent, problems } = readIntent({
      formName: 'Y',
      fields: [
        { type: 'string', component: 'Input' },
        { path: 'ok', type: 'text' },
      ],
    });
    expect(problems.map((p) => p.at)).toEqual(['fields[0].name']);
    expect(problems[0].expected).toMatch(/name/);
    expect(intent.fields.map((f) => f.name)).toEqual(['ok']);
    // Тип `text` и отсутствующий компонент — это умолчания, а не проблемы входа.
    expect(intent.fields[0].component).toBe('Input');
  });

  it('неизвестный вид поведения — проблема входа, а не комментарий в файле', () => {
    // Прежде такое поведение доезжало до `form.behavior.ts` строкой `// неизвестный вид` —
    // то есть форма собиралась молча не делающей того, что просили.
    const { intent, problems } = readIntent({
      fields: [{ name: 'a', type: 'string', component: 'Input' }],
      behavior: [{ kind: 'computed', target: 'a' }],
    });
    expect(intent.behavior).toEqual([]);
    expect(problems[0].at).toBe('behavior[0].kind');
    expect(problems[0].expected).toMatch(/computeFrom/);
    expect(problems[0].expected).toMatch(/choose_api/);
  });

  it('готовый intent проходит слой без изменений', () => {
    // Иначе приём «интуитивного» входа стал бы налогом на нормальный путь `plan_form` →
    // `generate_form`: тот отдаёт JSON, и он обязан вернуться из чтения таким же.
    const good = goodIntent();
    const { intent, problems } = readIntent(JSON.parse(JSON.stringify(good)));
    expect(problems).toEqual([]);
    const sorted = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(sorted)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.keys(v as object)
                .sort()
                .map((k) => [k, sorted((v as Record<string, unknown>)[k])])
            )
          : v;
    expect(sorted({ ...intent, warnings: [] })).toEqual(sorted({ ...good, warnings: [] }));
  });
});

describe('generate_form на неполном intent', () => {
  it('падавший вход собирается в манифест, а не в -32603', async () => {
    const { content } = await generateFormTool({ intent: intuitiveIntent() }, cliKnowledge());
    const text = content[0].text;
    expect(text).toMatch(/Кросс-проверка пройдена/);
    expect(text).toContain('### `model.ts`');
    // Составной путь дошёл до модели вложенным объектом, а не строкой с точкой в ключе.
    expect(text).toContain('personal: {');
    expect(text).toMatch(/## Warnings/);
  });

  it('составной путь даёт валидный параметр колбэка computeFrom', async () => {
    // `(personal.lastName) => …` не парсится вовсе: манифест отдавал бы файл, который не
    // собирается. Имя берётся по последнему сегменту, и переименование названо на месте.
    const { content } = await generateFormTool({ intent: intuitiveIntent() }, cliKnowledge());
    expect(content[0].text).toContain('(lastName) =>');
    expect(content[0].text).toMatch(/параметры названы по последнему сегменту/);
  });

  it('выброшенные записи видны в заголовке и разобраны поимённо', async () => {
    const { content } = await generateFormTool(
      {
        intent: {
          formName: 'Z',
          fields: [{ name: 'a', type: 'string', component: 'Input' }],
          validation: [{ field: 'a' }],
        },
      },
      cliKnowledge()
    );
    const text = content[0].text;
    expect(text).toMatch(/Из intent выброшено записей: 1/);
    expect(text).toContain('`validation[0].rules`');
    expect(text).toContain('### `model.ts`');
  });

  it('когда читать нечего — диагностика и адрес готового intent, а не пустой каркас', async () => {
    const { content } = await generateFormTool({ intent: 'не json' }, cliKnowledge());
    const text = content[0].text;
    expect(text).toMatch(/прочитать не удалось/);
    expect(text).toMatch(/не разбирается как JSON/);
    expect(text).toMatch(/plan_form/);
    expect(text).not.toContain('### `model.ts`');
  });

  it('intent строкой с валидным JSON читается', async () => {
    const { content } = await generateFormTool(
      { intent: JSON.stringify(intuitiveIntent()) },
      cliKnowledge()
    );
    expect(content[0].text).toContain('### `model.ts`');
    expect(content[0].text).toMatch(/пришёл строкой/);
  });

  it('ни один вход не уходит внутренней ошибкой', async () => {
    // Обещание описания инструмента проверяется целиком, а не на одном кейсе: `-32603` не
    // сообщает консументу ничего, и для агента это тупик.
    const hostile: unknown[] = [
      {},
      42,
      [1, 2],
      { fields: 'нет' },
      { fields: [null, 7] },
      { fields: [{ name: 'a' }], arrays: [{ name: 'a' }] },
      { fields: [{ name: 'a', type: 'string', component: 'Input' }], layout: { kind: 'bogus' } },
      { fields: { a: { type: 'nonsense' } }, behavior: 'нет', visibility: [42], dataSources: [7] },
      { steps: 'первый', wizard: { steps: [{}] } },
    ];
    for (const intent of hostile) {
      const { content } = await generateFormTool({ intent }, cliKnowledge());
      expect(content[0].text, JSON.stringify(intent)).toMatch(/generate_form/);
      expect(content[0].text, JSON.stringify(intent)).not.toMatch(/Внутренняя ошибка/);
    }
  });
});
