import type { FieldAdapter } from '@reformer/core';

/**
 * Раскладка контрола в `FormField`: `inline-label` — контрол сам рисует подпись справа от себя
 * (Checkbox/Switch), и `FormField` верхнюю подпись не рендерит (иначе она задвоится).
 */
export type FieldControlLayout = 'inline-label';

/** Статики, которые обёртка поля читает с компонента. */
export interface FieldControlStatics {
  /** Диалект контрола — читает `FormField.Control` (@reformer/cdk) и рендерер. */
  reformerAdapter?: FieldAdapter;
  /** Раскладка — читает `FormField` ui-kit. */
  reformerLayout?: FieldControlLayout;
}

/**
 * Объявляет компоненту его контракт с формой — статики {@link FieldControlStatics} — и возвращает
 * ТОТ ЖЕ компонент. Новой обёртки не создаётся: в `component` поля кладётся сам компонент, а
 * связывание с формой выполняет обёртка поля (`FormField.Control` / рендерер), читая эти статики.
 *
 * @example
 * ```ts
 * export const Checkbox = defineFieldControl(CheckboxPrimitive, { adapter: checkedAdapter });
 * ```
 */
export function defineFieldControl<C extends object>(
  component: C,
  { adapter, layout }: { adapter?: FieldAdapter; layout?: FieldControlLayout }
): C & FieldControlStatics {
  const statics = component as C & FieldControlStatics;
  if (adapter) statics.reformerAdapter = adapter;
  if (layout) statics.reformerLayout = layout;
  return statics;
}
