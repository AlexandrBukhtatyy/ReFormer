/**
 * Замер: сценарии разработки форм из документа билдера (`docs/assistant-form-scenarios.md`) на
 * живой модели.
 *
 * e2e (`form-scenarios.spec.ts`) проверяет, что обвязка выдерживает сценарий, когда модель зовёт
 * инструменты правильно. Здесь — зовёт ли их правильно сама модель: запрос словами пользователя,
 * полный ход моста (затравка, вторая попытка, правила в коде модуля, создание формы), и критерий по тому,
 * что легло в форму и в правила. Рабочая область — двойник: интерфейса замер не касается.
 *
 * По умолчанию НЕ запускается: нужен живой канал. Запуск из каталога плагина ассистента —
 * `EVAL_MODEL=qwen3.8:27b-32k npx vitest run src/session/form-scenarios-eval.test.ts`;
 * `EVAL_ONLY=7.1,8.1` — только эти сценарии, `EVAL_BASE_URL` — другой OpenAI-совместимый канал.
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
import { createAgentBridge } from '../../forms/ai/src/session/bridge';
import { createAiSession, openAskOf, type ToolLogEntry } from '../../forms/ai/src/session/session';
import { createProviderRegistry } from '../../forms/ai/src/providers/registry';
import { createByokProvider } from '../../forms/ai/src/providers/byok';
import { parseSchemaText, printSchemaText } from '../ai/src/model/schema-text';
import { createFakeHost } from '../../forms/ai/src/testing';
import { createFakeFiles } from '../ai/src/stack/testing';
import { createSchemaFormStack } from '../ai/src/stack';
import type { AiAssistant } from '../../forms/ai/src/plugin';
import type { FormCreatorService, ModuleGeneratorService } from '@reformer/builder-plugin-api';

const MODEL = process.env.EVAL_MODEL;
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:11434/v1';
const ONLY = (process.env.EVAL_ONLY ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
/** Предел шагов хода: сценарии в десяток полей укладываются, зацикливание — нет. */
const MAX_STEPS = 24;

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
}

/** Правки, а не чтение: вызовы, которые меняют форму, правила или проект. */
const edits = (state: EvalState): ToolLogEntry[] =>
  state.tools.filter((tool) => tool.readOnly !== true && tool.ok);

interface EvalScenario {
  /** Номер сценария документа. */
  readonly id: string;
  readonly title: string;
  readonly form: 'none' | 'empty' | 'client';
  readonly request: string;
  /** Почему не прошёл, или `null`. */
  readonly check: (state: EvalState) => string | null;
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
    id: '7.1',
    title: 'обязательность и формат',
    form: 'client',
    request: 'Сделай телефон обязательным, а почту проверяй на корректный email.',
    check: (s) => {
      const on = (target: string) =>
        s.rules.validation.filter((r) => r.target === target).flatMap((r) => r.rules);
      if (!on('phone').some((r) => r.startsWith('required'))) return 'телефон не обязателен';
      if (!on('email').some((r) => r.startsWith('email'))) return 'почта без проверки формата';
      return on('email').some((r) => r.startsWith('required'))
        ? null
        : 'обязательность почты потеряна';
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
];

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
  readonly error: string | null;
  readonly text: string;
  /** Рассуждение модели (укороченное): по нему видно, ПОЧЕМУ ход выбрал эти вызовы. */
  readonly reasoning: string;
}

async function runScenario(scenario: EvalScenario): Promise<EvalResult> {
  const files = createFakeFiles();
  const host = createFakeHost(files);
  // Генерация — настоящая: ею ход пишет правила в код модуля.
  const codegen = generatorOver({ files, documentOf: (id) => host.documentOf(id) });
  if (scenario.form !== 'none') {
    const schema = scenario.form === 'client' ? CLIENT : EMPTY;
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
      kind: 'openai-compatible',
      baseUrl: BASE_URL,
      model: MODEL!,
      apiKey: 'ollama',
    })
  );
  const assistant: AiAssistant = {
    providers,
    loadConfig: () =>
      Promise.resolve({ kind: 'openai-compatible' as const, model: MODEL!, maxSteps: MAX_STEPS }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в замере')),
    restore: () => Promise.resolve(null),
  } as unknown as AiAssistant;

  const session = createAiSession();
  const stack = createSchemaFormStack({
    catalog: () => builtinEntries(),
    validateForm: () => Promise.resolve(validateFormSchema),
    scopeOf: (id) => files.scopeOf(id),
    generator: () => codegen,
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
  await bridge.send(scenario.request);
  answering.dispose();

  const active = host.activeResource();
  const text = active === null ? null : (host.documentOf(active)?.getText() ?? null);
  let schema: JsonFormSchema | null = null;
  try {
    schema = text === null ? null : parseSchemaText(text);
  } catch {
    schema = null;
  }
  const rules = active === null ? emptyRules() : (await readRuleCode(files, active, active)).rules;
  const last = session.get().entries.at(-1);
  const state: EvalState = {
    schema,
    rules,
    tools: last?.tools ?? [],
    text: last?.text ?? '',
    error: session.get().error,
    created,
    generated,
    asked: answered.size,
  };
  const reason = scenario.check(state);
  return {
    id: scenario.id,
    title: scenario.title,
    pass: reason === null,
    reason,
    tools: state.tools.map((tool) => `${tool.name}${tool.ok ? '' : '✗'}`),
    failedTools: state.tools.filter((tool) => !tool.ok).length,
    failures: state.tools
      .filter((tool) => !tool.ok)
      .map((tool) => `${tool.name}: ${(tool.error ?? '').slice(0, 200)}`),
    asked: answered.size,
    seconds: Math.round((Date.now() - started) / 1000),
    error: state.error,
    text: state.text.slice(0, 300),
    reasoning: (last?.reasoning ?? '').slice(0, 3000),
  };
}

describe.skipIf(!MODEL)('замер: сценарии разработки форм на живой модели', () => {
  const results: EvalResult[] = [];
  const chosen = SCENARIOS.filter((scenario) => ONLY.length === 0 || ONLY.includes(scenario.id));

  for (const scenario of chosen) {
    it(`[${scenario.id}] ${scenario.title}`, async () => {
      const result = await runScenario(scenario);
      results.push(result);
      console.info(
        `[eval] ${result.id} ${result.pass ? 'OK' : `FAIL (${result.reason})`} · ` +
          `${result.seconds}s · ${result.tools.join(' → ')}`
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
      `${root}form-scenarios-${(MODEL ?? 'model').replace(/[^\w.-]/g, '_')}-${stamp}.json`,
      JSON.stringify(
        { model: MODEL, baseUrl: BASE_URL, passed, total: results.length, results },
        null,
        2
      )
    );
  });
});
