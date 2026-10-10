/**
 * `createForm` — единая сборка формы: модель, форма, валидация и дерево для рендера одним вызовом.
 *
 * Три способа реализации формы — React-руками, рендерер по TS-схеме, рендерер по JSON — берут
 * одну и ту же сборку и отличаются только видом схемы (билдер или документ) и тем, кто рисует
 * результат. Стабильность между рендерами даёт {@link useFormBundle}.
 *
 * Порядок сборки: модель → `seed` → дерево схемы → компиляция → уровень формы (правила, поток) →
 * ноды формы → поведение → `setup`. Дерево строится и компилируется один раз: ноды формы и
 * рендерер читают одну и ту же {@link CompiledSchema}.
 *
 * @group Utilities
 * @module form/form-bundle
 */

import { createModel } from '../model/create-model';
import type { FormModel } from '../model/types';
import { createFormFromCompiled } from './create-form';
import type { FormBehavior } from './behaviors';
import {
  createSchemaController,
  type SchemaController,
  type SchemaNodeControl,
  type SchemaOverrideMaps,
  unknownSchemaSelectors,
} from './schema-controller';
import { compileSchema } from './schema/compile';
import type { CompiledSchema, SchemaNodeId } from './schema/compiled';
import type { FormSchemaNode } from './types/schema-node';
import type { FormProxy } from './types/index';
import {
  createFormLevel,
  type FormFlowConfig,
  type FormLevel,
  type FormValidation,
} from './form-level';
import type { ValidationDefinition } from './validation';

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
 * Часть бандла для рендерера: скомпилированная схема и схема-контроллер сборки.
 *
 * @group Utilities
 */
export interface FormRender {
  /** Скомпилированная схема корневой области; `undefined`, если схема не задана. */
  readonly tree: CompiledSchema | undefined;
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
 * Результат {@link createForm}: модель, форма, часть для рендерера и уровень формы
 * ({@link FormLevel}) — `validate()`, `validateStep(id)`, `submit(handler)` и поток шагов.
 *
 * @typeParam T - Форма данных модели.
 * @group Utilities
 */
export interface FormBundle<T> extends FormLevel<T> {
  readonly model: FormModel<T>;
  readonly form: FormProxy<T>;
  readonly render: FormRender;
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
  /**
   * Правила валидации: готовый набор либо {@link FormValidation} — полный набор `rules`, правила
   * вне шагов `extras` и стратегия живой проверки. Без `rules` полный набор собирается из правил
   * шагов потока и `extras`.
   */
  validation?: FormValidation<T> | ValidationDefinition<T>;
  /**
   * Поток шагов: `{ steps: [{ id, rules }] }`. Идентификатор шага — `selector` узла шага в схеме;
   * `next()` потока проверяет правила текущего шага.
   */
  flow?: FormFlowConfig<T>;
  /**
   * Правка модели ДО сборки формы. Нужна там, где значение обязано существовать к моменту
   * построения нод — например, массив, наполняемый из вычислений (реактивные `onChange` на
   * инициализации не срабатывают).
   */
  seed?: (model: FormModel<T>) => void;
  /** Донастройка ПОСЛЕ сборки: получает готовый бандл. */
  setup?: (bundle: FormBundle<T>) => void;
}

const AT = '[@reformer/core] createForm';

/** Имена в кавычках через запятую — для текста предупреждения. */
const quoted = (names: readonly string[]): string => names.map((name) => `"${name}"`).join(', ');

/**
 * Dev-проверки селекторов корневой области: правила поведения без узла и шаги потока без узла
 * шага. Повтор `selector` здесь не проверяется — на нём падает компиляция.
 */
function checkSelectors<T>(
  compiled: CompiledSchema | undefined,
  maps: SchemaOverrideMaps,
  flow: CreateFormConfig<T>['flow']
): void {
  if (compiled === undefined) return;
  const unknown = unknownSchemaSelectors(maps, compiled);
  if (unknown.length > 0) {
    console.warn(
      `${AT}: поведение обращается к узлам схемы, которых нет в корневом дереве: ` +
        `${quoted(unknown)}. Правило ничего не сделает. ` +
        'Узлы строки массива и подформы адресуются из их поведения — через `applyEach` / `apply`.'
    );
  }

  if (flow) {
    const keys = flow.steps.map((step) => step.id);
    const missing = keys.filter((key) => compiled.nodes.get(key as SchemaNodeId)?.selector !== key);
    // Если ни один ключ не совпал с узлом, шаги дерево не описывает вовсе (визард собран в JSX) —
    // сверять не с чем. Частичное совпадение — опечатка в ключе либо в `selector` шага.
    if (missing.length > 0 && missing.length < keys.length) {
      console.warn(
        `${AT}: в \`flow.steps\` есть шаги, для которых в дереве схемы нет узла с таким ` +
          `\`selector\`: ${quoted(missing)}. Визард не свяжет их с разметкой шага.`
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
 * Собрать модель, форму, уровень формы (проверка, отправка, поток шагов) и дерево для рендера за
 * один проход.
 *
 * @typeParam T - Форма данных модели.
 * @param config - {@link CreateFormConfig}: (`initial` | `model`) + опц. `schema`, `registry`,
 *   `behavior`, `validation`, `flow`, `seed`, `setup`.
 * @returns {@link FormBundle} — `{ model, form, render, flow, validate, validateStep, submit, … }`.
 *
 * @example Рендерер по TS-схеме
 * ```tsx
 * const credit = useFormBundle(() =>
 *   createForm<CreditForm>({
 *     model: createCreditModel(),
 *     schema: creditSchema, // (model) => узел
 *     behavior: creditBehavior,
 *     validation: { extras: crossRules },
 *     flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
 *   })
 * );
 * return <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />;
 * ```
 *
 * @example React-руками — та же сборка, разметка в JSX
 * ```tsx
 * const credit = useFormBundle(() => createForm<CreditForm>({ initial, schema: creditSchema }));
 * const send = async () => {
 *   const result = await credit.submit(api.send);
 *   if (result.status === 'invalid') showHint('Проверьте форму');
 * };
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
  const compiled = tree !== undefined ? compileSchema(tree, model as object) : undefined;
  const controller = createSchemaController();
  const root = controller.scopeOf(model);

  // Уровень формы — до нод: поведение получает поток шагов.
  const level = createFormLevel<T>(model, { validation: config.validation, flow: config.flow });
  const form = createFormFromCompiled<T>({
    model,
    ...(compiled !== undefined ? { compiled } : {}),
    ...(config.behavior ? { behavior: config.behavior, schemaController: controller } : {}),
    ...(level.flow !== undefined ? { flow: level.flow } : {}),
  });

  if (process.env.NODE_ENV !== 'production') {
    checkSelectors(compiled, root.__overrideMaps, config.flow);
  }

  const bundle: FormBundle<T> = {
    ...level,
    model,
    form,
    render: {
      tree: compiled,
      controller,
      node: (selector) => root.node(selector),
      ...(fieldWrapper !== undefined ? { fieldWrapper } : {}),
      ...(errorBoundary !== undefined ? { errorBoundary } : {}),
    },
  };
  config.setup?.(bundle);
  return bundle;
}
