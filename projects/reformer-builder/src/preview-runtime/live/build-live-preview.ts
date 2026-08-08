/**
 * Сборка live-бандла: модель + реестр + форма + валидация + поведение UI.
 *
 * Порядок здесь не декоративный. `createForm` обязан отработать ДО монтирования
 * `JsonFormRenderer` — иначе у листьев нет form-node'ов и рендерер рисует `null` вместо полей.
 * Поэтому вся сборка синхронна и завершается целиком, а асинхронной остаётся только компиляция,
 * которая происходит раньше.
 *
 * Начальные значения: пустые дефолты по `$model`-путям схемы ← `initialFormModel` из `model.ts`
 * ← явные правки пользователя из панели «Модель → Засев». Представительный мок (`synthMock`) в
 * этом пути НЕ участвует: заполненная форма скрыла бы работу `required`, а увидеть, как
 * отрабатывает валидация, — цель режима.
 *
 * @module reformer-builder/preview-runtime/live/build-live-preview
 */

import { createForm, createModel, type FormModel, type FormProxy } from '@reformer/core';
import {
  createFormValidation,
  type FormValidationController,
  type ValidationStrategyKind,
} from '@reformer/core/validation';
import {
  composeRegistries,
  convertJsonToM1Tree,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { RenderBehaviorFn } from '@reformer/renderer-react';
import { buildRegistry } from '../build-preview';
import { buildInitialValues, collectFieldDefaults } from '../synth-model';
import type { CompiledForm, LiveError } from './compile-form';
import { appliedArtifacts, extractContract, type AppliedArtifact } from './extract-exports';

type Shape = Record<string, unknown>;

/**
 * Готовый к монтированию live-бандл.
 *
 * Параметр `T` — форма данных, объявленная в `model.ts`. Проверить её билдер не может (модель
 * приходит из исполненного кода), поэтому это «доверительная» типизация ради удобства вызывающего —
 * ровно как `createJsonForm<FormShape>` в самих формах.
 */
export interface LiveBundle<T extends Shape = Shape> {
  registry: ComponentRegistry;
  model: FormModel<T>;
  /** Форма удерживается ссылкой, иначе form-node'ы соберёт GC. */
  form: FormProxy<T>;
  /** Контроллер стратегии; `null`, если схемы валидации нет. */
  validation: FormValidationController | null;
  /** Активная стратегия — для сводки в панели. */
  strategy: ValidationStrategyKind | null;
  /** Ручной прогон: контроллер либо codegen-контракт `makeValidationConfig`. */
  validateAll: (() => Promise<boolean>) | null;
  renderBehavior?: RenderBehaviorFn<T>;
  applied: AppliedArtifact[];
  errors: LiveError[];
}

export interface BuildLiveInput {
  /** Схема с класс-токенами узлов (та же, что уйдёт в рендерер). */
  schema: JsonFormSchema;
  compiled: CompiledForm;
  /** Значения `$dataSource` для базового реестра (моки панели «Registry»). */
  dataSources: Shape;
  /** Явные правки модели из панели «Засев»; `undefined` — правок не было. */
  modelOverride?: Shape;
}

function isPlainObject(v: unknown): v is Shape {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Слияние вглубь: значения `patch` перекрывают `base`, объекты сливаются рекурсивно. */
function deepMerge(base: Shape, patch: Shape): Shape {
  const out: Shape = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    out[key] = isPlainObject(prev) && isPlainObject(value) ? deepMerge(prev, value) : value;
  }
  return out;
}

/**
 * Собрать бандл из скомпилированного каталога. Ошибки исполнения контракта (валидации, реестра,
 * поведения) не роняют сборку: артефакт просто не подключается, а причина уезжает в `errors`.
 */
export function buildLivePreview<T extends Shape = Shape>(input: BuildLiveInput): LiveBundle<T> {
  const { schema, compiled, dataSources, modelOverride } = input;
  const contract = extractContract(compiled.modules);
  const errors: LiveError[] = [...compiled.errors];

  // ── модель ──
  let initial = buildInitialValues(collectFieldDefaults(schema));
  if (contract.initial) initial = deepMerge(initial, contract.initial);
  if (modelOverride) initial = deepMerge(initial, modelOverride);
  const model = createModel(initial) as FormModel<Shape>;

  // ── реестр: формы поверх билдерского (last-wins) ──
  let registry = buildRegistry(schema, dataSources);
  if (contract.createRegistry) {
    try {
      registry = composeRegistries(registry, contract.createRegistry());
    } catch (e) {
      errors.push({
        file: 'registry.ts',
        phase: 'evaluate',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ── форма (обязательно до рендера) ──
  const form = createForm({
    model,
    schema: convertJsonToM1Tree(schema, registry, model),
    behavior: contract.behavior,
  }) as FormProxy<Shape>;

  // ── валидация ──
  let validation: FormValidationController | null = null;
  let strategy: ValidationStrategyKind | null = null;
  let validateAll: (() => Promise<boolean>) | null = null;
  if (contract.validation) {
    try {
      validation = createFormValidation(model, contract.validation, contract.validationOptions);
      strategy = contract.validationOptions?.strategy ?? 'submit';
      validateAll = () => validation!.validate();
    } catch (e) {
      errors.push({
        file: 'validation.ts',
        phase: 'evaluate',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  } else if (contract.makeValidationConfig) {
    // codegen-контракт: схемы наружу нет, поэтому только ручной прогон — без реактивной стратегии.
    try {
      const config = contract.makeValidationConfig(model);
      validateAll = () => config.validateAll?.() ?? Promise.resolve(true);
      errors.push({
        file: 'validation.ts',
        phase: 'evaluate',
        message:
          'Экспортирован makeValidationConfig вместо formValidation — реактивная стратегия ' +
          'недоступна, валидацию можно запустить только вручную.',
      });
    } catch (e) {
      errors.push({
        file: 'validation.ts',
        phase: 'evaluate',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ── поведение UI ──
  let renderBehavior = contract.renderBehavior;
  if (!renderBehavior && contract.renderBehaviorFactory) {
    try {
      renderBehavior = contract.renderBehaviorFactory(form, model);
    } catch (e) {
      errors.push({
        file: 'render-behavior.ts',
        phase: 'evaluate',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    registry,
    model: model as FormModel<T>,
    form: form as unknown as FormProxy<T>,
    validation,
    strategy,
    validateAll,
    renderBehavior: renderBehavior as RenderBehaviorFn<T> | undefined,
    applied: appliedArtifacts(contract),
    errors,
  };
}
