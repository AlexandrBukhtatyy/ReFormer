/**
 * Замер: сценарии разработки форм из документа билдера (`docs/assistant-form-scenarios.md`) на
 * живой модели.
 *
 * e2e (`form-scenarios.spec.ts`) проверяет, что обвязка выдерживает сценарий, когда модель зовёт
 * инструменты правильно. Здесь — зовёт ли их правильно сама модель: запрос словами пользователя,
 * полный ход моста (затравка, вторая попытка, правила в коде модуля, создание формы), и критерий по тому,
 * что легло в форму и в правила. Рабочая область — двойник: интерфейса замер не касается.
 *
 * По умолчанию НЕ запускается: нужен живой канал. Запуск из каталога этого файла —
 * `EVAL_MODEL=qwen3.8:27b-32k npx vitest run assistant-scenarios-eval.test.ts`;
 * `EVAL_ONLY=7.1,8.1` — только эти сценарии, `EVAL_KIND` — канал (`openai-compatible` по
 * умолчанию, `anthropic`, `openai`), `EVAL_BASE_URL` — адрес OpenAI-совместимого канала,
 * `EVAL_API_KEY` — ключ облачного канала (у Ollama не нужен),
 * `EVAL_REASONING=off|low|medium|high` — рассуждение модели (настройка канала `reasoning`),
 * `EVAL_BUILD_FORM=1` — структурный режим с `build_form` (план mcp-misty-graham, этап 2),
 * `EVAL_DUMP=<каталог>` — тело каждого запроса к модели и сырой ответ сервера файлами: по ним
 * видно то, что до хода не дошло (вызов, который сервер не разобрал).
 * Итог — таблицей в консоль и JSON в `.tmp/eval/` корня репозитория. Отчёт —
 * `docs/mcp-eval/builder-form-scenarios.md`.
 *
 * @module plugins/reformer/integration/assistant-scenarios-eval.test
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '../core/testing';
import { emptyRules, type FormRules } from '../core/form-model';
import { rulesStackInput } from '../core/codegen/rules-code';
import { readRuleCode } from '../ai/src/stack/rule-code';
import { generatorOver } from './codegen-harness';
import { projectFormsOf } from './project-forms-harness';
import { createAgentBridge } from '../../forms/ai/src/session/bridge';
import { createAiSession, openAskOf, type ToolLogEntry } from '../../forms/ai/src/session/session';
import { createProviderRegistry } from '../../forms/ai/src/providers/registry';
import { createByokProvider } from '../../forms/ai/src/providers/byok';
import type { ProviderKind, ReasoningLevel } from '../../forms/ai/src/session/config';
import { parseSchemaText, printSchemaText } from '../ai/src/model/schema-text';
import { createFakeHost } from '../../forms/ai/src/testing';
import { createFakeFiles } from '../ai/src/stack/testing';
import { createSchemaFormStack } from '../ai/src/stack';
import type { AiAssistant } from '../../forms/ai/src/plugin';
import type { FormCreatorService, ModuleGeneratorService } from '@reformer/builder-plugin-api';
import type { TurnTelemetry } from '../../forms/ai/src/session/telemetry';

const MODEL = process.env.EVAL_MODEL;
const KIND = (process.env.EVAL_KIND ?? 'openai-compatible') as ProviderKind;
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:11434/v1';
const API_KEY = process.env.EVAL_API_KEY ?? (KIND === 'openai-compatible' ? 'ollama' : '');
/** Рассуждение модели для A/B; нет — по умолчанию канала. */
const REASONING = process.env.EVAL_REASONING as ReasoningLevel | undefined;
/** `build_form` в наборе структурного режима; нет — набор прежний. */
const BUILD_FORM = process.env.EVAL_BUILD_FORM === '1';
/** Куда писать сырые запросы и ответы; нет — не писать. */
const DUMP = process.env.EVAL_DUMP;

/**
 * Записывать каждый обмен с моделью: запрос — JSON, ответ — сырой поток SSE. Обёртка ставится на
 * `globalThis.fetch`: канал AI SDK берёт его в момент запроса.
 */
function dumpExchanges(dir: string, label: () => string): () => void {
  mkdirSync(dir, { recursive: true });
  const original = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const response = await original(input, init);
    if (!url.startsWith(BASE_URL)) return response;
    n += 1;
    const base = `${dir}/${label()}-${String(n).padStart(2, '0')}`;
    writeFileSync(`${base}.request.json`, typeof init?.body === 'string' ? init.body : '');
    void response
      .clone()
      .text()
      .then((text) => writeFileSync(`${base}.response.txt`, text));
    return response;
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
const ONLY = (process.env.EVAL_ONLY ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
/** Предел шагов хода: сценарии в десяток полей укладываются, зацикливание — нет. */
const MAX_STEPS = 24;

/**
 * Предел времени сценария: ход останавливается, как кнопкой «Стоп», и сценарий не засчитывается.
 *
 * Предел шагов от зацикливания внутри ОДНОГО запроса не спасает: gemma4 с рассуждением писала
 * ответ больше часа (88 тыс. токенов). Таймаут теста ход не обрывал — запрос продолжал занимать
 * Ollama, и следующие сценарии стояли в её очереди до своих таймаутов. Предел меньше таймаута
 * теста: остановленному ходу нужно время закрыться и записать результат. И с запасом над самым
 * долгим законным ходом: qwen3.8 с рассуждением провёл 22.1 за 1288 с.
 */
const SCENARIO_LIMIT_MS = 1_500_000;

const DOCUMENT = 'forms/eval/schema/form.schema.json';

// ── Формы, на которых идут сценарии ──

const field = (component: string, model: string, label: string, props = {}) => ({
  model: `$model(${model})`,
  component: `$component(${component})`,
  componentProps: { label, ...props },
});

const EMPTY: JsonFormSchema = {
  format: 2,
  version: '1.0',
  root: { component: '$component(Box)', componentProps: { className: 'space-y-4' }, children: [] },
} as unknown as JsonFormSchema;

/** Анкета клиента: поля для правок, правил и связей. */
const CLIENT: JsonFormSchema = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      field('Input', 'name', 'Имя'),
      field('Input', 'email', 'Почта'),
      field('Input', 'phone', 'Телефон'),
      field('InputPassword', 'password', 'Пароль'),
      field('Select', 'kind', 'Тип клиента', {
        options: [
          { value: 'person', label: 'Физлицо' },
          { value: 'company', label: 'Юрлицо' },
        ],
      }),
      field('Input', 'inn', 'ИНН'),
      field('InputNumber', 'price', 'Цена'),
      field('InputNumber', 'qty', 'Количество'),
      field('InputNumber', 'total', 'Сумма'),
      field('Checkbox', 'pickup', 'Самовывоз'),
      field('Input', 'deliveryAddress', 'Адрес доставки'),
    ],
  },
} as unknown as JsonFormSchema;

/** Мастер из двух шагов: в него добавляют шаг целиком. */
const WIZARD: JsonFormSchema = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: '$component(Wizard)',
        selector: 'wizard',
        children: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Клиент' },
            selector: 'klient-section',
            children: [field('Input', 'name', 'Имя'), field('Input', 'phone', 'Телефон')],
          },
          {
            component: '$component(Step)',
            componentProps: { title: 'Контакты' },
            selector: 'kontakty-section',
            children: [field('Input', 'email', 'Почта')],
          },
        ],
      },
    ],
  },
} as unknown as JsonFormSchema;

/** Правила анкеты на начало хода: почта уже обязательна. */
const CLIENT_RULES: FormRules = {
  ...emptyRules(),
  validation: [{ target: 'email', rules: ['required'] }],
};

// ── Что видно после хода ──

interface Node {
  readonly component?: string;
  readonly model?: string;
  readonly componentProps?: Record<string, unknown>;
  readonly children?: readonly Node[];
  readonly item?: { readonly $template?: Node };
  readonly part?: string;
  readonly disabled?: unknown;
  readonly initialValue?: unknown;
}

/** Все узлы схемы, в порядке документа: дети, шаблон строки, части. */
function nodesOf(schema: JsonFormSchema | null): Node[] {
  const out: Node[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const n = node as Node;
    out.push(n);
    for (const child of n.children ?? []) walk(child);
    if (n.item?.$template) walk(n.item.$template);
  };
  if (schema === null) return out;
  walk((schema as unknown as { root: unknown }).root);
  const parts = (schema as unknown as { parts?: Record<string, unknown> }).parts ?? {};
  for (const part of Object.values(parts)) walk(part);
  return out;
}

const nameOf = (op: string | undefined): string =>
  op?.replace(/^\$(component|html)\(/, '').replace(/\)$/, '') ?? '';
const modelOf = (node: Node): string =>
  node.model?.replace(/^\$model\(/, '').replace(/\)$/, '') ?? '';
const fieldsOf = (schema: JsonFormSchema | null): Node[] =>
  nodesOf(schema).filter((node) => node.model !== undefined && node.item === undefined);
const labelOf = (node: Node): string => String(node.componentProps?.label ?? '');

interface EvalState {
  readonly schema: JsonFormSchema | null;
  readonly rules: FormRules;
  readonly tools: readonly ToolLogEntry[];
  readonly text: string;
  readonly error: string | null;
  readonly created: readonly string[];
  readonly generated: number;
  readonly asked: number;
  /** Форма, которую правил ход, — по снимку реплики человека; нет снимка — активная вкладка. */
  readonly target: string | null;
}

/** Формы проекта сценариев выбора формы — пустые и не открытые вкладками. */
const OTHER_FORMS: readonly string[] = [
  'forms/order/schema/form.schema.json',
  'forms/profile/schema/form.schema.json',
];

/** Правки, а не чтение: вызовы, которые меняют форму, правила или проект. */
const edits = (state: EvalState): ToolLogEntry[] =>
  state.tools.filter((tool) => tool.readOnly !== true && tool.ok);

interface EvalScenario {
  /** Номер сценария документа. */
  readonly id: string;
  readonly title: string;
  readonly form: 'none' | 'empty' | 'client' | 'wizard';
  /**
   * Файл, открытый активной вкладкой перед ходом, — путь от корня проекта; нет файла — кладётся
   * пустой. Нет поля — активна вкладка формы (или никакая, если формы нет).
   */
  readonly tab?: string;
  /** Другие формы проекта — пустые документы, не открытые вкладками. */
  readonly otherForms?: readonly string[];
  readonly request: string;
  /** Почему не прошёл, или `null`. */
  readonly check: (state: EvalState) => string | null;
  /**
   * Сколько формы собрано — у сценариев крупной сборки. Вердикт «прошёл / нет» на них грубый: ход,
   * собравший 20 полей из 25, и ход, не собравший ничего, падают одинаково.
   */
  readonly coverage?: (state: EvalState) => Coverage;
}

/** Собранное против заказанного: поля и правила. */
interface Coverage {
  readonly fields: readonly [hit: number, total: number];
  readonly rules: readonly [hit: number, total: number];
}

/** Правила проверки поля — строками, как их хранит `FormRules`. */
const rulesOn = (s: EvalState, target: string): string[] =>
  s.rules.validation.filter((r) => r.target === target).flatMap((r) => r.rules);

/** Обязательность — правилом или свойством `required` поля: генерация выводит проверку из обоих. */
const requiredOn = (s: EvalState, target: string): boolean =>
  rulesOn(s, target).some((r) => r.startsWith('required')) ||
  fieldsOf(s.schema).find((f) => modelOf(f) === target)?.componentProps?.required === true;

/** Шаги мастера формы; нет мастера — `null`. */
function stepsOf(schema: JsonFormSchema | null): Node[] | null {
  const wizard = nodesOf(schema).find((n) => nameOf(n.component) === 'Wizard');
  return wizard === undefined
    ? null
    : (wizard.children ?? []).filter((c) => nameOf(c.component) === 'Step');
}

const stepFields = (step: Node): Node[] => fieldsOf({ root: step } as unknown as JsonFormSchema);

/** Ключи полей B.1 — по шагам. Ключи названы в запросе, чтобы покрытие считалось по ним. */
const B1_STEPS: readonly (readonly string[])[] = [
  ['lastName', 'firstName', 'middleName', 'birthDate', 'email', 'phone', 'company', 'position'],
  [
    'ticketType',
    'studentId',
    'arrivalDate',
    'departureDate',
    'needHotel',
    'hotelNights',
    'mealPreference',
    'promoCode',
  ],
  [
    'payerType',
    'inn',
    'payerCompany',
    'billingEmail',
    'basePrice',
    'discount',
    'total',
    'comment',
    'acceptTerms',
  ],
];

/** Последний сегмент пути модели: ключ запроса, даже если модель положила поле в группу шага. */
const keyOf = (path: string): string => path.split('.').at(-1) ?? path;

/** Путь модели поля с этим ключом; нет поля — сам ключ (тогда правило не найдётся). */
const pathOf = (s: EvalState, key: string): string =>
  fieldsOf(s.schema)
    .map(modelOf)
    .find((path) => keyOf(path) === key) ?? key;

/** Правила B.1: имя → выполнено ли. */
function b1Rules(s: EvalState): Record<string, boolean> {
  const path = (key: string) => pathOf(s, key);
  const behavior = (key: string, kind: RegExp) =>
    s.rules.behavior.some((b) => b.target === path(key) && kind.test(b.kind));
  const conditionalRequired = (key: string) =>
    s.rules.validation.some(
      (r) => r.target === path(key) && r.rules.some((x) => x.startsWith('required')) && r.when
    );
  const discount = rulesOn(s, path('discount'));
  return {
    required: ['lastName', 'firstName', 'email', 'phone', 'ticketType', 'acceptTerms'].every(
      (key) => requiredOn(s, path(key))
    ),
    emailFormat: rulesOn(s, path('email')).some((r) => r.startsWith('email')),
    studentIdWhen: conditionalRequired('studentId'),
    datesCross: s.rules.validation.some((r) => r.cross !== undefined),
    hotelNightsWhen:
      behavior('hotelNights', /When$/) ||
      s.rules.render.some((r) => r.kind === 'hideWhen' && /hotel-?nights/i.test(r.selector)),
    innWhen: conditionalRequired('inn'),
    billingEmailCopy: behavior('billingEmail', /^copyFrom/),
    totalCompute: behavior('total', /^compute/),
    discountBounds:
      discount.some((r) => r.startsWith('min')) && discount.some((r) => r.startsWith('max')),
  };
}

const SCENARIOS: readonly EvalScenario[] = [
  {
    id: '1.1',
    title: 'форма по одной фразе без открытой формы',
    form: 'none',
    request: 'Сделай анкету для заявки на кредит: ФИО, телефон, сумма кредита и срок в месяцах.',
    check: (s) =>
      s.created.length !== 1
        ? 'форма не создана'
        : fieldsOf(s.schema).length < 4
          ? `полей ${fieldsOf(s.schema).length} из 4`
          : !fieldsOf(s.schema).some((f) => ['InputNumber', 'Slider'].includes(nameOf(f.component)))
            ? 'нет числового поля для суммы или срока'
            : null,
  },
  {
    id: '1.3',
    title: 'заполнить пустую форму по описанию',
    form: 'empty',
    request: 'Добавь в форму поля: имя, электронная почта и телефон.',
    check: (s) =>
      fieldsOf(s.schema).length < 3
        ? `полей ${fieldsOf(s.schema).length} из 3`
        : !fieldsOf(s.schema).some((f) => /mail/i.test(modelOf(f)))
          ? 'нет поля почты'
          : null,
  },
  {
    id: '3.1',
    title: 'поле выбора с вариантами',
    form: 'empty',
    request: 'Добавь выбор города из трёх вариантов: Москва, Санкт-Петербург, Казань.',
    check: (s) => {
      const choice = fieldsOf(s.schema).find((f) => Array.isArray(f.componentProps?.options));
      const named = Object.values(s.rules.dataSources ?? {}).some(
        (value) => Array.isArray(value) && value.length === 3
      );
      if (choice === undefined && !named) return 'нет поля с вариантами';
      if (choice !== undefined && (choice.componentProps?.options as unknown[]).length !== 3) {
        return 'вариантов не три';
      }
      return null;
    },
  },
  {
    id: '3.6',
    title: 'блок полей в секции',
    form: 'empty',
    request: 'Добавь секцию «Паспорт» с полями: серия, номер, кем выдан, дата выдачи.',
    check: (s) => {
      const block = nodesOf(s.schema)
        .slice(1)
        .find(
          (n) => n.model === undefined && (n.children ?? []).filter((c) => c.model).length >= 4
        );
      if (block === undefined) return 'нет контейнера с четырьмя полями';
      return fieldsOf(s.schema).some((f) => nameOf(f.component).startsWith('DatePicker'))
        ? null
        : 'дата выдачи — не выбор даты';
    },
  },
  {
    id: '9.1',
    title: 'массив повторяющихся блоков',
    form: 'empty',
    request: 'Добавь список детей: у каждого имя и дата рождения; детей можно добавлять и удалять.',
    check: (s) => {
      const array = nodesOf(s.schema).find((n) => n.item?.$template !== undefined);
      if (array === undefined) return 'нет массива';
      const row = fieldsOf({ root: array.item?.$template } as unknown as JsonFormSchema);
      return row.length >= 2 ? null : `полей строки ${row.length} из 2`;
    },
  },
  {
    id: '4.1',
    title: 'подпись и подсказка поля',
    form: 'client',
    request:
      'Переименуй поле «Имя» в «Фамилия, имя, отчество» и добавь подсказку «Иванов Иван Иванович».',
    check: (s) => {
      const name = fieldsOf(s.schema).find((f) => modelOf(f) === 'name');
      if (name === undefined) return 'поле имени пропало';
      if (labelOf(name) !== 'Фамилия, имя, отчество') return `подпись «${labelOf(name)}»`;
      return name.componentProps?.placeholder === 'Иванов Иван Иванович' ? null : 'нет подсказки';
    },
  },
  {
    id: '4.2',
    title: 'перестановка поля',
    form: 'client',
    request: 'Перемести поле «Телефон» в самое начало формы.',
    check: (s) => {
      const fields = fieldsOf(s.schema);
      if (fields.length !== 11) return `полей ${fields.length} вместо 11`;
      return modelOf(fields[0]) === 'phone' ? null : `первое поле — ${modelOf(fields[0])}`;
    },
  },
  {
    id: '5.3',
    title: 'форма → мастер из двух шагов',
    form: 'client',
    request:
      'Разбей форму на мастер из двух шагов: «Клиент» — имя, тип клиента и ИНН, «Контакты» — ' +
      'почта и телефон. Остальные поля оставь во втором шаге.',
    check: (s) => {
      const wizard = nodesOf(s.schema).find((n) => nameOf(n.component) === 'Wizard');
      if (wizard === undefined) return 'нет мастера';
      const steps = (wizard.children ?? []).filter((c) => nameOf(c.component) === 'Step');
      if (steps.length !== 2) return `шагов ${steps.length}`;
      const second = fieldsOf({ root: steps[1] } as unknown as JsonFormSchema).map(modelOf);
      return second.includes('email') ? null : 'почта не во втором шаге';
    },
  },
  {
    id: '5.4',
    title: 'пошаговая форма из трёх шагов без открытой формы',
    form: 'none',
    request:
      'Сделай пошаговую форму из трёх шагов: «Имя» — поле имени, «Контакты» — почта, ' +
      '«Согласие» — флажок согласия на обработку данных.',
    check: (s) => {
      if (s.created.length !== 1) return `создано форм: ${s.created.length}`;
      const wizard = nodesOf(s.schema).find((n) => nameOf(n.component) === 'Wizard');
      if (wizard === undefined) return 'нет мастера';
      const steps = (wizard.children ?? []).filter((c) => nameOf(c.component) === 'Step');
      if (steps.length !== 3) return `шагов ${steps.length}`;
      const empty = steps.findIndex(
        (step) => fieldsOf({ root: step } as unknown as JsonFormSchema).length === 0
      );
      return empty < 0 ? null : `шаг ${empty + 1} без полей`;
    },
  },
  {
    id: '7.1',
    title: 'обязательность и формат',
    form: 'client',
    request: 'Сделай телефон обязательным, а почту проверяй на корректный email.',
    check: (s) => {
      const on = (target: string) =>
        s.rules.validation.filter((r) => r.target === target).flatMap((r) => r.rules);
      // Обязательность — правилом или свойством `required` поля: генерация выводит проверку из
      // обоих, и карта формы называет модели оба пути.
      const required = (target: string) =>
        on(target).some((r) => r.startsWith('required')) ||
        fieldsOf(s.schema).find((f) => modelOf(f) === target)?.componentProps?.required === true;
      if (!required('phone')) return 'телефон не обязателен';
      if (!on('email').some((r) => r.startsWith('email'))) return 'почта без проверки формата';
      return required('email') ? null : 'обязательность почты потеряна';
    },
  },
  {
    id: '7.3',
    title: 'кросс-полевая проверка',
    form: 'client',
    request: 'Добавь поле повтора пароля и проверку, что пароли совпадают.',
    check: (s) =>
      fieldsOf(s.schema).length < 12
        ? 'поля повтора нет'
        : s.rules.validation.some((r) => r.cross !== undefined)
          ? null
          : 'нет кросс-полевой проверки',
  },
  {
    id: '7.4',
    title: 'условная обязательность',
    form: 'client',
    request: 'ИНН обязателен только для юрлица — смотри поле «Тип клиента».',
    check: (s) =>
      s.rules.validation.some(
        (r) => r.target === 'inn' && r.rules.some((x) => x.startsWith('required')) && r.when
      )
        ? null
        : 'нет обязательности ИНН с условием',
  },
  {
    id: '8.1',
    title: 'вычисляемое поле',
    form: 'client',
    request: 'Поле «Сумма» должно считаться само: цена × количество.',
    check: (s) =>
      s.rules.behavior.some((b) => b.target === 'total' && b.kind.startsWith('compute'))
        ? null
        : 'нет вычисления суммы',
  },
  {
    id: '8.4',
    title: 'скрыть поле по условию',
    form: 'client',
    request: 'Скрывай поле «Адрес доставки», когда отмечен самовывоз.',
    check: (s) =>
      s.rules.render.some((r) => r.kind === 'hideWhen') ||
      s.rules.behavior.some((b) => b.target === 'deliveryAddress' && /When$/.test(b.kind))
        ? null
        : 'нет правила для адреса доставки',
  },
  {
    id: '10.2',
    title: 'одна разметка для двух адресов',
    form: 'client',
    request:
      'Добавь адрес регистрации (город и улица) и такой же адрес проживания — одной общей ' +
      'разметкой, вынесенной в часть.',
    check: (s) => {
      const parts = Object.keys((s.schema as unknown as { parts?: object })?.parts ?? {});
      if (parts.length === 0) return 'нет части';
      const mounts = nodesOf(s.schema).filter((n) => n.part !== undefined).length;
      return mounts >= 2 ? null : `подключений части ${mounts}`;
    },
  },
  {
    id: '15.1',
    title: 'генерация кода',
    form: 'client',
    request: 'Сгенерируй код формы.',
    check: (s) => (s.generated === 1 ? null : `генераций ${s.generated}`),
  },
  {
    id: '17.1',
    title: 'объяснение без правок',
    form: 'client',
    request: 'Какие поля в форме обязательны? Ничего не меняй.',
    check: (s) =>
      edits(s).length > 0
        ? `правки: ${edits(s)
            .map((t) => t.name)
            .join(', ')}`
        : /почт|email/i.test(s.text)
          ? null
          : 'ответ не называет почту',
  },
  {
    id: '20.2',
    title: 'постоянная блокировка поля',
    form: 'client',
    request: 'Поле ИНН должно быть всегда недоступно для редактирования.',
    check: (s) => {
      const inn = fieldsOf(s.schema).find((f) => modelOf(f) === 'inn');
      return inn?.disabled === true || inn?.componentProps?.disabled === true
        ? null
        : 'ИНН не заблокирован';
    },
  },
  {
    id: '22.1',
    title: 'расплывчатый запрос',
    form: 'client',
    request: 'Сделай форму удобнее.',
    // Мерится, что ход не падает; спросил ли он или поправил сам — пишется в отчёт.
    check: (s) => (s.error === null ? null : `ошибка хода: ${s.error}`),
  },
  {
    id: '21.3',
    title: 'правка из файла модуля, а не со вкладки формы',
    form: 'client',
    tab: 'forms/eval/validation/form.ts',
    request: 'Сделай телефон обязательным.',
    check: (s) => {
      if (s.created.length > 0) return `создана форма: ${s.created.join(', ')}`;
      const required =
        s.rules.validation.some(
          (r) => r.target === 'phone' && r.rules.some((x) => x.startsWith('required'))
        ) ||
        fieldsOf(s.schema).find((f) => modelOf(f) === 'phone')?.componentProps?.required === true;
      return required ? null : 'телефон не обязателен';
    },
  },
  {
    id: '21.4',
    title: 'правка без вкладки при двух формах — выбор формы',
    form: 'none',
    otherForms: OTHER_FORMS,
    request: 'Добавь в форму поле телефона.',
    check: (s) => {
      if (s.created.length > 0) return `создана форма: ${s.created.join(', ')}`;
      if (!s.tools.some((t) => t.name === 'choose_form' && t.ok)) return 'форма не выбрана';
      if (s.target === null || !OTHER_FORMS.includes(s.target)) return `правил ${s.target}`;
      return fieldsOf(s.schema).some((f) => /phone|tel/i.test(modelOf(f)))
        ? null
        : 'нет поля телефона';
    },
  },
  {
    id: '21.4b',
    title: 'новая форма без вкладки при двух формах — без карточки выбора',
    form: 'none',
    otherForms: OTHER_FORMS,
    request: 'Сделай новую форму обратной связи: имя, почта и сообщение.',
    check: (s) =>
      s.tools.some((t) => t.name === 'choose_form')
        ? 'выбрана существующая форма'
        : s.created.length !== 1
          ? `создано форм: ${s.created.length}`
          : fieldsOf(s.schema).length < 3
            ? `полей ${fieldsOf(s.schema).length} из 3`
            : null,
  },
  // ── Крупная сборка: форма целиком, шаг, блок (план mcp-misty-graham, этап 2) ──
  {
    id: 'B.1',
    title: 'пошаговая форма средней спеки: 25 полей, 3 шага, 9 правил',
    form: 'none',
    request: [
      'Сделай пошаговую форму регистрации участника конференции, ключи полей — в скобках.',
      'Шаг «Участник»: фамилия (lastName), имя (firstName), отчество (middleName), дата рождения',
      '(birthDate), почта (email), телефон (phone), компания (company), должность (position).',
      'Шаг «Участие»: тип билета (ticketType: стандарт, VIP, студенческий), номер студенческого',
      '(studentId), дата приезда (arrivalDate), дата отъезда (departureDate), нужна гостиница',
      '(needHotel, флажок), число ночей (hotelNights), питание (mealPreference: обычное,',
      'вегетарианское, без глютена), промокод (promoCode).',
      'Шаг «Оплата»: плательщик (payerType: физлицо, юрлицо), ИНН (inn), название организации',
      '(payerCompany), почта для счёта (billingEmail), базовая цена (basePrice), скидка в',
      'процентах (discount), итого (total), комментарий (comment), согласие с условиями',
      '(acceptTerms, флажок).',
      'Правила: фамилия, имя, почта, телефон, тип билета и согласие обязательны; почта —',
      'корректный email; номер студенческого обязателен только для студенческого билета; дата',
      'отъезда не раньше даты приезда; число ночей доступно только при отмеченной гостинице; ИНН',
      'обязателен только для юрлица; почта для счёта копируется из почты участника; итого =',
      'базовая цена × (1 − скидка / 100); скидка от 0 до 50.',
    ].join(' '),
    check: (s) => {
      if (s.created.length !== 1) return `создано форм: ${s.created.length}`;
      const steps = stepsOf(s.schema);
      if (steps === null) return 'нет мастера';
      if (steps.length !== 3) return `шагов ${steps.length}`;
      const { fields, rules } = b1Coverage(s);
      if (fields[0] < 23) return `полей ${fields[0]} из ${fields[1]}`;
      return rules[0] < 7 ? `правил ${rules[0]} из ${rules[1]}` : null;
    },
    coverage: (s) => b1Coverage(s),
  },
  {
    id: 'B.2',
    title: 'шаг целиком в существующий мастер',
    form: 'wizard',
    request:
      'Добавь в мастер третий шаг «Доставка»: город, улица, дом, квартира, дата доставки и ' +
      'комментарий курьеру. Город, улица и дом — обязательные.',
    check: (s) => {
      const steps = stepsOf(s.schema);
      if (steps === null) return 'мастер пропал';
      if (steps.length !== 3) return `шагов ${steps.length}`;
      const before = fieldsOf(s.schema).map(modelOf);
      if (!['name', 'phone', 'email'].every((path) => before.includes(path))) {
        return 'поля прежних шагов потеряны';
      }
      const added = stepFields(steps[2]);
      if (added.length < 6) return `полей третьего шага ${added.length} из 6`;
      const required = added.filter((f) => requiredOn(s, modelOf(f))).length;
      return required >= 3 ? null : `обязательных ${required} из 3`;
    },
    coverage: (s) => {
      const added = stepsOf(s.schema)?.[2];
      const fields = added === undefined ? [] : stepFields(added);
      return {
        fields: [Math.min(fields.length, 6), 6],
        rules: [Math.min(fields.filter((f) => requiredOn(s, modelOf(f))).length, 3), 3],
      };
    },
  },
  {
    id: 'B.3',
    title: 'два блока адреса с копированием',
    form: 'client',
    request:
      'Добавь блок «Адрес регистрации» (город, улица, дом) и блок «Адрес проживания» с теми же ' +
      'полями, а между ними флажок «Совпадает с адресом регистрации»: когда он отмечен, адрес ' +
      'проживания копируется из адреса регистрации.',
    check: (s) => {
      const added = fieldsOf(s.schema).length - 11;
      if (added < 7) return `новых полей ${added} из 7`;
      return s.rules.behavior.some((b) => b.kind.startsWith('copyFrom'))
        ? null
        : 'нет копирования адреса';
    },
    coverage: (s) => ({
      fields: [Math.max(0, Math.min(fieldsOf(s.schema).length - 11, 7)), 7],
      rules: [s.rules.behavior.some((b) => b.kind.startsWith('copyFrom')) ? 1 : 0, 1],
    }),
  },
];

/** Покрытие B.1: поля по ключам запроса, правила — по списку {@link b1Rules}. */
function b1Coverage(s: EvalState): Coverage {
  const present = new Set(fieldsOf(s.schema).map((f) => keyOf(modelOf(f))));
  const keys = B1_STEPS.flat();
  const rules = Object.values(b1Rules(s));
  return {
    fields: [keys.filter((key) => present.has(key)).length, keys.length],
    rules: [rules.filter(Boolean).length, rules.length],
  };
}

// ── Ход ──

interface EvalResult {
  readonly id: string;
  readonly title: string;
  readonly pass: boolean;
  readonly reason: string | null;
  readonly tools: readonly string[];
  readonly failedTools: number;
  /** Отказы инструментов — тем текстом, что ушёл модели (укороченным). */
  readonly failures: readonly string[];
  readonly asked: number;
  readonly seconds: number;
  /** Ход остановлен по пределу времени сценария ({@link SCENARIO_LIMIT_MS}). */
  readonly timedOut: boolean;
  readonly error: string | null;
  readonly text: string;
  /** Рассуждение модели (укороченное): по нему видно, ПОЧЕМУ ход выбрал эти вызовы. */
  readonly reasoning: string;
  /** Запросов к модели за ход — сквозь попытки, с оборванными. */
  readonly requests: number;
  /** Секунд в запросах к модели. */
  readonly modelSeconds: number;
  /** Среднее время до первого куска, с: чтение контекста сервером. */
  readonly firstChunkSeconds: number | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly reasoningChars: number;
  /** Фазы обвязки: имя → секунды. */
  readonly phases: Readonly<Record<string, number>>;
  /** Файлы, которые ход записал в проект (пути от корня проекта). */
  readonly written: readonly string[];
  /** Собранное против заказанного — у сценариев крупной сборки, иначе `null`. */
  readonly coverage: Coverage | null;
}

/** Строка моста о коде, напечатанном записью хода, — не вызов модели. */
function isCodeLine(tool: ToolLogEntry): boolean {
  return (
    tool.name === 'generate_code' &&
    /turn\.code\.updated|Код модуля обновлён/.test(tool.summary ?? '')
  );
}

/** Поля замера хода — из сводки моста. */
function telemetryOf(summary: TurnTelemetry | null) {
  if (summary === null) {
    return {
      requests: 0,
      modelSeconds: 0,
      firstChunkSeconds: null,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      reasoningChars: 0,
      phases: {},
    };
  }
  const firsts = summary.requests
    .map((request) => request.firstChunkMs)
    .filter((ms): ms is number => ms !== undefined);
  const round = (ms: number) => Math.round(ms / 100) / 10;
  return {
    requests: summary.requests.length,
    modelSeconds: round(summary.modelMs),
    firstChunkSeconds:
      firsts.length === 0 ? null : round(firsts.reduce((a, b) => a + b, 0) / firsts.length),
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    reasoningTokens: summary.reasoningTokens,
    reasoningChars: summary.reasoningChars,
    phases: Object.fromEntries(
      Object.entries(summary.phases).map(([name, phase]) => [name, round(phase.ms)])
    ),
  };
}

async function runScenario(scenario: EvalScenario): Promise<EvalResult> {
  const undump =
    DUMP === undefined
      ? () => undefined
      : dumpExchanges(DUMP, () => scenario.id.replace(/\W/g, '_'));
  try {
    return await runScenarioOnce(scenario);
  } finally {
    undump();
  }
}

async function runScenarioOnce(scenario: EvalScenario): Promise<EvalResult> {
  const files = createFakeFiles();
  const host = createFakeHost(files);
  // Генерация — настоящая: ею ход пишет правила в код модуля.
  const codegen = generatorOver({ files, documentOf: (id) => host.documentOf(id) });
  if (scenario.form !== 'none') {
    const schema =
      scenario.form === 'client' ? CLIENT : scenario.form === 'wizard' ? WIZARD : EMPTY;
    files.put(DOCUMENT, printSchemaText(schema));
    host.openDocument(DOCUMENT, printSchemaText(schema));
    if (scenario.form === 'client') {
      // Правила анкеты уже в коде — как после прошлых ходов.
      const seeded = await codegen.generate(DOCUMENT, {
        stackInput: rulesStackInput(CLIENT_RULES),
      });
      if (!seeded.ok) throw new Error(seeded.message);
    }
  }
  for (const path of scenario.otherForms ?? []) files.put(path, printSchemaText(EMPTY));
  if (scenario.tab !== undefined) {
    const text = files.text(scenario.tab) ?? '';
    files.put(scenario.tab, text);
    host.openDocument(scenario.tab, text);
  }

  const created: string[] = [];
  const creator: FormCreatorService = {
    templates: async () => [
      { id: 'builtin-simple-form', name: 'Простая форма', source: 'builtin' },
      { id: 'builtin-wizard-form', name: 'Пошаговая форма', source: 'builtin' },
    ],
    async create(request) {
      const path = `forms/${request.formName}/schema/form.schema.json`;
      files.put(path, printSchemaText(EMPTY));
      created.push(path);
      return { ok: true, documentId: path, path, template: request.template ?? null };
    },
  };
  let generated = 0;
  const generator: ModuleGeneratorService = {
    async generate() {
      generated += 1;
      return {
        ok: true,
        formName: 'eval',
        dir: 'forms/eval',
        written: [],
        skipped: [],
        failed: [],
      };
    },
  };

  const providers = createProviderRegistry();
  providers.register(
    createByokProvider({
      kind: KIND,
      ...(KIND === 'openai-compatible' ? { baseUrl: BASE_URL } : {}),
      model: MODEL!,
      ...(API_KEY ? { apiKey: API_KEY } : {}),
      ...(REASONING === undefined ? {} : { reasoning: REASONING }),
    })
  );
  const assistant: AiAssistant = {
    providers,
    loadConfig: () => Promise.resolve({ kind: KIND, model: MODEL!, maxSteps: MAX_STEPS }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в замере')),
    restore: () => Promise.resolve(null),
  } as unknown as AiAssistant;

  const session = createAiSession();
  let telemetry: TurnTelemetry | null = null;
  const stack = createSchemaFormStack({
    catalog: () => builtinEntries(),
    validateForm: () => Promise.resolve(validateFormSchema),
    scopeOf: (id) => files.scopeOf(id),
    generator: () => codegen,
    // Как в плагине: форма файла модуля и формы проекта — для выбора формы хода.
    ...projectFormsOf(files),
    ...(BUILD_FORM ? { buildForm: true } : {}),
  });
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => [],
    executeCommand: () => Promise.resolve(undefined),
    stacks: () => [stack],
    generator: () => generator,
    formCreator: () => creator,
    telemetry: (summary) => {
      telemetry = summary;
    },
  });

  // Вопросы модели получают первый вариант: замер идёт без человека, а ход — до конца. Ответ —
  // отложенный: карточка появляется в ленте раньше, чем мост заводит ожидание ответа, и
  // синхронный ответ уходил в пустоту — ход ждал его до таймаута.
  const answered = new Set<string>();
  const answering = session.subscribe(() => {
    const card = openAskOf(session.get());
    if (card === null || answered.has(card.id)) return;
    answered.add(card.id);
    setTimeout(() => {
      bridge.answer(
        card.id,
        card.questions.map((question) => ({ selected: [question.options[0].label] }))
      );
    }, 0);
  });

  const started = Date.now();
  let timedOut = false;
  const limit = setTimeout(() => {
    timedOut = true;
    bridge.abort();
  }, SCENARIO_LIMIT_MS);
  await bridge.send(scenario.request);
  clearTimeout(limit);
  answering.dispose();

  // Форма хода — из снимка реплики человека: ход правит форму в фоне, и активной может остаться
  // вкладка файла модуля, а не формы.
  const entries = session.get().entries;
  const target =
    entries.find((entry) => entry.role === 'user')?.snapshot?.resource ?? host.activeResource();
  const text = target === null ? null : (host.documentOf(target)?.getText() ?? null);
  let schema: JsonFormSchema | null = null;
  try {
    schema = text === null ? null : parseSchemaText(text);
  } catch {
    schema = null;
  }
  const rules = target === null ? emptyRules() : (await readRuleCode(files, target, target)).rules;
  const last = entries.at(-1);
  const state: EvalState = {
    schema,
    rules,
    // Все реплики ассистента: выбор формы и правки после него могут лечь в разные.
    tools: entries.filter((entry) => entry.role === 'assistant').flatMap((entry) => entry.tools),
    text: last?.text ?? '',
    error: session.get().error,
    created,
    generated,
    asked: answered.size,
    target,
  };
  const reason = timedOut
    ? `остановлен через ${SCENARIO_LIMIT_MS / 60_000} мин`
    : scenario.check(state);
  return {
    id: scenario.id,
    title: scenario.title,
    pass: reason === null,
    reason,
    // Строку моста о напечатанном коде (`turn.code.updated`) журнал пишет под именем
    // `generate_code`, но модель её не вызывала — в списке вызовов она подписана отдельно.
    tools: state.tools.map((tool) =>
      isCodeLine(tool) ? '(код модуля)' : `${tool.name}${tool.ok ? '' : '✗'}`
    ),
    failedTools: state.tools.filter((tool) => !tool.ok).length,
    failures: state.tools
      .filter((tool) => !tool.ok)
      .map((tool) => `${tool.name}: ${(tool.error ?? '').slice(0, 200)}`),
    asked: answered.size,
    seconds: Math.round((Date.now() - started) / 1000),
    timedOut,
    error: state.error,
    text: state.text.slice(0, 300),
    reasoning: (last?.reasoning ?? '').slice(0, 3000),
    ...telemetryOf(telemetry),
    written: [...new Set(files.writes.map((write) => write.path))].sort(),
    coverage: scenario.coverage?.(state) ?? null,
  };
}

describe.skipIf(!MODEL)('замер: сценарии разработки форм на живой модели', () => {
  const results: EvalResult[] = [];
  const chosen = SCENARIOS.filter((scenario) => ONLY.length === 0 || ONLY.includes(scenario.id));

  for (const scenario of chosen) {
    it(`[${scenario.id}] ${scenario.title}`, async () => {
      const result = await runScenario(scenario);
      results.push(result);
      const coverage =
        result.coverage === null
          ? ''
          : ` · поля ${result.coverage.fields.join('/')}, правила ${result.coverage.rules.join('/')}`;
      console.info(
        `[eval] ${result.id} ${result.pass ? 'OK' : `FAIL (${result.reason})`}${coverage} · ` +
          `${result.seconds}s · запросов ${result.requests}, модель ${result.modelSeconds}s, ` +
          `до 1-го куска ${result.firstChunkSeconds ?? '—'}s, выход ${result.outputTokens}, ` +
          `рассуждение ${result.reasoningTokens || `${result.reasoningChars} симв.`} · ` +
          `${result.tools.join(' → ')}`
      );
      // Неудача сценария — данные замера, а не поломка теста: итог считает отчёт.
      expect(result.id).toBe(scenario.id);
    }, 1_800_000);
  }

  it('итог', () => {
    const passed = results.filter((result) => result.pass).length;
    console.info(`[eval] итог: ${passed}/${results.length} · модель ${MODEL}`);
    const root = fileURLToPath(new URL('../../../../../../.tmp/eval/', import.meta.url));
    mkdirSync(root, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(
      `${root}form-scenarios-${(MODEL ?? 'model').replace(/[^\w.-]/g, '_')}${REASONING === undefined ? '' : `-reasoning-${REASONING}`}${BUILD_FORM ? '-build-form' : ''}-${stamp}.json`,
      JSON.stringify(
        {
          model: MODEL,
          kind: KIND,
          baseUrl: BASE_URL,
          buildForm: BUILD_FORM,
          passed,
          total: results.length,
          results,
        },
        null,
        2
      )
    );
  });
});
