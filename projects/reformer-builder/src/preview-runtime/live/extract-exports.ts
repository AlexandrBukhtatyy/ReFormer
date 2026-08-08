/**
 * Контракт каталога формы: какие экспорты билдер ищет в исполненных модулях.
 *
 * Имён у одного и того же по смыслу артефакта исторически несколько (шаблон простой формы отдаёт
 * `formRenderBehavior`-константу, шаблон визарда — фабрику `createRenderBehavior(form, model)`,
 * codegen-экспорт вместо `formValidation` кладёт `makeValidationConfig`). Разбор этих вариантов
 * собран здесь, чтобы сборка превью не знала о них ничего.
 *
 * Различаем по ИМЕНИ экспорта, а не по арности: `RenderBehaviorFn` — тоже функция одного аргумента,
 * и отличить её от фабрики по сигнатуре невозможно.
 *
 * @module reformer-builder/preview-runtime/live/extract-exports
 */

import type { FormModel, FormProxy } from '@reformer/core';
import type { FormBehavior } from '@reformer/core/behaviors';
import type { ValidationSchema, ValidationStrategyOptions } from '@reformer/core/validation';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type { RenderBehaviorFn } from '@reformer/renderer-react';
import type { ModuleExports } from './module-registry';

type Shape = Record<string, unknown>;

/** Что нашлось в каталоге формы. Любое поле может отсутствовать — превью деградирует частями. */
export interface FormContract {
  /** Начальные значения из `model.ts`. */
  initial?: Shape;
  /** Схема валидации (`defineValidationSchema`). */
  validation?: ValidationSchema<Shape>;
  /** Стратегия запуска валидации; нет — дефолт core (`submit`). */
  validationOptions?: ValidationStrategyOptions;
  /**
   * Контракт валидации из codegen-экспорта: отдаёт прогон по модели, но не схему — значит
   * реактивной стратегии из него не собрать, только ручной запуск. Держим отдельно, чтобы панель
   * могла честно сказать, почему стратегии нет.
   */
  makeValidationConfig?: (model: FormModel<Shape>) => {
    validateAll?: () => Promise<boolean>;
    validateStep?: (step: number) => Promise<boolean>;
  };
  /** Поведение модели (`defineFormBehavior`). */
  behavior?: FormBehavior<Shape>;
  /** Поведение UI: готовая функция либо фабрика, которой нужны форма и модель. */
  renderBehavior?: RenderBehaviorFn<Shape>;
  renderBehaviorFactory?: (
    form: FormProxy<Shape>,
    model: FormModel<Shape>
  ) => RenderBehaviorFn<Shape>;
  /** Реестр компонентов формы. */
  createRegistry?: () => ComponentRegistry;
}

/** Какие артефакты реально подключились — для чипов и панели «Сборка». */
export type AppliedArtifact = 'model' | 'validation' | 'behavior' | 'renderBehavior' | 'registry';

/** Первый модуль из списка, в котором есть экспорт с таким именем. */
function pick(modules: Record<string, ModuleExports>, files: string[], name: string): unknown {
  for (const file of files) {
    const value = modules[file]?.[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

const MODEL_FILES = ['model.ts', 'model.tsx'];
const VALIDATION_FILES = ['validation.ts'];
// `behavior.ts` / `ui.ts` — имена ранних шаблонов билдера.
const BEHAVIOR_FILES = ['form-behavior.ts', 'behavior.ts'];
const RENDER_BEHAVIOR_FILES = ['render-behavior.ts', 'ui.ts'];
const REGISTRY_FILES = ['registry.ts', 'registry.tsx'];

const isFn = (v: unknown): v is (...args: never[]) => unknown => typeof v === 'function';

/** Разобрать исполненные модули каталога в контракт формы. */
export function extractContract(modules: Record<string, ModuleExports>): FormContract {
  const contract: FormContract = {};

  const initial = pick(modules, MODEL_FILES, 'initialFormModel');
  if (initial && typeof initial === 'object') contract.initial = initial as Shape;

  const validation = pick(modules, VALIDATION_FILES, 'formValidation');
  if (validation) contract.validation = validation as ValidationSchema<Shape>;

  const options = pick(modules, VALIDATION_FILES, 'validationOptions');
  if (options && typeof options === 'object') {
    contract.validationOptions = options as ValidationStrategyOptions;
  }

  // codegen-контракт: `makeValidationConfig(model)` → { validateStep, validateAll }.
  const makeConfig = pick(modules, VALIDATION_FILES, 'makeValidationConfig');
  if (!contract.validation && isFn(makeConfig)) {
    contract.makeValidationConfig = makeConfig as FormContract['makeValidationConfig'];
  }

  const behavior = pick(modules, BEHAVIOR_FILES, 'formBehavior');
  if (behavior) contract.behavior = behavior as FormBehavior<Shape>;

  const renderBehavior = pick(modules, RENDER_BEHAVIOR_FILES, 'formRenderBehavior');
  if (isFn(renderBehavior)) contract.renderBehavior = renderBehavior as RenderBehaviorFn<Shape>;

  const factory = pick(modules, RENDER_BEHAVIOR_FILES, 'createRenderBehavior');
  if (isFn(factory)) {
    contract.renderBehaviorFactory = factory as FormContract['renderBehaviorFactory'];
  }

  const createRegistry = pick(modules, REGISTRY_FILES, 'createRegistry');
  if (isFn(createRegistry)) contract.createRegistry = createRegistry as () => ComponentRegistry;

  return contract;
}

/** Список подключённых артефактов в порядке показа. */
export function appliedArtifacts(contract: FormContract): AppliedArtifact[] {
  const out: AppliedArtifact[] = [];
  if (contract.initial) out.push('model');
  if (contract.validation || contract.makeValidationConfig) out.push('validation');
  if (contract.behavior) out.push('behavior');
  if (contract.renderBehavior || contract.renderBehaviorFactory) out.push('renderBehavior');
  if (contract.createRegistry) out.push('registry');
  return out;
}
