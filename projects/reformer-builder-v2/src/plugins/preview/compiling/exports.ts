/**
 * Контракт каталога формы: какие экспорты превью ищет в исполненных сайдкарах.
 *
 * Имён у одного и того же по смыслу артефакта исторически несколько: шаблон простой формы отдаёт
 * готовую функцию `formRenderBehavior`, шаблон визарда — фабрику `createRenderBehavior(form, model)`,
 * а кодоген билдера печатает `createJsonRenderBehavior`. Разбор этих вариантов собран здесь,
 * чтобы сборка превью не знала о них ничего.
 *
 * ## Различаем по ИМЕНИ экспорта, а не по арности
 *
 * `RenderBehaviorFn` — тоже функция одного аргумента, и отличить её от фабрики по сигнатуре
 * невозможно. Попытка «угадать по числу параметров» дала бы правдоподобную и неверную сборку:
 * поведение подключилось бы, но получило бы не то, что ждёт.
 *
 * ## Типы берутся ИЗ конфигурации фабрики, а не объявляются заново
 *
 * `validation`, `behavior` и `renderBehavior` типизированы через `CreateJsonFormConfig`. Это
 * не экономия строк: собственное объявление разошлось бы с фабрикой на первом же изменении
 * её конфигурации, и разъезд обнаружился бы не компилятором, а превью, которое «почему-то
 * не применяет поведение».
 *
 * @module plugins/preview/compiling/exports
 */

import type { ComponentRegistry, CreateJsonFormConfig } from '@reformer/renderer-json';

/** Форма данных модели превью: она приходит из исполненного кода, и сузить её нечем. */
export type Shape = Record<string, unknown>;

type JsonFormConfig = CreateJsonFormConfig<Shape>;

/** Что нашлось в каталоге формы. Любое поле может отсутствовать — превью деградирует частями. */
export interface FormContract {
  /** Начальные значения из `model.ts`. */
  readonly initial?: Shape;
  /** Правила валидации: готовая конфигурация либо схема со стратегией из `validationOptions`. */
  readonly validation?: JsonFormConfig['validation'];
  /** Поведение модели (`defineFormBehavior`). */
  readonly behavior?: JsonFormConfig['behavior'];
  /** Фабрика поведения UI. Готовая функция заворачивается в фабрику здесь же. */
  readonly renderBehavior?: JsonFormConfig['renderBehavior'];
  /** Реестр компонентов формы. */
  readonly createRegistry?: () => ComponentRegistry;
}

/** Что реально подключилось — для сводки в шапке поверхности. */
export type AppliedArtifact = 'model' | 'validation' | 'behavior' | 'renderBehavior' | 'registry';

/**
 * Файлы-кандидаты по каждому артефакту.
 *
 * Первым идёт каноничное имя, дальше — легаси: дефисные имена прежних шаблонов билдера и совсем
 * ранние `behavior.ts` / `ui.ts`. Форма, сгенерированная давно, обязана оживать тоже — иначе
 * «превью не работает» будет означать «превью не работает на моём проекте».
 */
const MODEL_FILES: readonly string[] = ['model.ts', 'model.tsx'];
const VALIDATION_FILES: readonly string[] = ['validation.ts'];
const BEHAVIOR_FILES: readonly string[] = ['form.behavior.ts', 'form-behavior.ts', 'behavior.ts'];
const RENDER_BEHAVIOR_FILES: readonly string[] = [
  'renderer.behavior.ts',
  'render-behavior.ts',
  'ui.ts',
];
const REGISTRY_FILES: readonly string[] = ['registry.ts', 'registry.tsx'];

/** Первый модуль из списка, в котором есть экспорт с таким именем. */
function pick(
  modules: ReadonlyMap<string, unknown>,
  files: readonly string[],
  name: string
): unknown {
  for (const file of files) {
    const exports = modules.get(file);
    if (exports === null || typeof exports !== 'object') continue;
    const value = (exports as Record<string, unknown>)[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

const isFn = (value: unknown): value is (...args: never[]) => unknown =>
  typeof value === 'function';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Ключи, по которым узнаётся уже готовая конфигурация валидации.
 *
 * Без этой проверки схема правил и конфигурация были бы неразличимы: обе — объекты. Ошибиться
 * здесь дорого: конфигурация, принятая за схему, дала бы форму, которая молча не валидируется.
 */
const VALIDATION_CONFIG_KEYS: readonly string[] = ['schema', 'steps', 'extras', 'strategy'];

/** Похоже ли значение на `FormValidation`, а не на голую схему правил. */
export function isValidationConfig(value: unknown): boolean {
  return isObject(value) && VALIDATION_CONFIG_KEYS.some((key) => key in value);
}

/**
 * Собирает правила валидации из того, что экспортировали сайдкары.
 *
 * `validationOptions` (стратегия запуска) — отдельный экспорт исторически, и уронить его нельзя:
 * стратегия решает, ругается ли форма по ходу ввода или только на отправке, то есть ровно то,
 * ради чего живое превью и открывают.
 */
export function composeValidation(
  formValidation: unknown,
  validationOptions: unknown
): JsonFormConfig['validation'] {
  if (formValidation === undefined) return undefined;
  if (isValidationConfig(formValidation)) {
    // Готовую конфигурацию не трогаем: её автор уже сказал всё, что хотел, и дописать
    // стратегию поверх значило бы переспорить его молча.
    return formValidation as JsonFormConfig['validation'];
  }
  if (isObject(validationOptions)) {
    return { schema: formValidation, ...validationOptions } as JsonFormConfig['validation'];
  }
  return formValidation as JsonFormConfig['validation'];
}

/** Разобрать исполненные модули каталога в контракт формы. */
export function extractContract(modules: ReadonlyMap<string, unknown>): FormContract {
  const contract: {
    initial?: Shape;
    validation?: JsonFormConfig['validation'];
    behavior?: JsonFormConfig['behavior'];
    renderBehavior?: JsonFormConfig['renderBehavior'];
    createRegistry?: () => ComponentRegistry;
  } = {};

  const initial = pick(modules, MODEL_FILES, 'initialFormModel');
  if (isObject(initial)) contract.initial = initial;

  const validation = composeValidation(
    pick(modules, VALIDATION_FILES, 'formValidation'),
    pick(modules, VALIDATION_FILES, 'validationOptions')
  );
  if (validation !== undefined) contract.validation = validation;

  const behavior = pick(modules, BEHAVIOR_FILES, 'formBehavior');
  if (behavior !== undefined) contract.behavior = behavior as JsonFormConfig['behavior'];

  const ready = pick(modules, RENDER_BEHAVIOR_FILES, 'formRenderBehavior');
  // `createJsonRenderBehavior` — имя, которое печатает кодоген билдера; переименовать его нельзя,
  // потому что уже экспортированные каталоги импортируют именно его.
  const factory =
    pick(modules, RENDER_BEHAVIOR_FILES, 'createRenderBehavior') ??
    pick(modules, RENDER_BEHAVIOR_FILES, 'createJsonRenderBehavior');
  if (isFn(factory)) {
    contract.renderBehavior = factory as JsonFormConfig['renderBehavior'];
  } else if (isFn(ready)) {
    // Готовая функция — это фабрика, которой нечего спрашивать. Заворачиваем здесь, чтобы
    // у сборки был один вид входа, а не два.
    const behaviorFn = ready as ReturnType<NonNullable<JsonFormConfig['renderBehavior']>>;
    contract.renderBehavior = () => behaviorFn;
  }

  const createRegistry = pick(modules, REGISTRY_FILES, 'createRegistry');
  if (isFn(createRegistry)) contract.createRegistry = createRegistry as () => ComponentRegistry;

  return contract;
}

/** Список подключённых артефактов в порядке показа. */
export function appliedArtifacts(contract: FormContract): readonly AppliedArtifact[] {
  const out: AppliedArtifact[] = [];
  if (contract.initial !== undefined) out.push('model');
  if (contract.validation !== undefined) out.push('validation');
  if (contract.behavior !== undefined) out.push('behavior');
  if (contract.renderBehavior !== undefined) out.push('renderBehavior');
  if (contract.createRegistry !== undefined) out.push('registry');
  return out;
}
