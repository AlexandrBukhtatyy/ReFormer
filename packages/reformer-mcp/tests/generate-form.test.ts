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
  readIntent,
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
  renderLayoutChecklist,
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
  it('model.ts объявляет тип формы, элементы массива и начальные значения', () => {
    const ts = buildModelTs(goodIntent());
    // Именно `type`, а не `interface`: у interface нет неявной индексной сигнатуры, поэтому
    // он не присваивается `Record<string, FormValue>` — на это опираются FormProxy<T>,
    // ArrayNode<T> и constraint FormWizard<T>. Правило корпуса: core «TYPE-SAFETY RECIPES»
    // Recipe 2, reformer://guide §27; сервер обязан ему следовать, а не только требовать.
    expect(ts).toContain('export type OrderItem = {');
    expect(ts).toContain('export type OrderShape = {');
    expect(ts, 'interface нарушает собственное правило корпуса').not.toMatch(
      /export interface (OrderItem|OrderShape)/
    );
    expect(ts).toContain('price: number;');
    expect(ts).toContain('items: OrderItem[];');
    expect(ts).toContain('export const initialFormModel');
  });

  /**
   * Замер показал три места, где генератор молча расходился с каноном и с самим intent'ом
   * (`.tmp/verdicts/b2-generate-form-antipattern-invalid-ts.md`). Все три не ловились ничем:
   * кросс-проверка сверяет файлы между собой, а они были согласованно неверны.
   */
  describe('layout соответствует канону renderer-json', () => {
    const layout = (intent: FormIntent) => JSON.parse(buildLayoutJson(intent)).root;

    it('шаги живут в componentProps.steps, а не в children', () => {
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
      // Класть шаги в children — анти-паттерн, названный так в корпусе renderer-json.
      expect(root.componentProps?.steps, 'шаги обязаны быть в componentProps.steps').toHaveLength(
        1
      );
      expect(root.children ?? [], 'children у wizard-ноды быть не должно').toHaveLength(0);
      expect(root.component).toBe('$component(Wizard)');
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

    it('initialValue поля элемента массива не затирается пустышкой по типу', () => {
      const intent = normalizeIntent({
        formName: 'Order',
        target: 'renderer-json',
        fields: [],
        arrays: [
          {
            name: 'properties',
            itemInterfaceName: 'PropertyItem',
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
      expect(layout(intent).children[0].initialValue).toEqual({
        type: 'apartment',
        estimatedValue: 0,
      });
    });
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
    // Схема отдаётся каноничным `renderer.schema.ts`, а не `.json`: предупреждение о потере
    // типизации читают не все, а блок кода из манифеста копируют все.
    const schema = json.files.find((f) => f.path === 'renderer.schema.ts');
    expect(schema, 'схема renderer-json отдаётся как renderer.schema.ts').toBeDefined();
    expect(schema?.content).toContain(`defineJsonSchema<${deriveInterfaceName('Order')}>(`);
    expect(json.files.map((f) => f.path)).not.toContain('renderer.schema.json');
    const core = buildBundle(normalizeIntent({ ...goodIntent(), target: 'core' }));
    expect(core.files.map((f) => f.path)).not.toContain('registry.ts');
    expect(core.warnings.join(' '), 'ограничение target должно быть названо').toMatch(
      /layout\.json/
    );
  });

  it('чек-лист раскладки печатает канон, а вариант имени засчитывает канонической строке', () => {
    // Генератор отдаёт схему renderer-json как канонический `.ts`, но `.json` остаётся
    // допустимым вариантом — консумент может прийти с ним. Строка в таблице обязана остаться
    // канонической, иначе чек-лист переучивает консумента на вариант.
    const out = renderLayoutChecklist('renderer-json', ['model.ts', 'renderer.schema.json']);
    expect(out).toMatch(/`renderer\.schema\.ts`.*сгенерирован ниже как `renderer\.schema\.json`/);
    // Несгенерированные файлы названы поимённо — это и есть сигнал неполноты, которого не было.
    expect(out).toMatch(/`registry\.ts`.*создайте сами/);
    expect(out).toContain('find_recipe directory-layout');
    // У core рендер-слоя нет: иначе консумент создаст мёртвый файл.
    expect(renderLayoutChecklist('core', [])).not.toContain('renderer.behavior.ts');
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

  it('манифест печатает полный набор имён, а не только сгенерированные файлы', async () => {
    // Раньше манифест отдавал 5 файлов из 10 без единого признака неполноты, и консумент
    // достраивал остальные под своими именами. Молчание читается как «файлов ровно столько».
    const { content } = await generateFormTool({ intent: goodIntent() });
    const text = content[0].text;
    const row = (name: string) =>
      new RegExp(`\\| \`${name.replace(/\./g, '\\.')}\` \\|[^\\n]*создайте сами`);
    for (const name of ['index.tsx', 'types.ts', 'data-sources.ts', 'api.ts']) {
      expect(text, `${name} не назван в чек-листе раскладки`).toMatch(row(name));
    }
    expect(text).toMatch(/\| `model\.ts` \|[^\n]*сгенерирован ниже/);
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

  it('шаги сохраняются, и о плоской разметке сказано прямо', () => {
    // Генератор шаги по узлам не раскладывает. Промолчать здесь — значит отдать форму, где
    // деление на шаги пропало, с отметкой «✅ кросс-проверка пройдена».
    const { intent } = readIntent(intuitiveIntent());
    expect(intent.warnings.join(' ')).toMatch(/Шагов в intent: 2/);
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
    const { content } = await generateFormTool({ intent: intuitiveIntent() });
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
    const { content } = await generateFormTool({ intent: intuitiveIntent() });
    expect(content[0].text).toContain('(lastName) =>');
    expect(content[0].text).toMatch(/параметры названы по последнему сегменту/);
  });

  it('выброшенные записи видны в заголовке и разобраны поимённо', async () => {
    const { content } = await generateFormTool({
      intent: {
        formName: 'Z',
        fields: [{ name: 'a', type: 'string', component: 'Input' }],
        validation: [{ field: 'a' }],
      },
    });
    const text = content[0].text;
    expect(text).toMatch(/Из intent выброшено записей: 1/);
    expect(text).toContain('`validation[0].rules`');
    expect(text).toContain('### `model.ts`');
  });

  it('когда читать нечего — диагностика и адрес готового intent, а не пустой каркас', async () => {
    const { content } = await generateFormTool({ intent: 'не json' });
    const text = content[0].text;
    expect(text).toMatch(/прочитать не удалось/);
    expect(text).toMatch(/не разбирается как JSON/);
    expect(text).toMatch(/plan_form/);
    expect(text).not.toContain('### `model.ts`');
  });

  it('intent строкой с валидным JSON читается', async () => {
    const { content } = await generateFormTool({ intent: JSON.stringify(intuitiveIntent()) });
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
      const { content } = await generateFormTool({ intent });
      expect(content[0].text, JSON.stringify(intent)).toMatch(/generate_form/);
      expect(content[0].text, JSON.stringify(intent)).not.toMatch(/Внутренняя ошибка/);
    }
  });
});
