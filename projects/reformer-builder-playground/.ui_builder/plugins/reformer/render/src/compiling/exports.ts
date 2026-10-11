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
 * `validation` и `behavior` типизированы через `CreateFormConfig` единой сборки. Это
 * не экономия строк: собственное объявление разошлось бы с фабрикой на первом же изменении
 * её конфигурации, и разъезд обнаружился бы не компилятором, а превью, которое «почему-то
 * не применяет поведение». У `renderBehavior` своей записи в конфигурации сборки нет: это слой
 * прежнего контракта, и его тип объявлен рядом со сборкой превью (`LegacyRenderBehavior`).
 *
 * @module plugins/reformer/render/compiling/exports
 */

import { LEGACY_FILES, MODULE_FILES } from '../../../core/codegen';
import type { CreateFormConfig } from '@reformer/core';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type { LegacyRenderBehavior, Shape } from '../runtime/build';

export type { Shape };

type FormConfig = CreateFormConfig<Shape>;

/** Что нашлось в каталоге формы. Любое поле может отсутствовать — превью деградирует частями. */
export interface FormContract {
  /** Начальные значения из `model.ts`. */
  readonly initial?: Shape;
  /** Правила валидации: готовая конфигурация либо правила со стратегией из `validationOptions`. */
  readonly validation?: FormConfig['validation'];
  /** Поведение формы (`defineFormBehavior`). */
  readonly behavior?: FormConfig['behavior'];
  /**
   * Правила узлов из `form.render.ts` модуля прежнего контракта — фабрика. Готовая функция
   * заворачивается в фабрику здесь же.
   */
  readonly renderBehavior?: LegacyRenderBehavior;
  /** Реестр компонентов формы. */
  readonly createRegistry?: () => ComponentRegistry;
}

/** Что реально подключилось — для сводки в шапке поверхности. */
export type AppliedArtifact = 'model' | 'validation' | 'behavior' | 'renderBehavior' | 'registry';

/**
 * Файлы-кандидаты по каждому артефакту.
 *
 * Первым идёт каноничное имя (из раскладки кодогена — `MODULE_FILES`), дальше — легаси:
 * прежнее `renderer.behavior.ts` (`LEGACY_FILES`), дефисные имена прежних шаблонов билдера и
 * совсем ранние `behavior.ts` / `ui.ts`. Форма, сгенерированная давно, обязана оживать тоже —
 * иначе «превью не работает» будет означать «превью не работает на моём проекте».
 *
 * Только корневые файлы: файлы папок шагов визарда энтри не требует (см. `./entry`), их
 * правила доходят сюда через корневой `validation.ts` и `form.render.ts`.
 */
const MODEL_FILES: readonly string[] = [MODULE_FILES.model, 'model.tsx'];
const VALIDATION_FILES: readonly string[] = [MODULE_FILES.validation, ...LEGACY_FILES.validation];
const BEHAVIOR_FILES: readonly string[] = [
  MODULE_FILES.behavior,
  'form-behavior.ts',
  'behavior.ts',
];
export const RENDER_BEHAVIOR_FILES: readonly string[] = [
  MODULE_FILES.render,
  ...LEGACY_FILES.render,
  'render-behavior.ts',
  'ui.ts',
];
const REGISTRY_FILES: readonly string[] = [MODULE_FILES.registry, 'registry.tsx'];

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
const VALIDATION_CONFIG_KEYS: readonly string[] = [
  'rules',
  'extras',
  'strategy',
  'debounce',
  'liveAfterSubmit',
  // Ключи прежней конфигурации: по ним она узнаётся, а переводит её {@link modernValidation}.
  'schema',
  'steps',
];

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
): FormConfig['validation'] {
  if (formValidation === undefined) return undefined;
  if (isValidationConfig(formValidation)) {
    // Готовую конфигурацию не дополняем: её автор уже сказал всё, что хотел, и дописать
    // стратегию поверх значило бы переспорить его молча.
    return modernValidation(formValidation as Record<string, unknown>);
  }
  if (isObject(validationOptions)) {
    return { rules: formValidation, ...validationOptions } as FormConfig['validation'];
  }
  return formValidation as FormConfig['validation'];
}

/**
 * Конфигурация валидации в ключах единой сборки.
 *
 * Прежняя конфигурация держала полный набор правил в `schema`, а правила шагов — в `steps`.
 * Сборка читает `rules`, и конфигурация со `schema` для неё пуста: форма собралась бы и молча не
 * проверялась. Правила шагов теперь принадлежат потоку шагов — здесь им места нет.
 */
function modernValidation(config: Record<string, unknown>): FormConfig['validation'] {
  if (!('schema' in config) && !('steps' in config)) return config as FormConfig['validation'];
  const { schema, steps: _steps, ...rest } = config;
  return {
    ...(schema === undefined ? {} : { rules: schema }),
    ...rest,
  } as FormConfig['validation'];
}

/** Разобрать исполненные модули каталога в контракт формы. */
export function extractContract(modules: ReadonlyMap<string, unknown>): FormContract {
  const contract: {
    initial?: Shape;
    validation?: FormConfig['validation'];
    behavior?: FormConfig['behavior'];
    renderBehavior?: LegacyRenderBehavior;
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
  if (behavior !== undefined) contract.behavior = behavior as FormConfig['behavior'];

  const ready = pick(modules, RENDER_BEHAVIOR_FILES, 'formRenderBehavior');
  // `createJsonRenderBehavior` — имя, которое печатает кодоген билдера; переименовать его нельзя,
  // потому что уже экспортированные каталоги импортируют именно его.
  const factory =
    pick(modules, RENDER_BEHAVIOR_FILES, 'createRenderBehavior') ??
    pick(modules, RENDER_BEHAVIOR_FILES, 'createJsonRenderBehavior');
  if (isFn(factory)) {
    contract.renderBehavior = factory as LegacyRenderBehavior;
  } else if (isFn(ready)) {
    // Готовая функция — это фабрика, которой нечего спрашивать. Заворачиваем здесь, чтобы
    // у сборки был один вид входа, а не два.
    const behaviorFn = ready as ReturnType<LegacyRenderBehavior>;
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
