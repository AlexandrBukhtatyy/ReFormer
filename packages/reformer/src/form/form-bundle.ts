/**
 * `createForm` — единая сборка формы: модель, форма, валидация и дерево для рендера одним вызовом.
 *
 * Три способа реализации формы — React-руками, рендерер по TS-схеме, рендерер по JSON — берут
 * одну и ту же сборку и отличаются только видом схемы (билдер или документ) и тем, кто рисует
 * результат. Стабильность между рендерами даёт {@link useFormBundle}.
 *
 * Порядок сборки: модель → `seed` → дерево схемы → ноды формы → поведение → валидация → `setup`.
 * Дерево строится один раз.
 *
 * @group Utilities
 * @module form/form-bundle
 */

import { createModel } from '../model/create-model';
import type { FormModel } from '../model/types';
import { createFormFromModel } from './create-form';
import type { FormBehavior } from './behaviors';
import {
  createSchemaController,
  eachSchemaSelector,
  type SchemaController,
  type SchemaNodeControl,
  type SchemaOverrideMaps,
  unknownSchemaSelectors,
} from './schema-controller';
import type { FormSchemaNode } from './types/schema-node';
import type { FormProxy } from './types/index';
import {
  buildValidation,
  type FormValidation,
  type FormValidationBundle,
} from './validation/config';
import type { ValidationSchema } from './validation';

/**
 * Дерево, собранное реестром из документа схемы (JSON), и то, что реестр хочет донести до
 * рендерера вместе с ним.
 *
 * @group Utilities
 */
export interface ResolvedSchema {
  /** Корневой узел дерева. */
  tree: FormSchemaNode;
  /** Обёртка поля — компонент, которым рендерер оборачивает каждое поле. */
  fieldWrapper?: unknown;
  /** Граница ошибок — компонент, которым рендерер оборачивает дерево. */
  errorBoundary?: unknown;
}

/**
 * Реестр, умеющий превратить документ схемы в дерево. Метод необязателен: у интерфейса реестра
 * есть сторонние реализации, и ядро документ само не разбирает.
 *
 * @group Utilities
 */
export interface SchemaResolver {
  resolveSchema?(document: unknown, model: FormModel<never>): ResolvedSchema;
}

/**
 * Часть бандла для рендерера: готовое дерево и схема-контроллер сборки.
 *
 * @group Utilities
 */
export interface FormRender {
  /** Корневой узел дерева схемы; `undefined`, если схема не задана. */
  readonly tree: FormSchemaNode | undefined;
  /** Схема-контроллер сборки: области корня, строк массивов и подформ. */
  readonly controller: SchemaController;
  /** Управление узлом КОРНЕВОЙ области по его `selector`. */
  node(selector: string): SchemaNodeControl;
  /** Обёртка поля из реестра (JSON-вариант). */
  readonly fieldWrapper?: unknown;
  /** Граница ошибок из реестра (JSON-вариант). */
  readonly errorBoundary?: unknown;
}

/**
 * Результат {@link createForm}.
 *
 * @typeParam T - Форма данных модели.
 * @group Utilities
 */
export interface FormBundle<T> {
  model: FormModel<T>;
  form: FormProxy<T>;
  /** Собранная валидация; есть, если в конфиге заданы правила. */
  validation?: FormValidationBundle<T>;
  render: FormRender;
}

/**
 * Конфиг {@link createForm}.
 *
 * @typeParam T - Форма данных модели.
 * @group Utilities
 */
export interface CreateFormConfig<T> {
  /** Начальные значения — из них создаётся модель. Взаимоисключимо с `model`. */
  initial?: T;
  /** Готовая модель (если создана отдельной фабрикой). Приоритетнее `initial`. */
  model?: FormModel<T>;
  /**
   * Схема формы: билдер дерева `(model) => узел` либо документ (JSON) — тогда нужен `registry`.
   * Билдер, а не готовое дерево: узлы держат ручки модели (`model: model.$.email`), и построить
   * дерево до модели нечем.
   */
  schema?: ((model: FormModel<T>) => FormSchemaNode) | object;
  /** Реестр JSON-варианта: превращает документ схемы в дерево. */
  registry?: SchemaResolver;
  /** Поведение формы: значения, состояние нод и правила узлов схемы. */
  behavior?: FormBehavior<T>;
  /** Правила валидации: готовая схема либо {@link FormValidation} со стратегией и шагами. */
  validation?: FormValidation<T> | ValidationSchema<T>;
  /**
   * Правка модели ДО сборки формы. Нужна там, где значение обязано существовать к моменту
   * построения нод — например, массив, наполняемый из вычислений (реактивные `onChange` на
   * инициализации не срабатывают).
   */
  seed?: (model: FormModel<T>) => void;
  /** Донастройка ПОСЛЕ сборки: получает готовый бандл. */
  setup?: (bundle: FormBundle<T>) => void;
}

/** Бандл формы, у которой заданы правила: `validation` в нём есть всегда. */
type ValidatedFormBundle<T> = FormBundle<T> & { validation: FormValidationBundle<T> };

const AT = '[@reformer/core] createForm';

/** Имена в кавычках через запятую — для текста предупреждения. */
const quoted = (names: readonly string[]): string => names.map((name) => `"${name}"`).join(', ');

/**
 * Dev-проверки селекторов корневого дерева: правила поведения без узла, повторы `selector` и
 * ключи `validation.steps` без шага.
 */
function checkSelectors<T>(
  tree: FormSchemaNode | undefined,
  maps: SchemaOverrideMaps,
  validation: CreateFormConfig<T>['validation']
): void {
  const unknown = unknownSchemaSelectors(maps, tree);
  if (unknown.length > 0) {
    console.warn(
      `${AT}: поведение обращается к узлам схемы, которых нет в корневом дереве: ` +
        `${quoted(unknown)}. Правило ничего не сделает. ` +
        'Узлы строки массива и подформы адресуются из их поведения — через `applyEach` / `apply`.'
    );
  }

  const selectors = new Set<string>();
  const repeated = new Set<string>();
  eachSchemaSelector(tree, (selector) => {
    if (selectors.has(selector)) repeated.add(selector);
    else selectors.add(selector);
  });
  if (repeated.size > 0) {
    console.warn(
      `${AT}: в корневом дереве схемы повторяются селекторы: ${quoted([...repeated])}. ` +
        'По `selector` узел адресуют поведение и визард: правило, записанное на такой селектор, ' +
        'получат все узлы с этим именем. Дайте узлам разные селекторы.'
    );
  }

  const steps = typeof validation === 'object' ? validation.steps : undefined;
  if (steps) {
    const keys = Object.keys(steps);
    const missing = keys.filter((key) => !selectors.has(key));
    // Если ни один ключ не совпал с узлом, шаги дерево не описывает вовсе (визард собран в JSX) —
    // сверять не с чем. Частичное совпадение — опечатка в ключе либо в `selector` шага.
    if (missing.length > 0 && missing.length < keys.length) {
      console.warn(
        `${AT}: в \`validation.steps\` есть ключи, для которых в дереве схемы нет шага с таким ` +
          `\`selector\`: ${quoted(missing)}. Правила этих ключей при переходе между шагами не ` +
          'запустятся.'
      );
    }
  }
}

/** Дерево схемы и то, что реестр передал вместе с ним. */
function resolveTree<T>(config: CreateFormConfig<T>, model: FormModel<T>): Partial<ResolvedSchema> {
  const { schema, registry } = config;
  if (schema == null) return {};
  if (typeof schema === 'function') {
    return { tree: (schema as (model: FormModel<T>) => FormSchemaNode)(model) };
  }
  if (registry == null) {
    throw new Error(
      `${AT}: \`schema\` — готовое дерево, а не билдер \`(model) => узел\`. Передайте билдер; ` +
        'документу схемы (JSON) нужен `registry`. Форму из модели и готового дерева без сборки ' +
        'собирает `createFormFromModel({ model, schema })`.'
    );
  }
  if (typeof registry.resolveSchema !== 'function') {
    throw new Error(
      `${AT}: \`registry\` не умеет собирать дерево из документа схемы — у него нет метода ` +
        '`resolveSchema`. Возьмите реестр `@reformer/renderer-json` (`createComponentRegistry`).'
    );
  }
  return registry.resolveSchema(schema, model as FormModel<never>);
}

/**
 * Собрать модель, форму, валидацию и дерево для рендера за один проход.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateFormConfig}: (`initial` | `model`) + опц. `schema`, `registry`,
 *   `behavior`, `validation`, `seed`, `setup`.
 * @returns {@link FormBundle} — `{ model, form, validation?, render }`.
 *
 * @example Рендерер по TS-схеме
 * ```tsx
 * const credit = useFormBundle(() =>
 *   createForm<CreditForm>({
 *     model: createCreditModel(),
 *     schema: creditSchema, // (model) => узел
 *     behavior: creditBehavior,
 *     validation: { steps: { loan: loanRules }, extras: crossRules },
 *   })
 * );
 * return <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />;
 * ```
 *
 * @example React-руками — та же сборка, разметка в JSX
 * ```tsx
 * const credit = useFormBundle(() => createForm<CreditForm>({ initial, schema: creditSchema }));
 * return <FormField control={credit.form.loanType} />;
 * ```
 *
 * @example JSON — документ схемы и реестр
 * ```tsx
 * const credit = useFormBundle(() =>
 *   createForm<CreditForm>({ model: createCreditModel(), schema: creditJson, registry })
 * );
 * return <FormRenderer form={credit} />;
 * ```
 */
export function createForm<T extends object>(
  config: CreateFormConfig<T> & { validation: FormValidation<T> | ValidationSchema<T> }
): ValidatedFormBundle<T>;
export function createForm<T extends object>(config: CreateFormConfig<T>): FormBundle<T>;
export function createForm<T extends object>(config: CreateFormConfig<T>): FormBundle<T> {
  const given = config?.model as { signalAt?: unknown } | undefined;
  if (typeof given?.signalAt !== 'function' && config?.initial === undefined) {
    throw new Error(
      `${AT}: нужна модель — \`model\` либо \`initial\`. Значения формы принадлежат модели: ` +
        "`createForm({ initial: { email: '' }, schema })`."
    );
  }
  const model = config.model ?? createModel<T>(config.initial as T);
  config.seed?.(model);

  const { tree, fieldWrapper, errorBoundary } = resolveTree(config, model);
  const controller = createSchemaController();
  const root = controller.scopeOf(model);

  const form = createFormFromModel<T>({
    model,
    ...(tree !== undefined ? { schema: tree } : {}),
    ...(config.behavior ? { behavior: config.behavior, schemaController: controller } : {}),
  });

  if (process.env.NODE_ENV !== 'production') {
    checkSelectors(tree, root.__overrideMaps, config.validation);
  }

  const validation = buildValidation(model, config.validation);
  const bundle: FormBundle<T> = {
    model,
    form,
    ...(validation ? { validation } : {}),
    render: {
      tree,
      controller,
      node: (selector) => root.node(selector),
      ...(fieldWrapper !== undefined ? { fieldWrapper } : {}),
      ...(errorBoundary !== undefined ? { errorBoundary } : {}),
    },
  };
  config.setup?.(bundle);
  return bundle;
}
