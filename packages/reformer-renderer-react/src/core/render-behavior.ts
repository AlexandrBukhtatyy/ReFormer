/**
 * RenderBehaviorFn — декларативное поведение схемы рендера
 *
 * Разделяет layout (RenderSchemaFn) и поведение (когда скрывать ноды).
 * Поведение объявляется отдельной функцией и передаётся в FormRenderer
 * через проп renderBehavior.
 *
 * Условия хранятся в Map<selector, conditionFn> и передаются через
 * React-контекст. RenderNodeComponent читает условие для своего selector
 * через useRenderHiddenCondition и подписывается на сигналы формы
 * через useHiddenCondition.
 *
 * @module reformer/renderer-react/render-behavior
 */

import { createContext, useContext, useEffect } from 'react';
import { effect } from '@preact/signals-core';
import type { FormProxy, FieldPath } from '@reformer/core';

// ============================================================================
// Public types
// ============================================================================

/** Условие скрытия ноды — чистая функция, реактивно вычисляется через useHiddenCondition */
export type RenderHiddenCondition<T> = (form: FormProxy<T>, path: FieldPath<T>) => boolean;

/**
 * Реактивный side-effect — перезапускается при изменении любого сигнала формы,
 * прочитанного внутри fn. Может вернуть функцию очистки.
 */
export type RenderBehaviorEffectFn<T> = (form: FormProxy<T>) => void | (() => void);

/**
 * Билдер поведений — передаётся в RenderBehaviorFn.
 */
export interface RenderBehaviorBuilder<T> {
  /**
   * Объявить условие скрытия для ноды с данным selector.
   * Условие реактивно — пересчитывается при изменении любого поля формы.
   */
  hideWhen(selector: string, condition: RenderHiddenCondition<T>): void;
  /**
   * Зарегистрировать реактивный side-effect.
   * fn вызывается при монтировании и перезапускается автоматически
   * при изменении любого сигнала формы, прочитанного внутри fn.
   *
   * Используй closure над RenderSchemaProxy для доступа к ref-ам компонентов:
   * @example
   * ```typescript
   * const schema = createRenderSchema(fn);
   * const behavior: RenderBehaviorFn<T> = (b) => {
   *   b.effect((form) => {
   *     const wizard = schema.node('wizard').getRef<FormWizardHandle<T>>();
   *     if (form.someFlag.value.value) wizard.current?.goToNextStep();
   *   });
   * };
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effect(fn: RenderBehaviorEffectFn<any>): void;
}

/**
 * Функция-схема поведения рендера.
 * Аналог BehaviorSchemaFn из @reformer/core, но для видимости нод.
 *
 * @example
 * ```typescript
 * const renderBehavior: RenderBehaviorFn<MyForm> = (b) => {
 *   b.hideWhen('mortgage-section', (form) => form.loanType.value.value !== 'mortgage');
 *   b.hideWhen('employer-section', (form) => form.employment.value.value !== 'employed');
 * };
 *
 * <FormRenderer form={form} render={schema} renderBehavior={renderBehavior} />
 * ```
 */
export type RenderBehaviorFn<T> = (builder: RenderBehaviorBuilder<T>) => void;

// ============================================================================
// Context
// ============================================================================

/**
 * React-контекст с Map условий скрытия: selector → conditionFn.
 * Предоставляется FormRenderer когда передан renderBehavior.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RenderBehaviorContext = createContext<Map<string, RenderHiddenCondition<any>> | null>(
  null
);

// ============================================================================
// Internal helpers
// ============================================================================

export interface RenderBehaviorResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions: Map<string, RenderHiddenCondition<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effects: RenderBehaviorEffectFn<any>[];
}

/**
 * @internal
 * Выполняет RenderBehaviorFn через билдер и возвращает conditions + effects.
 * Вызывается из FormRenderer (через useMemo).
 */
export function buildRenderBehavior<T>(
  fn: RenderBehaviorFn<T> | undefined
): RenderBehaviorResult | null {
  if (!fn) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions = new Map<string, RenderHiddenCondition<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const effects: RenderBehaviorEffectFn<any>[] = [];
  fn({
    hideWhen: (selector, condition) => conditions.set(selector, condition),
    effect: (effectFn) => effects.push(effectFn),
  });
  return { conditions, effects };
}

/**
 * @internal
 * Монтирует реактивные effects из RenderBehaviorFn.
 * Каждый effect оборачивается в Preact effect() — автоматически перезапускается
 * при изменении любого сигнала формы, прочитанного внутри fn.
 */
export function RenderBehaviorEffects<T>({
  form,
  effects,
}: {
  form: FormProxy<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effects: RenderBehaviorEffectFn<any>[];
}): null {
  useEffect(() => {
    const disposes = effects.map((effectFn) =>
      effect(() => {
        const cleanup = effectFn(form);
        // Preact effect не поддерживает возврат функции очистки напрямую,
        // поэтому cleanup вызывается при следующем запуске через закрытие
        return typeof cleanup === 'function' ? cleanup : undefined;
      })
    );
    return () => disposes.forEach((dispose) => dispose());
  }, [form]); // effects стабилен — buildRenderBehavior вызывается через useMemo

  return null;
}

/**
 * @internal
 * Читает условие скрытия для данного selector из RenderBehaviorContext.
 * Условия статичны — нет нужды в useSyncExternalStore.
 */
export function useRenderHiddenCondition<T>(
  selector: string | undefined
): RenderHiddenCondition<T> | undefined {
  const conditions = useContext(RenderBehaviorContext);
  if (!selector || !conditions) return undefined;
  return conditions.get(selector) as RenderHiddenCondition<T> | undefined;
}
